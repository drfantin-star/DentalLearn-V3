-- Rollback Sprint 4 T1 lints fix — restaure l'etat post-20260516_sprint4_audio_jobs.sql
-- Note : seule la version "non-optimisee" est restauree ; les lints reapparaitraient.

CREATE OR REPLACE FUNCTION update_audio_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP POLICY IF EXISTS "audio_jobs_select_super_admin" ON audio_generation_jobs;
DROP POLICY IF EXISTS "audio_jobs_insert_super_admin" ON audio_generation_jobs;
DROP POLICY IF EXISTS "audio_jobs_update_super_admin" ON audio_generation_jobs;

CREATE POLICY "audio_jobs_select_super_admin"
  ON audio_generation_jobs FOR SELECT
  TO authenticated
  USING (is_super_admin(auth.uid()));

CREATE POLICY "audio_jobs_insert_super_admin"
  ON audio_generation_jobs FOR INSERT
  TO authenticated
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "audio_jobs_update_super_admin"
  ON audio_generation_jobs FOR UPDATE
  TO authenticated
  USING (is_super_admin(auth.uid()));
