-- Nom du fichier : 20260423_news_cron_schedules_down.sql
-- Date de création : 2026-04-23
-- Ticket : feature/news-ticket-2
-- Description : Rollback symétrique — unschedule des 2 jobs cron news_*, conservateur sur pg_cron et pg_net
-- Rollback : n/a (ce fichier EST le rollback de 20260423_news_cron_schedules.sql)

-- ============================================================================
-- 1. Unschedule des 2 jobs (idempotent — fail silent si déjà absent)
-- ============================================================================

DO $rb$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_check_retractions') THEN
    PERFORM cron.unschedule('news_check_retractions');
  END IF;
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_ingest_pubmed') THEN
    PERFORM cron.unschedule('news_ingest_pubmed');
  END IF;
END
$rb$;

-- ============================================================================
-- 2. Extensions — doctrine conservatrice (cf. _down.sql du Ticket 1 sur vector)
-- ============================================================================

-- DROP EXTENSION pg_cron;
-- ↑ commenté volontairement : d'autres jobs cron peuvent coexister dans le
--   projet DentalLearn, un DROP CASCADE effacerait silencieusement tout
--   cron.job tiers. Laisser l'extension en place est sans coût.

-- NE PAS TOUCHER pg_net : extension partagée, toujours active sur le projet
-- (installée v0.19.5 avant le Ticket 2).

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT COUNT(*) AS news_jobs_remaining
--   FROM cron.job
--  WHERE jobname LIKE 'news_%';
--
-- Résultat attendu : 0.
