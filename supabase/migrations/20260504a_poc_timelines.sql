-- Nom du fichier : 20260504a_poc_timelines.sql
-- Date de création : 2026-05-04
-- Ticket : POC-T1 (claude/poc-t1-timelines-migration-va1Xi)
-- Spec : spec_poc_visualisation_audio_v1_0 §10 Ticket 1
-- Description : Infrastructure de stockage des timelines enrichies (transcript
--               karaoké + scènes whiteboard) pour les formations et les news.
--               Additif strict :
--                 1. Colonnes timeline_url + timeline_published sur sequences
--                 2. Colonnes timeline_url + timeline_published sur news_syntheses
--                 3. Bucket Storage audio-timelines (public read, service_role write)
--                 4. 4 policies RLS sur le bucket
--               Pattern RLS aligné sur 20260501_news_audio_bucket.sql
--               (TO service_role pour INSERT/UPDATE/DELETE, TO public pour SELECT).
--               Aucune modification des colonnes ou policies existantes.
-- Rollback : supabase/migrations/20260504a_poc_timelines_down.sql

-- ============================================================================
-- 1. Colonnes additives sur sequences
-- ============================================================================
ALTER TABLE sequences
  ADD COLUMN IF NOT EXISTS timeline_url text NULL;

ALTER TABLE sequences
  ADD COLUMN IF NOT EXISTS timeline_published boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN sequences.timeline_url IS
  'URL Supabase Storage du fichier timeline.json (POC visualisation audio). NULL = pas de timeline.';

COMMENT ON COLUMN sequences.timeline_published IS
  'Si TRUE et timeline_url non NULL, le rendu enrichi est affiché côté user.';

-- ============================================================================
-- 2. Colonnes additives sur news_syntheses
-- ============================================================================
ALTER TABLE news_syntheses
  ADD COLUMN IF NOT EXISTS timeline_url text NULL;

ALTER TABLE news_syntheses
  ADD COLUMN IF NOT EXISTS timeline_published boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN news_syntheses.timeline_url IS
  'URL Supabase Storage du fichier timeline.json (POC visualisation audio). NULL = pas de timeline.';

COMMENT ON COLUMN news_syntheses.timeline_published IS
  'Si TRUE et timeline_url non NULL, le rendu enrichi est affiché côté user.';

-- ============================================================================
-- 3. Bucket Storage audio-timelines
-- ============================================================================
-- Public en lecture (les timelines sont consommées par les pages /demo/* et
-- /formations/* côté front sans auth, comme news-audio). INSERT/UPDATE/DELETE
-- réservés au service_role : les écritures viennent du pipeline Python
-- generate_audio.py (T2), de la route LLM d'extraction (T5) et de la page
-- admin de validation (T6), toutes via service_role.
--
-- ON CONFLICT : pattern aligné sur news-audio. Re-run synchronise les
-- paramètres si on change file_size_limit ou allowed_mime_types un jour.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-timelines',
  'audio-timelines',
  true,
  5242880,                                  -- 5 MB max par timeline JSON
  ARRAY['application/json']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 4. RLS policies sur storage.objects pour le bucket audio-timelines
-- ============================================================================
-- RLS est déjà ENABLE par défaut sur storage.objects côté Supabase. On ajoute
-- 4 policies dédiées au bucket audio-timelines :
--   - SELECT public (anon + authenticated) : lecture des timelines sans auth
--   - INSERT/UPDATE/DELETE service_role : écriture côté API admin / scripts
--
-- Les policies sont DROP IF EXISTS pour garantir l'idempotence du re-run.

DROP POLICY IF EXISTS "audio-timelines public read" ON storage.objects;
CREATE POLICY "audio-timelines public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'audio-timelines');

DROP POLICY IF EXISTS "audio-timelines service_role insert" ON storage.objects;
CREATE POLICY "audio-timelines service_role insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'audio-timelines');

DROP POLICY IF EXISTS "audio-timelines service_role update" ON storage.objects;
CREATE POLICY "audio-timelines service_role update"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'audio-timelines')
  WITH CHECK (bucket_id = 'audio-timelines');

DROP POLICY IF EXISTS "audio-timelines service_role delete" ON storage.objects;
CREATE POLICY "audio-timelines service_role delete"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'audio-timelines');

-- ============================================================================
-- 5. Vérification (RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- Voir scripts/smoke_test_poc_t1.sql pour les requêtes de validation.
