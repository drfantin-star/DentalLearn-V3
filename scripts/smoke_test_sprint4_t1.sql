-- Smoke test Sprint 4 T1
-- Vérifications post-application migration

SELECT 'enum audio_job_status' as check_name,
  EXISTS (SELECT 1 FROM pg_type WHERE typname = 'audio_job_status') as result;

SELECT 'table audio_generation_jobs' as check_name,
  EXISTS (SELECT 1 FROM information_schema.tables
    WHERE table_name = 'audio_generation_jobs' AND table_schema = 'public') as result;

SELECT 'contrainte XOR' as check_name,
  EXISTS (SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'exactly_one_target'
    AND table_name = 'audio_generation_jobs') as result;

SELECT 'RLS activé audio_jobs' as check_name,
  relrowsecurity as result
  FROM pg_class WHERE relname = 'audio_generation_jobs';

SELECT 'colonnes sequences ajoutées' as check_name,
  count(*) = 4 as result
  FROM information_schema.columns
  WHERE table_name = 'sequences' AND table_schema = 'public'
  AND column_name IN ('audio_generated_at', 'audio_chars_consumed', 'audio_cost_eur', 'audio_history');

SELECT 'index status' as check_name,
  EXISTS (SELECT 1 FROM pg_indexes
    WHERE tablename = 'audio_generation_jobs'
    AND indexname = 'audio_jobs_status_idx') as result;
