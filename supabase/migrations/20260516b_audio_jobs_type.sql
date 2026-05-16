-- Nom du fichier : 20260516b_audio_jobs_type.sql
-- Date de création : 2026-05-16
-- Ticket : T5-bis-B (POC visualisation audio — extract-scenes fire-and-forget)
-- Description : Ajoute la colonne `job_type` sur audio_generation_jobs pour
--               distinguer les jobs de génération ElevenLabs (créés par Sprint
--               4) des jobs d'extraction de scènes Sonnet (créés par T5-bis-B).
--               Permet à la page admin extract-scenes de tracker un job
--               asynchrone via la même infrastructure que les jobs audio,
--               tout en restant identifiable au polling et au sweep.
--
--               Backfill implicite par DEFAULT 'elevenlabs_generation' : les
--               lignes pré-existantes (créées par Sprint 4 T1+T2) restent
--               cohérentes avec leur sémantique d'origine.
--
-- Dépendances : 20260516_sprint4_audio_jobs.sql (table audio_generation_jobs)
-- Rollback : supabase/migrations/20260516b_audio_jobs_type_down.sql

ALTER TABLE audio_generation_jobs
  ADD COLUMN IF NOT EXISTS job_type text NOT NULL DEFAULT 'elevenlabs_generation';

COMMENT ON COLUMN audio_generation_jobs.job_type IS
  'Type de job : elevenlabs_generation | scene_extraction. Discriminant pour le polling UI et le sweep stale.';

-- Index partiel sur les jobs en cours d'extraction — la page admin
-- extract-scenes peut polluer ce statut pour afficher l'historique des runs
-- récents par séquence sans scanner toute la table.
CREATE INDEX IF NOT EXISTS audio_jobs_scene_extraction_idx
  ON audio_generation_jobs(sequence_id, created_at DESC)
  WHERE job_type = 'scene_extraction';
