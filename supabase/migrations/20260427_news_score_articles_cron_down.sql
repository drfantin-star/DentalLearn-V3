-- Nom du fichier : 20260427_news_score_articles_cron_down.sql
-- Date de création : 2026-04-27
-- Ticket : feature/news-ticket-4
-- Description : Rollback symétrique — unschedule du job news_score_articles
-- Rollback : n/a (ce fichier EST le rollback de 20260427_news_score_articles_cron.sql)

-- ============================================================================
-- 1. Unschedule du job (idempotent — fail silent si déjà absent)
-- ============================================================================

DO $rb$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_score_articles') THEN
    PERFORM cron.unschedule('news_score_articles');
  END IF;
END
$rb$;

-- ============================================================================
-- 2. Extensions — doctrine conservatrice
-- ============================================================================

-- DROP EXTENSION pg_cron;
-- ↑ commenté volontairement : les jobs news_check_retractions,
--   news_ingest_pubmed (Ticket 2) et news_ingest_rss (Ticket 3) coexistent
--   dans cron.job. Un DROP CASCADE les supprimerait silencieusement.
--   Laisser pg_cron en place est sans coût.

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT COUNT(*) AS score_jobs_remaining
--   FROM cron.job
--  WHERE jobname = 'news_score_articles';
--
-- Résultat attendu : 0.
