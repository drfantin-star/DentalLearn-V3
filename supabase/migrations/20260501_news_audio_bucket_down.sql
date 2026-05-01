-- Nom du fichier : 20260501_news_audio_bucket_down.sql
-- Rollback de : 20260501_news_audio_bucket.sql

-- 1. Drop policies (avant le bucket pour éviter les FK orphelines).
DROP POLICY IF EXISTS "news-audio public read" ON storage.objects;
DROP POLICY IF EXISTS "news-audio service_role insert" ON storage.objects;
DROP POLICY IF EXISTS "news-audio service_role update" ON storage.objects;
DROP POLICY IF EXISTS "news-audio service_role delete" ON storage.objects;

-- 2. Suppression de tous les objets du bucket (sinon DELETE bucket échoue).
DELETE FROM storage.objects WHERE bucket_id = 'news-audio';

-- 3. Suppression du bucket.
DELETE FROM storage.buckets WHERE id = 'news-audio';
