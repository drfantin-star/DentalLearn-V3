-- Nom du fichier : 20260428_news_syntheses_failed_status.sql
-- Date de création : 2026-04-28
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Phase 0bis — extension status='failed'/'failed_permanent' + 3 colonnes traces (validation_errors, validation_warnings, failed_attempts) + index status sur news_syntheses, support arbitrages A2/A3/A4 du Ticket 5
-- Rollback : supabase/migrations/20260428_news_syntheses_failed_status_down.sql

-- ============================================================================
-- Contexte (addendum à spec_news_podcast_pipeline_v1_3.md §5.2 — autorisé Dr Fantin)
-- ============================================================================
-- Le Ticket 5 (synthesize_articles, Sonnet single-call) doit pouvoir :
--   A2 — tracer un échec de tagging hors taxonomy (retry × 2 puis fail).
--   A3 — tracer un échec si <1 question valide après filtrage.
--   A4 — distinguer "jamais tenté" vs "tenté + échoué" pour le retry cron,
--        avec un cap retries=2 pour éviter la boucle infinie sur articles
--        cassés (abstract intraitable, source bizarre, etc.).
--
-- Le CHECK status d'origine (cf 20260423_news_schema.sql ligne ~120)
-- n'autorise que ('active','retracted','deleted'). On l'étend à
-- ('active','retracted','deleted','failed','failed_permanent').
--
-- 3 colonnes ajoutées :
--   - validation_errors    JSONB  — payload structuré du dernier échec
--                                   (stage, reason, details, sonnet_raw, ts)
--   - validation_warnings  JSONB  — array des questions filtrées mais non
--                                   bloquantes (≥1 question valide existe)
--   - failed_attempts      INT NOT NULL DEFAULT 0
--                                   compteur de retries du pipeline. Promu
--                                   à 'failed_permanent' à attempts >= 2.
--
-- 1 index :
--   - news_syntheses_status_idx (filtre cron : SELECT WHERE status='failed').
--
-- ============================================================================
-- ⚠️ Lz6 (28/04/2026) — naming des contraintes
-- ============================================================================
-- Le nouveau CHECK est nommé EXPLICITEMENT `news_syntheses_status_extended_check`
-- (pas `news_syntheses_status_check`) pour éviter toute collision avec un
-- nom auto Postgres. L'ancien CHECK status est dropé via une recherche
-- pg_get_constraintdef (le nom auto-créé n'est pas connu à l'avance — il
-- dépend de l'ordre de création initiale des CHECK lors de Ticket 1).

-- ============================================================================
-- 1. Drop de l'ancien CHECK status (auto-nommé par Postgres)
-- ============================================================================
-- Recherche par contenu sur pg_get_constraintdef : on cible une CHECK qui
-- mentionne 'active', 'retracted' et 'deleted' simultanément. Robuste face
-- au formatage exact du DDL.

DO $$
DECLARE
  old_constraint_name text;
BEGIN
  SELECT con.conname INTO old_constraint_name
  FROM pg_constraint con
  WHERE con.conrelid = 'public.news_syntheses'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%status%active%retracted%deleted%';

  IF old_constraint_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE public.news_syntheses DROP CONSTRAINT %I',
      old_constraint_name
    );
  END IF;
END $$;

-- ============================================================================
-- 2. Ajout du nouveau CHECK étendu (nom explicite, anti-Lz6)
-- ============================================================================

ALTER TABLE public.news_syntheses
  ADD CONSTRAINT news_syntheses_status_extended_check CHECK (
    status IN ('active','retracted','deleted','failed','failed_permanent')
  );

-- ============================================================================
-- 3. Ajout des 3 colonnes de traçabilité
-- ============================================================================
-- failed_attempts NOT NULL DEFAULT 0 : safe sur la table (0 lignes en BDD à
-- ce jour, le Ticket 5 n'est pas encore déployé). Si jamais des lignes
-- existaient, le DEFAULT remplit immédiatement.

ALTER TABLE public.news_syntheses
  ADD COLUMN validation_errors jsonb,
  ADD COLUMN validation_warnings jsonb,
  ADD COLUMN failed_attempts integer NOT NULL DEFAULT 0;

-- ============================================================================
-- 4. Index sur status (filtre cron : SELECT WHERE status='failed' AND attempts<2)
-- ============================================================================

CREATE INDEX IF NOT EXISTS news_syntheses_status_idx
  ON public.news_syntheses (status);

-- ============================================================================
-- 5. Vérification (à exécuter dans un RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT con.conname, pg_get_constraintdef(con.oid)
--   FROM pg_constraint con
--  WHERE con.conrelid = 'public.news_syntheses'::regclass
--    AND con.contype = 'c'
--    AND con.conname = 'news_syntheses_status_extended_check';
--
-- Résultat attendu : 1 ligne, definition contenant les 5 valeurs autorisées.
--
-- SELECT column_name, data_type, column_default, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'news_syntheses'
--    AND column_name IN ('validation_errors','validation_warnings','failed_attempts')
--  ORDER BY column_name;
--
-- Résultat attendu : 3 lignes
--   - failed_attempts      | integer | 0    | NO
--   - validation_errors    | jsonb   | NULL | YES
--   - validation_warnings  | jsonb   | NULL | YES
--
-- SELECT indexname
--   FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND tablename  = 'news_syntheses'
--    AND indexname  = 'news_syntheses_status_idx';
--
-- Résultat attendu : 1 ligne.
