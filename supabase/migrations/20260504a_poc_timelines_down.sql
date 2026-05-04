-- Nom du fichier : 20260504a_poc_timelines_down.sql
-- Rollback de : 20260504a_poc_timelines.sql
-- Ticket : POC-T1 (claude/poc-t1-timelines-migration-va1Xi)
-- Description : Reverse symétrique de la migration POC-T1.
--               Ordre inverse : policies → objets bucket → bucket → colonnes
--               news_syntheses → colonnes sequences.

-- ============================================================================
-- 1. Drop des 4 policies RLS sur le bucket audio-timelines
-- ============================================================================
DROP POLICY IF EXISTS "audio-timelines public read" ON storage.objects;
DROP POLICY IF EXISTS "audio-timelines service_role insert" ON storage.objects;
DROP POLICY IF EXISTS "audio-timelines service_role update" ON storage.objects;
DROP POLICY IF EXISTS "audio-timelines service_role delete" ON storage.objects;

-- ============================================================================
-- 2. Suppression des objets du bucket avant le bucket lui-même
-- ============================================================================
-- Indispensable : DELETE bucket échoue tant qu'il reste des objets (FK).
DELETE FROM storage.objects WHERE bucket_id = 'audio-timelines';

-- ============================================================================
-- 3. Suppression du bucket
-- ============================================================================
DELETE FROM storage.buckets WHERE id = 'audio-timelines';

-- ============================================================================
-- 4. Drop colonnes news_syntheses
-- ============================================================================
ALTER TABLE news_syntheses
  DROP COLUMN IF EXISTS timeline_published;

ALTER TABLE news_syntheses
  DROP COLUMN IF EXISTS timeline_url;

-- ============================================================================
-- 5. Drop colonnes sequences
-- ============================================================================
ALTER TABLE sequences
  DROP COLUMN IF EXISTS timeline_published;

ALTER TABLE sequences
  DROP COLUMN IF EXISTS timeline_url;
