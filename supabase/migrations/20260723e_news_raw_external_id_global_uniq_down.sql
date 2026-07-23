-- Nom du fichier : 20260723e_news_raw_external_id_global_uniq_down.sql
-- Date de création : 2026-07-23
-- Ticket : news-pipeline-dedup-sizing
-- Description : Rollback — restaure l'unique composite (source_id, external_id)
-- Rollback : n/a (ce fichier EST le rollback de 20260723e_news_raw_external_id_global_uniq.sql)

-- ============================================================================
-- 1. Drop de l'unique global
-- ============================================================================

ALTER TABLE public.news_raw DROP CONSTRAINT IF EXISTS news_raw_external_id_uniq;

-- ============================================================================
-- 2. Restore de l'unique composite d'origine
-- ============================================================================

ALTER TABLE public.news_raw ADD CONSTRAINT news_raw_source_external_uniq UNIQUE (source_id, external_id);

COMMENT ON TABLE public.news_raw IS
  'Articles bruts ingérés (PubMed, RSS, Crossref, etc.). Dédoublonnés par (source_id, external_id). raw_payload conserve la réponse intégrale de l''API/RSS pour traçabilité et reparsing éventuel.';

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'public.news_raw'::regclass;
--
-- Résultat attendu : news_raw_source_external_uniq | UNIQUE (source_id, external_id)
-- et absence de news_raw_external_id_uniq.
