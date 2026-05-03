-- Nom du fichier : 20260503d_news_journal_down.sql
-- Date de création : 2026-05-03
-- Ticket : T11 — Journal hebdo News (rollback)
-- Description : rollback symétrique de 20260503d_news_journal.sql.
--
-- ATTENTION : ce rollback échoue (et c'est voulu) si des rows
-- news_episodes avec type='journal' existent encore. Avant rollback :
--   1. Archiver les journaux : UPDATE news_episodes SET status='archived'
--      WHERE type='journal';
--   2. Supprimer ces rows : DELETE FROM news_episodes WHERE type='journal';
--      (le CASCADE supprimera automatiquement les rows liées dans
--       news_episode_syntheses).

-- ============================================================================
-- 1. Drop de la table de liaison (CASCADE supprime aussi les FK et index)
-- ============================================================================

DROP TABLE IF EXISTS public.news_episode_syntheses;

-- ============================================================================
-- 2. Drop du trigger updated_at + fonction associée
-- ============================================================================

DROP TRIGGER IF EXISTS news_episodes_set_updated_at ON public.news_episodes;
DROP FUNCTION IF EXISTS public.news_episodes_set_updated_at();

-- ============================================================================
-- 3. Drop de la colonne updated_at
-- ============================================================================

ALTER TABLE public.news_episodes
  DROP COLUMN IF EXISTS updated_at;

-- ============================================================================
-- 4. Restauration du CHECK news_episodes.type d'origine (sans 'journal')
-- ============================================================================

ALTER TABLE public.news_episodes
  DROP CONSTRAINT IF EXISTS news_episodes_type_check;

ALTER TABLE public.news_episodes
  ADD CONSTRAINT news_episodes_type_check
  CHECK (type = ANY (ARRAY['digest'::text, 'insight'::text]));
