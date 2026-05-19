-- Nom du fichier : 20260519_sequences_script_text.sql
-- Date de création : 2026-05-19
-- Ticket : §8 handoff timeline dashboard — mode approx_sec fallback Sonnet
-- Description : Ajoute la colonne `script_text` sur sequences pour permettre
--               à la route extract-scenes (et son Edge Function miroir) de
--               relancer l'extraction Sonnet en mode `approx_sec` lorsque
--               `timeline_url IS NULL` (séquences générées via le dashboard
--               sans timeline word-index produite par ElevenLabs — cf.
--               D-S4-T5dette-02 + handoff 19 mai 2026).
--
--               Backfill depuis audio_generation_jobs : pour chaque séquence
--               sans script_text mais avec un job ElevenLabs completed, on
--               copie le script du dernier job. Les séquences historiques
--               (pipeline Python local, jamais passées par le dashboard)
--               restent script_text=NULL — l'admin doit utiliser le bouton
--               "Uploader une timeline (.json)" §9 plutôt que extract-scenes.
--
-- Dépendances : 20260516_sprint4_audio_jobs.sql (audio_generation_jobs)
-- Rollback : supabase/migrations/20260519_sequences_script_text_down.sql

ALTER TABLE sequences
  ADD COLUMN IF NOT EXISTS script_text text;

COMMENT ON COLUMN sequences.script_text IS
  'Script dialogue Sophie/Martin source de l''audio. Renseigné automatiquement par le worker audio-generation-worker à la première génération réussie. Utilisé en fallback par extract-scenes-formation en mode approx_sec quand timeline_url IS NULL.';

-- Backfill : dernier job ElevenLabs completed par séquence.
UPDATE sequences s
SET script_text = j.script_text
FROM (
  SELECT DISTINCT ON (sequence_id)
    sequence_id,
    script_text
  FROM audio_generation_jobs
  WHERE status = 'completed'
    AND sequence_id IS NOT NULL
    AND script_text IS NOT NULL
    AND length(trim(script_text)) > 0
    AND (job_type = 'elevenlabs_generation' OR job_type IS NULL)
  ORDER BY sequence_id, completed_at DESC NULLS LAST
) j
WHERE s.id = j.sequence_id
  AND s.script_text IS NULL;
