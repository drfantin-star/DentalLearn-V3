-- Nom du fichier : 20260516b_sweep_stale_audio_jobs_cron.sql
-- Date de création : 2026-05-16
-- Ticket : T3 Sprint 4 — Cron sweep-stale-audio-jobs
-- Description : pg_cron — schedule de l'Edge Function sweep-stale-audio-jobs
--               toutes les 5 minutes (marquage 'failed' des jobs bloqués
--               en 'running' depuis > 10 min).
-- Rollback : supabase/migrations/20260516b_sweep_stale_audio_jobs_cron_down.sql

-- ============================================================================
-- NOTE SUPABASE — Timezone cron
-- ============================================================================
-- cron.timezone est figé à GMT côté Supabase (PGC_POSTMASTER, non modifiable).
-- Toutes les expressions cron sont donc encodées en UTC.
--
-- Cadence T3 — 1 job toutes les 5 minutes :
--   '*/5 * * * *'  = audio_sweep_stale_jobs
--
-- L'Edge Function sweep-stale-audio-jobs ne prend pas de paramètres ; elle
-- exécute un UPDATE borné par construction (jobs 'running' avec started_at
-- > 10 min). Charge négligeable, pas de cap nécessaire côté caller.
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
--
-- IMPORTANT : effacer l'historique du SQL Editor Supabase après application
-- (la service_role_key apparaît en clair dans le Run). Onglet "History" →
-- supprimer l'entrée correspondante.

-- ============================================================================
-- 3. Schedule du job T3
-- ============================================================================

DO $mig$
DECLARE
  v_supabase_url text := current_setting('app.supabase_url',     false);
  v_service_key  text := current_setting('app.service_role_key', false);
BEGIN

  -- ── 3.1 audio_sweep_stale_jobs — toutes les 5 minutes ────────────────────
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'audio_sweep_stale_jobs') THEN
    PERFORM cron.unschedule('audio_sweep_stale_jobs');
  END IF;

  PERFORM cron.schedule(
    'audio_sweep_stale_jobs',
    '*/5 * * * *',
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
      v_supabase_url || '/functions/v1/sweep-stale-audio-jobs',
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
--  WHERE jobname = 'audio_sweep_stale_jobs';
--
-- Résultat attendu : 1 ligne, active=true, schedule='*/5 * * * *'.
