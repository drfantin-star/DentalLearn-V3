-- Nom du fichier : 20260516_sprint4_audio_jobs.sql
-- Date de création : 2026-05-16
-- Ticket : Sprint 4 T1 (claude/migrate-audio-backend-GF96z)
-- Description : Pipeline Audio Unifié. Crée la table audio_generation_jobs
--               (suivi des jobs de génération ElevenLabs pour formations &
--               news) + l'enum audio_job_status + extensions additives sur
--               la table sequences (traçabilité régénérations, coûts).
-- Dépendances : sequences (existant), news_episodes (existant),
--               auth.users (existant), is_super_admin() (Sprint 1).
-- Rollback : supabase/migrations/20260516_sprint4_audio_jobs_down.sql

-- 1. Enum statut job
CREATE TYPE audio_job_status AS ENUM (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

-- 2. Table principale
CREATE TABLE audio_generation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lien vers le contenu (XOR : exactement l'un des deux doit etre non-NULL)
  sequence_id uuid REFERENCES sequences(id) ON DELETE CASCADE,
  news_episode_id uuid REFERENCES news_episodes(id) ON DELETE CASCADE,

  -- Qui a declenche
  triggered_by uuid NOT NULL REFERENCES auth.users(id),

  -- Statut
  status audio_job_status NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  completed_at timestamptz,

  -- Inputs
  script_text text NOT NULL,
  with_timestamps boolean NOT NULL DEFAULT true,

  -- Outputs
  audio_url text,
  timeline_url text,
  duration_sec int,
  chars_consumed int,
  cost_eur numeric(10, 4),

  -- Erreurs et retry
  error_log jsonb,
  retry_count int NOT NULL DEFAULT 0,

  -- Timestamps
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Contrainte XOR : exactement une cible
  CONSTRAINT exactly_one_target CHECK (
    (sequence_id IS NOT NULL AND news_episode_id IS NULL) OR
    (sequence_id IS NULL AND news_episode_id IS NOT NULL)
  )
);

-- 3. Index
CREATE INDEX audio_jobs_sequence_idx
  ON audio_generation_jobs(sequence_id)
  WHERE sequence_id IS NOT NULL;

CREATE INDEX audio_jobs_news_episode_idx
  ON audio_generation_jobs(news_episode_id)
  WHERE news_episode_id IS NOT NULL;

CREATE INDEX audio_jobs_status_idx
  ON audio_generation_jobs(status)
  WHERE status IN ('pending', 'running');

CREATE INDEX audio_jobs_triggered_by_idx
  ON audio_generation_jobs(triggered_by);

CREATE INDEX audio_jobs_created_at_idx
  ON audio_generation_jobs(created_at DESC);

-- 4. RLS
ALTER TABLE audio_generation_jobs ENABLE ROW LEVEL SECURITY;

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

-- 5. Extensions table sequences (colonnes additives)
ALTER TABLE sequences
  ADD COLUMN IF NOT EXISTS audio_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS audio_chars_consumed int,
  ADD COLUMN IF NOT EXISTS audio_cost_eur numeric(10, 4),
  ADD COLUMN IF NOT EXISTS audio_history jsonb NOT NULL DEFAULT '[]'::jsonb;

-- audio_history : array de { audio_url, generated_at, replaced_at, chars, cost_eur }
-- Conservation indefinie (faible volume JSONB, tracabilite des regenerations)

-- 6. Trigger updated_at sur audio_generation_jobs
CREATE OR REPLACE FUNCTION update_audio_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audio_jobs_updated_at
  BEFORE UPDATE ON audio_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION update_audio_jobs_updated_at();
