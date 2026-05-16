-- Nom du fichier : 20260516b_audio_jobs_type_down.sql
-- Date de création : 2026-05-16
-- Ticket : T5-bis-B (rollback de 20260516b_audio_jobs_type.sql)
-- Description : Supprime l'index partiel et la colonne job_type ajoutés
--               par la migration up. Les jobs scene_extraction perdent
--               leur discriminant — à n'exécuter que si T5-bis-B est
--               entièrement reverté côté code applicatif.

DROP INDEX IF EXISTS audio_jobs_scene_extraction_idx;

ALTER TABLE audio_generation_jobs
  DROP COLUMN IF EXISTS job_type;
