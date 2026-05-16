-- Nom du fichier : 20260516a_sprint4_audio_jobs_lints_fix.sql
-- Date de création : 2026-05-16
-- Ticket : Sprint 4 T1 — correctifs advisors (claude/migrate-audio-backend-GF96z)
-- Description : Correctifs lints Supabase introduits par 20260516_sprint4_audio_jobs.sql :
--   1. function_search_path_mutable (WARN security) sur update_audio_jobs_updated_at
--      → ajout SET search_path = public, pg_temp (pattern projet)
--   2. auth_rls_initplan (WARN perf x3) sur les 3 policies RLS de audio_generation_jobs
--      → wrap auth.uid() dans (SELECT auth.uid()) pour evaluation unique par requete
-- Rollback : supabase/migrations/20260516a_sprint4_audio_jobs_lints_fix_down.sql

-- 1. Fix function search_path
CREATE OR REPLACE FUNCTION update_audio_jobs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 2. Fix RLS initplan : recreer les 3 policies avec (SELECT auth.uid())
DROP POLICY IF EXISTS "audio_jobs_select_super_admin" ON audio_generation_jobs;
DROP POLICY IF EXISTS "audio_jobs_insert_super_admin" ON audio_generation_jobs;
DROP POLICY IF EXISTS "audio_jobs_update_super_admin" ON audio_generation_jobs;

CREATE POLICY "audio_jobs_select_super_admin"
  ON audio_generation_jobs FOR SELECT
  TO authenticated
  USING (is_super_admin((SELECT auth.uid())));

CREATE POLICY "audio_jobs_insert_super_admin"
  ON audio_generation_jobs FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin((SELECT auth.uid())));

CREATE POLICY "audio_jobs_update_super_admin"
  ON audio_generation_jobs FOR UPDATE
  TO authenticated
  USING (is_super_admin((SELECT auth.uid())));
