-- Smoke test Sprint 4 T3 — job-tracker + cron sweep stale jobs
-- À exécuter manuellement dans SQL Editor Supabase.

-- ============================================================================
-- 1. Vérifier que le cron audio_sweep_stale_jobs est enregistré
-- ============================================================================
SELECT 'cron audio_sweep_stale_jobs' AS check_name,
  EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'audio_sweep_stale_jobs'
  ) AS result;

-- ============================================================================
-- 2. Vérifier le schedule et l'état actif
-- ============================================================================
SELECT jobname, schedule, active
  FROM cron.job
 WHERE jobname = 'audio_sweep_stale_jobs';
-- Résultat attendu : 1 ligne, '*/5 * * * *', active=true

-- ============================================================================
-- 3. Test fonctionnel sweepStaleJobs (simulation d'un job stale)
-- ============================================================================
-- ATTENTION : ne PAS exécuter en prod sans rollback (la section est en
-- commentaire bloc, à dé-commenter si besoin).
--
-- Le test :
--   a. Insère un job de test en 'running' depuis 15 min
--   b. Exécute la même requête que sweepStaleJobs / Edge Function
--   c. Nettoie la row de test

/*
-- a. Insertion d'un job stale (UUID admin Julie en triggered_by)
INSERT INTO audio_generation_jobs (
  sequence_id, triggered_by, status, script_text, with_timestamps, started_at
) VALUES (
  (SELECT id FROM sequences LIMIT 1),
  'af506ec2-a281-4485-a504-b0633c8d2362',
  'running',
  'Test stale job (smoke T3)',
  true,
  now() - interval '15 minutes'
);

-- b. Sweep manuel (même UPDATE que l'Edge Function)
UPDATE audio_generation_jobs
   SET status       = 'failed',
       completed_at = now(),
       updated_at   = now(),
       error_log    = jsonb_build_object(
         'message',   'Job marked as failed by stale sweep (running > 10 min)',
         'timestamp', now()::text
       )
 WHERE status      = 'running'
   AND started_at  < now() - interval '10 minutes'
RETURNING id, status, error_log;

-- c. Nettoyage
DELETE FROM audio_generation_jobs WHERE script_text = 'Test stale job (smoke T3)';
*/
