-- Nom du fichier : 20260429_news_synthesize_articles_cron_second_down.sql
-- Date de création : 2026-04-29
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Rollback symétrique — unschedule du 2e job news_synthesize_articles_late
-- Rollback : n/a (ce fichier EST le rollback de 20260429_news_synthesize_articles_cron_second.sql)

-- ============================================================================
-- 1. Unschedule du 2e job (idempotent — fail silent si déjà absent)
-- ============================================================================
-- Ne touche PAS au job 'news_synthesize_articles' (créé par les migrations
-- antérieures du 28/04/2026 + recalibrage du 29/04/2026). Seul le cron
-- 'news_synthesize_articles_late' ajouté par cette migration est annulé.

DO $rb$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_synthesize_articles_late') THEN
    PERFORM cron.unschedule('news_synthesize_articles_late');
  END IF;
END
$rb$;

-- ============================================================================
-- 2. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT count(*) AS late_jobs_remaining
--   FROM cron.job
--  WHERE jobname = 'news_synthesize_articles_late';
--
-- Résultat attendu : 0.
--
-- Vérif que le 1er cron est toujours en place (non touché par ce DOWN) :
--
-- SELECT jobname, schedule, active
--   FROM cron.job
--  WHERE jobname = 'news_synthesize_articles';
--
-- Résultat attendu : 1 ligne, schedule='0 20 * * 1', active=true.
