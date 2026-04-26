-- Nom du fichier : 20260426_news_ingest_rss_cron.sql
-- Date de création : 2026-04-26
-- Ticket : feature/news-ticket-3
-- Description : pg_cron — ajout du job news_ingest_rss (lundi 04h30 UTC, équivalent Europe/Paris en heure d'été UTC+2)
-- Rollback : supabase/migrations/20260426_news_ingest_rss_cron_down.sql

-- ============================================================================
-- NOTE SUPABASE — Timezone cron
-- ============================================================================
-- Convention héritée du Ticket 2 (cf. 20260423_news_cron_schedules.sql) :
-- cron.timezone est figé à GMT côté Supabase (PGC_POSTMASTER, non modifiable
-- par l'utilisateur), et la signature cron.schedule(..., timezone => ...) de
-- pg_cron 1.6 n'est pas exposée. Toutes les expressions cron sont donc
-- encodées en UTC pour correspondre à Europe/Paris en heure d'été (UTC+2).
--
-- Cadence hebdo News Phase 1 — résumé pour reviewers :
--   '30 3 * * 1' = check_retractions  (lundi 03h30 UTC = 05h30 Paris été)
--   '0 4 * * 1'  = ingest_pubmed      (lundi 04h00 UTC = 06h00 Paris été)
--   '30 4 * * 1' = ingest_rss         (lundi 04h30 UTC = 06h30 Paris été)  ← ce ticket
--
-- Décalage d'1h en hiver accepté (jobs plus tôt, aucun impact fonctionnel).
-- ============================================================================

-- ============================================================================
-- 1. EXTENSION pg_cron
-- ============================================================================
-- Déjà installée par 20260423_news_cron_schedules.sql. Le IF NOT EXISTS rend
-- cette migration rejouable même si pg_cron est manquant (cas d'un projet
-- restauré à partir d'un dump SQL non incluant pg_cron).

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- 2. Pré-requis d'exécution — paramètres de session
-- ============================================================================
-- Avant d'exécuter cette migration, exécuter les 2 SET ci-dessous DANS LE
-- MÊME Run que le reste du script (chaque Run du SQL Editor est une session
-- PostgreSQL indépendante, les GUC de session ne persistent pas entre Runs).
--
--   SET app.supabase_url      TO 'https://dxybsuhfkwuemapqrvgz.supabase.co';
--   SET app.service_role_key  TO '<SUPABASE_SERVICE_ROLE_KEY>';
--
-- Les 2 GUC sont locales à la session et ne persistent jamais en BDD. Les
-- valeurs sont résolues par current_setting() dans le DO block, puis gelées
-- littéralement dans cron.job.command via format(%L) au moment du
-- cron.schedule(). Re-exécuter cette migration après rotation de la clé
-- nécessite d'abord d'appliquer le _down.sql puis de relancer cette
-- migration avec la nouvelle clé.

-- ============================================================================
-- 3. Schedule — argument positionnel (seule signature exposée par Supabase)
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN
  -- 3.0 Clean slate défensive — rend la migration rejouable.
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'news_ingest_rss') THEN
    PERFORM cron.unschedule('news_ingest_rss');
  END IF;

  -- 3.1 Ingestion RSS — lundi 04h30 UTC (= 06h30 Paris en été).
  -- Tourne 30 min après ingest_pubmed pour éviter contention sur les write
  -- de news_raw. La cadence régulière (03h30 / 04h00 / 04h30) facilite le
  -- suivi en logs et le futur ajout de jobs Tickets 4-7.
  -- Signature 3-args positionnelle (seule exposée par Supabase) :
  --   cron.schedule(job_name text, schedule text, command text)
  PERFORM cron.schedule(
    'news_ingest_rss',
    '30 4 * * 1',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{}'::jsonb
      );
      $cmd$,
      v_supabase_url || '/functions/v1/ingest_rss',
      'Bearer ' || v_service_key
    )
  );
END
$mig$;

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ du bloc 1-3 ci-dessus,
--    conformément à la règle ping-pong du README supabase/migrations/)
-- ============================================================================
-- SELECT jobid, jobname, schedule, active, command
--   FROM cron.job
--  WHERE jobname = 'news_ingest_rss';
--
-- Résultat attendu : 1 ligne avec active=true, schedule='30 4 * * 1',
-- command contenant l'URL /functions/v1/ingest_rss.
