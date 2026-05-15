-- Nom du fichier : 20260515_sprint2_t7_crons.sql
-- Date de création : 2026-05-15
-- Ticket : T7 Sprint 2 — Crons live_session_reminders + notify_followers_new_publication
-- Description : pg_cron — ajout des 2 jobs horaires T7
-- Rollback : supabase/migrations/20260515_sprint2_t7_crons_down.sql

-- ============================================================================
-- NOTE SUPABASE — Timezone cron
-- ============================================================================
-- Convention héritée des Tickets 2-5 : cron.timezone est figé à GMT côté
-- Supabase (PGC_POSTMASTER, non modifiable). Toutes les expressions cron
-- sont donc encodées en UTC.
--
-- Cadence T7 — 2 nouveaux jobs horaires :
--   '0 * * * *'   = live_session_reminders         (toutes les heures, pile)
--   '30 * * * *'  = notify_followers_new_publication (toutes les heures, +30min)
--
-- Le décalage de 30min évite le cumul de charge avec live_session_reminders.
-- Les deux fonctions sont bornées à {"limit": 50} pour rester sous
-- IDLE_TIMEOUT 150s des Edge Functions Supabase.
-- ============================================================================

-- ============================================================================
-- 1. EXTENSION pg_cron
-- ============================================================================

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

-- ============================================================================
-- 3. Schedule des 2 jobs T7
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN

  -- ── 3.1 live_session_reminders — toutes les heures, pile ──────────────────
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'live_session_reminders') THEN
    PERFORM cron.unschedule('live_session_reminders');
  END IF;

  PERFORM cron.schedule(
    'live_session_reminders',
    '0 * * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 50}'::jsonb
      );
      $cmd$,
      v_supabase_url || '/functions/v1/live_session_reminders',
      'Bearer ' || v_service_key
    )
  );

  -- ── 3.2 notify_followers_new_publication — toutes les heures, +30min ──────
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify_followers_new_publication') THEN
    PERFORM cron.unschedule('notify_followers_new_publication');
  END IF;

  PERFORM cron.schedule(
    'notify_followers_new_publication',
    '30 * * * *',
    format(
      $cmd$
      SELECT net.http_post(
        url     := %L,
        headers := jsonb_build_object(
          'Authorization', %L,
          'Content-Type',  'application/json'
        ),
        body    := '{"limit": 50}'::jsonb
      );
      $cmd$,
      v_supabase_url || '/functions/v1/notify_followers_new_publication',
      'Bearer ' || v_service_key
    )
  );

END
$mig$;

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT jobname, schedule, active
--   FROM cron.job
--  WHERE jobname IN (
--    'live_session_reminders',
--    'notify_followers_new_publication'
--  )
--  ORDER BY schedule;
--
-- Résultat attendu : 2 lignes, toutes active=true.
