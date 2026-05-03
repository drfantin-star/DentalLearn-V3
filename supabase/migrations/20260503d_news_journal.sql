-- Nom du fichier : 20260503d_news_journal.sql
-- Date de création : 2026-05-03
-- Ticket : T11 — Journal hebdo News
-- Description : ajoute le type 'journal' au CHECK news_episodes.type,
--               crée la table de liaison N:N news_episode_syntheses
--               (3 à 6 synthèses par journal, ordonnées 1..6), et ajoute
--               la colonne updated_at sur news_episodes (utilisée par les
--               PATCH status admin du journal).
--
-- Rollback : 20260503d_news_journal_down.sql.
--
-- AUDIT PRÉALABLE (3 mai 2026) :
--   - news_episodes_type_check actuel : CHECK (type IN ('digest','insight'))
--     → on ajoute 'journal' de manière purement additive (T7-ter ne touche
--       pas ce CHECK ; il étend uniquement news_sources.type).
--   - L'index partiel UNIQUE news_episodes_type_week_uniq couvre déjà la
--     contrainte "1 seul journal non-archivé par week_iso" → rien à faire.
--   - Aucune fonction set_updated_at générique préexistante : on en crée
--     une dédiée à news_episodes pour éviter tout conflit.

-- ============================================================================
-- 1. Étendre le CHECK news_episodes.type pour autoriser 'journal'
-- ============================================================================

ALTER TABLE public.news_episodes
  DROP CONSTRAINT IF EXISTS news_episodes_type_check;

ALTER TABLE public.news_episodes
  ADD CONSTRAINT news_episodes_type_check
  CHECK (type = ANY (ARRAY['digest'::text, 'insight'::text, 'journal'::text]));

-- ============================================================================
-- 2. Colonne updated_at + trigger de maintenance
-- ============================================================================

ALTER TABLE public.news_episodes
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.news_episodes_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- clock_timestamp() (et non now()) pour que le bump fonctionne aussi
  -- lorsqu'un INSERT puis un UPDATE arrivent dans la même transaction.
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS news_episodes_set_updated_at ON public.news_episodes;

CREATE TRIGGER news_episodes_set_updated_at
  BEFORE UPDATE ON public.news_episodes
  FOR EACH ROW
  EXECUTE FUNCTION public.news_episodes_set_updated_at();

-- ============================================================================
-- 3. Table news_episode_syntheses (liaison N:N + position)
-- ============================================================================
-- Un journal contient 3 à 6 synthèses ordonnées (position 1..6).
-- ON DELETE CASCADE côté episode pour permettre la suppression admin.
-- ON DELETE RESTRICT côté synthesis : on refuse de supprimer une synthèse
-- qui est encore référencée par un journal — la synthèse doit d'abord être
-- retirée du journal (ou le journal archivé/supprimé).

CREATE TABLE IF NOT EXISTS public.news_episode_syntheses (
  id            uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  episode_id    uuid        NOT NULL REFERENCES public.news_episodes(id) ON DELETE CASCADE,
  synthesis_id  uuid        NOT NULL REFERENCES public.news_syntheses(id) ON DELETE RESTRICT,
  position      smallint    NOT NULL CHECK (position BETWEEN 1 AND 6),
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_episode_syntheses_episode_synthesis_uniq
    UNIQUE (episode_id, synthesis_id),
  CONSTRAINT news_episode_syntheses_episode_position_uniq
    UNIQUE (episode_id, position)
);

-- ============================================================================
-- 4. RLS : service_role uniquement (pattern T5/T7-ter/T8)
-- ============================================================================

ALTER TABLE public.news_episode_syntheses ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.news_episode_syntheses FROM PUBLIC;
REVOKE ALL ON public.news_episode_syntheses FROM anon;
REVOKE ALL ON public.news_episode_syntheses FROM authenticated;

-- ============================================================================
-- 5. Index de performance (lookup par episode et par synthesis)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_nes_episode
  ON public.news_episode_syntheses(episode_id);

CREATE INDEX IF NOT EXISTS idx_nes_synthesis
  ON public.news_episode_syntheses(synthesis_id);
