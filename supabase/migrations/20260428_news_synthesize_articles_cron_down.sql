-- Nom du fichier : 20260428_news_synthesize_articles_cron_down.sql
-- Date de création : 2026-04-28
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Rollback symétrique — unschedule du job news_synthesize_articles
-- Rollback : n/a (ce fichier EST le rollback de 20260428_news_synthesize_articles_cron.sql)

-- ============================================================================
-- 1. Unschedule du job (idempotent — fail silent si déjà absent)
-- ============================================================================

DO $rb$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles') THEN
    PERFORM cron.unschedule('news_synthesize_articles');
  END IF;
END
$rb$;

-- ============================================================================
-- 2. Extensions — doctrine conservatrice
-- ============================================================================

-- DROP EXTENSION pg_cron;
-- ↑ commenté volontairement : les jobs news_check_retractions,
--   news_ingest_pubmed (Ticket 2), news_ingest_rss (Ticket 3) et
--   news_score_articles (Ticket 4) coexistent dans cron.job. Un DROP
--   CASCADE les supprimerait silencieusement. Laisser pg_cron en place
--   est sans coût.

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT COUNT(*) AS synthesize_jobs_remaining
--   FROM cron.job
--  WHERE jobname = 'news_synthesize_articles';
--
-- Résultat attendu : 0.
