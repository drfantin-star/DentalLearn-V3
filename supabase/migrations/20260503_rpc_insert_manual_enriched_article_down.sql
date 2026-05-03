-- Nom du fichier : 20260503_rpc_insert_manual_enriched_article_down.sql
-- Date de création : 2026-05-03
-- Ticket : T7-ter — Ingestion manuelle enrichie News (rollback)
-- Description : rollback symétrique de
--               20260503_rpc_insert_manual_enriched_article.sql.
--               Supprime la fonction, retire la source virtuelle
--               'manual_admin' et restaure la contrainte CHECK d'origine.

-- ATTENTION : ce rollback échoue si des news_raw ou news_syntheses
-- pointent encore sur la source 'manual_admin' (FK + CHECK).
-- Avant rollback, archiver/supprimer manuellement les enregistrements
-- concernés ou réaffecter leur source_id.

-- ============================================================================
-- 1. Drop de la fonction RPC
-- ============================================================================

DROP FUNCTION IF EXISTS public.insert_manual_enriched_article(
  text, uuid, jsonb,
  text, text, text, text, text[],
  text, text, text, text, text[], text, text, text, text,
  vector, uuid
);

-- ============================================================================
-- 2. Suppression de la source virtuelle manual_admin
-- ============================================================================

DELETE FROM public.news_sources WHERE type = 'manual_admin';

-- ============================================================================
-- 3. Restauration de la contrainte CHECK d'origine
-- ============================================================================

ALTER TABLE public.news_sources
  DROP CONSTRAINT IF EXISTS news_sources_type_check;

ALTER TABLE public.news_sources
  ADD CONSTRAINT news_sources_type_check
  CHECK (type = ANY (ARRAY[
    'pubmed'::text,
    'rss'::text,
    'crossref'::text,
    'semantic_scholar'::text,
    'openalex'::text,
    'manual'::text
  ]));
