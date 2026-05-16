-- Rollback : 20260516b_sweep_stale_audio_jobs_cron.sql
-- Suppression du cron audio_sweep_stale_jobs.

SELECT cron.unschedule('audio_sweep_stale_jobs');
