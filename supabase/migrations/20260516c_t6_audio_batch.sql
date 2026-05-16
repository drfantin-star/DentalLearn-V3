-- Nom du fichier : 20260516c_t6_audio_batch.sql
-- Date de création : 2026-05-16
-- Ticket : Sprint 4 T6 (Batch audio multi-séquences)
-- Description : Ajoute les colonnes `batch_id` (uuid) et `batch_index` (int)
--               sur audio_generation_jobs pour regrouper les jobs créés
--               ensemble par la route POST /api/admin/formations/[id]/audio/
--               batch-generate. Le chaining séquentiel (parallélisme = 1)
--               est porté par la Edge Function audio-generation-worker :
--               à la complétion (succès OU échec) d'un job avec batch_id
--               non null, le worker fire-and-forget le job pending suivant
--               du même batch ordonné par batch_index ASC.
--
--               Pas de FK : un batch est conceptuel, identifié par UUID
--               partagé. Pas de NOT NULL : les jobs mono-séquence existants
--               (T4/T5) restent valides avec batch_id NULL.
--
-- Dépendances : 20260516_sprint4_audio_jobs.sql (table audio_generation_jobs)
-- Rollback : supabase/migrations/20260516c_t6_audio_batch_down.sql

ALTER TABLE audio_generation_jobs
  ADD COLUMN IF NOT EXISTS batch_id uuid NULL;

ALTER TABLE audio_generation_jobs
  ADD COLUMN IF NOT EXISTS batch_index int NULL;

COMMENT ON COLUMN audio_generation_jobs.batch_id IS
  'UUID partagé par les jobs créés ensemble via batch-generate. NULL pour les jobs mono-séquence.';

COMMENT ON COLUMN audio_generation_jobs.batch_index IS
  'Ordre du job dans le batch (0..N-1). Détermine l''ordre de chaining séquentiel par le worker.';

-- Index partiel pour le SELECT next pending du chaining worker
-- (batch_id = ?, status = 'pending', batch_index > ? ORDER BY batch_index ASC LIMIT 1)
-- et pour la route batch-status (batch_id = ? ORDER BY batch_index ASC).
CREATE INDEX IF NOT EXISTS audio_jobs_batch_idx
  ON audio_generation_jobs(batch_id, batch_index)
  WHERE batch_id IS NOT NULL;
