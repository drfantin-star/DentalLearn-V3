-- Nom du fichier : 20260426_news_ingest_rss_cron_down.sql
-- Date de création : 2026-04-26
-- Ticket : feature/news-ticket-3
-- Description : Rollback symétrique — unschedule du job news_ingest_rss
-- Rollback : n/a (ce fichier EST le rollback de 20260426_news_ingest_rss_cron.sql)

-- ============================================================================
-- 1. Unschedule du job (idempotent — fail silent si déjà absent)
-- ============================================================================

DO $rb$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_ingest_rss') THEN
    PERFORM cron.unschedule('news_ingest_rss');
  END IF;
END
$rb$;

-- ============================================================================
-- 2. Extensions — doctrine conservatrice
-- ============================================================================

-- DROP EXTENSION pg_cron;
-- ↑ commenté volontairement : les jobs news_check_retractions et
--   news_ingest_pubmed (Ticket 2) coexistent dans cron.job. Un DROP CASCADE
--   les supprimerait silencieusement. Laisser pg_cron en place est sans coût.

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT COUNT(*) AS rss_jobs_remaining
--   FROM cron.job
--  WHERE jobname = 'news_ingest_rss';
--
-- Résultat attendu : 0.
