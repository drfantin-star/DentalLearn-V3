-- Nom du fichier : 20260501_news_audio_bucket.sql
-- Date de création : 2026-05-01
-- Ticket : feature/news-audio (claude/news-feature-tickets-RQVvz)
-- Description : Création du bucket Storage "news-audio" + RLS policies pour
--               héberger les MP3 produits par ElevenLabs (text-to-dialogue).
-- Rollback : supabase/migrations/20260501_news_audio_bucket_down.sql

-- ============================================================================
-- 1. Création du bucket
-- ============================================================================
-- Public en lecture (les fichiers MP3 sont consommés par /api/news/episodes
-- côté front sans auth, comme le bucket "formations"). Insert/update/delete
-- réservés au service_role (côté API admin).
--
-- ON CONFLICT : la migration est idempotente, un re-run ne casse rien si le
-- bucket existe déjà avec des paramètres différents (UPDATE des champs).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'news-audio',
  'news-audio',
  true,
  52428800,                       -- 50 MB
  ARRAY['audio/mpeg']::text[]     -- MP3 uniquement
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- 2. RLS policies sur storage.objects
-- ============================================================================
-- RLS est déjà ENABLE par défaut sur storage.objects côté Supabase. On ajoute
-- 4 policies dédiées au bucket news-audio :
--   - SELECT public (anon + authenticated) : lecture des MP3 sans auth
--   - INSERT/UPDATE/DELETE service_role : écriture côté API admin uniquement
--
-- Les policies sont DROP IF EXISTS pour garantir l'idempotence du re-run.

DROP POLICY IF EXISTS "news-audio public read" ON storage.objects;
CREATE POLICY "news-audio public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'news-audio');

DROP POLICY IF EXISTS "news-audio service_role insert" ON storage.objects;
CREATE POLICY "news-audio service_role insert"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'news-audio');

DROP POLICY IF EXISTS "news-audio service_role update" ON storage.objects;
CREATE POLICY "news-audio service_role update"
  ON storage.objects FOR UPDATE
  TO service_role
  USING (bucket_id = 'news-audio')
  WITH CHECK (bucket_id = 'news-audio');

DROP POLICY IF EXISTS "news-audio service_role delete" ON storage.objects;
CREATE POLICY "news-audio service_role delete"
  ON storage.objects FOR DELETE
  TO service_role
  USING (bucket_id = 'news-audio');

-- ============================================================================
-- 3. Vérification (RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT id, name, public, file_size_limit, allowed_mime_types
--   FROM storage.buckets
--  WHERE id = 'news-audio';
--
-- SELECT polname, polcmd, polroles::regrole[]
--   FROM pg_policy p
--   JOIN pg_class c ON c.oid = p.polrelid
--  WHERE c.relname = 'objects'
--    AND polname LIKE 'news-audio%'
--  ORDER BY polname;
