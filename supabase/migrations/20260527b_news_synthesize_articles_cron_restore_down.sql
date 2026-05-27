-- Nom du fichier : 20260527b_news_synthesize_articles_cron_restore_down.sql
-- Date de création : 2026-05-27
-- Ticket : fix bug d'idempotence synthesize_articles (claude/fix-synthesize-idempotence-27mai2026)
-- Description : Rollback symétrique — unschedule du job news_synthesize_articles
-- Rollback : n/a (ce fichier EST le rollback de 20260527b_news_synthesize_articles_cron_restore.sql)

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
-- 2. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT COUNT(*) AS synthesize_jobs_remaining
--   FROM cron.job
--  WHERE jobname = 'news_synthesize_articles';
--
-- Résultat attendu : 0.
