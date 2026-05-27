-- Nom du fichier : 20260527a_news_syntheses_unique_active_scored_down.sql
-- Date de création : 2026-05-27
-- Ticket : fix bug d'idempotence synthesize_articles (claude/fix-synthesize-idempotence-27mai2026)
-- Description : Rollback symétrique — drop du partial UNIQUE INDEX news_syntheses_scored_id_active_uniq
-- Rollback : n/a (ce fichier EST le rollback de 20260527a_news_syntheses_unique_active_scored.sql)

-- ============================================================================
-- 1. DROP INDEX (idempotent — fail silent si déjà absent)
-- ============================================================================

DROP INDEX IF EXISTS public.news_syntheses_scored_id_active_uniq;

-- ============================================================================
-- 2. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT COUNT(*) AS remaining_indexes
--   FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND tablename = 'news_syntheses'
--    AND indexname = 'news_syntheses_scored_id_active_uniq';
--
-- Résultat attendu : 0.
