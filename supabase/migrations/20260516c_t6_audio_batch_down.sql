-- Nom du fichier : 20260516c_t6_audio_batch_down.sql
-- Date de création : 2026-05-16
-- Ticket : Sprint 4 T6 (rollback de 20260516c_t6_audio_batch.sql)
-- Description : Supprime l'index partiel batch et les colonnes batch_id /
--               batch_index. À n'exécuter que si T6 est entièrement reverté
--               côté code applicatif (route batch-generate, batch-status,
--               composant FormationAudioBatchBlock, chaining worker).

DROP INDEX IF EXISTS audio_jobs_batch_idx;

ALTER TABLE audio_generation_jobs
  DROP COLUMN IF EXISTS batch_index;

ALTER TABLE audio_generation_jobs
  DROP COLUMN IF EXISTS batch_id;
