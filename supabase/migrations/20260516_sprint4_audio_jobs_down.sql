-- Nom du fichier : 20260516_sprint4_audio_jobs_down.sql
-- Rollback Sprint 4 T1 — symetrique de 20260516_sprint4_audio_jobs.sql
DROP TRIGGER IF EXISTS audio_jobs_updated_at ON audio_generation_jobs;
DROP FUNCTION IF EXISTS update_audio_jobs_updated_at();

DROP POLICY IF EXISTS "audio_jobs_update_super_admin" ON audio_generation_jobs;
DROP POLICY IF EXISTS "audio_jobs_insert_super_admin" ON audio_generation_jobs;
DROP POLICY IF EXISTS "audio_jobs_select_super_admin" ON audio_generation_jobs;

DROP TABLE IF EXISTS audio_generation_jobs;
DROP TYPE IF EXISTS audio_job_status;

ALTER TABLE sequences
  DROP COLUMN IF EXISTS audio_history,
  DROP COLUMN IF EXISTS audio_cost_eur,
  DROP COLUMN IF EXISTS audio_chars_consumed,
  DROP COLUMN IF EXISTS audio_generated_at;
