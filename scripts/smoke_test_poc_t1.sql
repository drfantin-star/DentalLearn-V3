-- Nom du fichier : scripts/smoke_test_poc_t1.sql
-- Date : 2026-05-04
-- Ticket : POC-T1 (claude/poc-t1-timelines-migration-va1Xi)
-- Usage  : exécuter ces 4 requêtes une à une dans le SQL Editor Supabase
--          APRÈS avoir appliqué supabase/migrations/20260504a_poc_timelines.sql.
--          Comparer chaque résultat avec le bloc "attendu".

-- ============================================================================
-- 1. Colonnes sequences
-- ============================================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'sequences'
  AND column_name IN ('timeline_url', 'timeline_published')
ORDER BY column_name;
-- attendu : 2 lignes
--   timeline_published | boolean | NO  | false
--   timeline_url       | text    | YES | (NULL)

-- ============================================================================
-- 2. Colonnes news_syntheses
-- ============================================================================
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'news_syntheses'
  AND column_name IN ('timeline_url', 'timeline_published')
ORDER BY column_name;
-- attendu : 2 lignes
--   timeline_published | boolean | NO  | false
--   timeline_url       | text    | YES | (NULL)

-- ============================================================================
-- 3. Bucket audio-timelines
-- ============================================================================
SELECT id, name, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'audio-timelines';
-- attendu : 1 ligne
--   id=audio-timelines, name=audio-timelines, public=true,
--   file_size_limit=5242880, allowed_mime_types={application/json}

-- ============================================================================
-- 4. Policies RLS sur le bucket audio-timelines
-- ============================================================================
SELECT policyname, cmd, qual::text AS using_clause
FROM pg_policies
WHERE tablename = 'objects'
  AND schemaname = 'storage'
  AND policyname LIKE 'audio-timelines%'
ORDER BY policyname;
-- attendu : 4 lignes
--   audio-timelines public read           | SELECT | (bucket_id = 'audio-timelines')
--   audio-timelines service_role delete   | DELETE | (bucket_id = 'audio-timelines')
--   audio-timelines service_role insert   | INSERT | (NULL)   -- INSERT n'a que WITH CHECK
--   audio-timelines service_role update   | UPDATE | (bucket_id = 'audio-timelines')
