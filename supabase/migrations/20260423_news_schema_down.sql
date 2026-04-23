-- Nom du fichier : 20260423_news_schema_down.sql
-- Date de création : 2026-04-23
-- Ticket : feature/news-ticket-1
-- Description : Rollback symétrique de 20260423_news_schema.sql (policies + indexes + tables + ext)
-- Rollback : n/a (ce fichier EST le rollback de 20260423_news_schema.sql)

-- ============================================================================
-- AVERTISSEMENT
-- ============================================================================
-- Ce fichier n'est PAS exécuté en temps normal. Il sert uniquement à annuler
-- la migration 20260423_news_schema.sql en cas de problème. Idempotent (tous
-- les DROP sont IF EXISTS) et suit l'ordre inverse des opérations de la
-- migration parente.
--
-- Pas de CASCADE : si un DROP TABLE échoue sur une FK résiduelle, c'est que
-- l'ordre est cassé OU qu'un objet externe s'est créé entre-temps — on
-- veut que ça pète à la review pour diagnostiquer, pas silencieusement.
-- ============================================================================

-- ============================================================================
-- 1. DROP POLICIES (ordre inverse — même ordre que les tables ci-dessous)
-- ============================================================================

DROP POLICY IF EXISTS "Service role full access" ON public.news_episode_items;
DROP POLICY IF EXISTS "Service role full access" ON public.news_references;
DROP POLICY IF EXISTS "Service role full access" ON public.news_cs_comments;
DROP POLICY IF EXISTS "Service role full access" ON public.news_corrections;
DROP POLICY IF EXISTS "Service role full access" ON public.news_episodes;
DROP POLICY IF EXISTS "Service role full access" ON public.news_syntheses;
DROP POLICY IF EXISTS "Service role full access" ON public.news_scored;
DROP POLICY IF EXISTS "Service role full access" ON public.news_raw;
DROP POLICY IF EXISTS "Service role full access" ON public.news_sources;
DROP POLICY IF EXISTS "Service role full access" ON public.news_taxonomy;

-- ============================================================================
-- 2. DROP INDEXES (ordre inverse strict : section 3.4 → 3.3 → 3.2 → 3.1)
-- ============================================================================

-- --- 2.1. Contraintes d'unicité partielle (section 3.4 du schema) -----------
DROP INDEX IF EXISTS public.news_episodes_type_week_uniq;
DROP INDEX IF EXISTS public.news_scored_dedupe_hash_uniq;

-- --- 2.2. Filtres pipeline (section 3.3) ------------------------------------
DROP INDEX IF EXISTS public.news_syntheses_created_at_idx;
DROP INDEX IF EXISTS public.news_episodes_week_iso_idx;
DROP INDEX IF EXISTS public.news_episodes_status_idx;
DROP INDEX IF EXISTS public.news_syntheses_status_idx;
DROP INDEX IF EXISTS public.news_scored_status_idx;

-- --- 2.3. Colonnes de foreign key (section 3.2) -----------------------------
DROP INDEX IF EXISTS public.news_corrections_episode_id_idx;
DROP INDEX IF EXISTS public.news_cs_comments_episode_id_idx;
DROP INDEX IF EXISTS public.news_references_episode_id_idx;
DROP INDEX IF EXISTS public.news_episode_items_synthesis_id_idx;
DROP INDEX IF EXISTS public.news_episode_items_episode_id_idx;
DROP INDEX IF EXISTS public.news_syntheses_raw_id_idx;
DROP INDEX IF EXISTS public.news_syntheses_scored_id_idx;
DROP INDEX IF EXISTS public.news_scored_raw_id_idx;
DROP INDEX IF EXISTS public.news_raw_source_id_idx;

-- --- 2.4. Recherche Knowledge Base (section 3.1) ----------------------------
DROP INDEX IF EXISTS public.news_syntheses_fulltext_idx;
DROP INDEX IF EXISTS public.news_syntheses_themes_idx;
DROP INDEX IF EXISTS public.news_syntheses_spe_idx;
DROP INDEX IF EXISTS public.news_syntheses_embedding_idx;

-- ============================================================================
-- 3. DROP TABLES (ordre inverse des dépendances FK, SANS CASCADE)
-- ============================================================================
-- Logique : enfants d'abord, parents ensuite. Parmi les tables filles de
-- news_episodes (items, references, cs_comments, corrections), l'ordre interne
-- est arbitraire (elles ne se référencent pas entre elles) — on suit celui du
-- plan de review pour lisibilité.
--
-- La contrainte news_sources_name_uniq est déclarée au niveau de la table
-- dans 20260423_news_schema.sql (pas via ALTER a posteriori). Elle est
-- détruite automatiquement par DROP TABLE news_sources — pas de DROP
-- CONSTRAINT explicite nécessaire.
-- ============================================================================

DROP TABLE IF EXISTS public.news_episode_items;
DROP TABLE IF EXISTS public.news_references;
DROP TABLE IF EXISTS public.news_cs_comments;
DROP TABLE IF EXISTS public.news_corrections;
DROP TABLE IF EXISTS public.news_episodes;
DROP TABLE IF EXISTS public.news_syntheses;
DROP TABLE IF EXISTS public.news_scored;
DROP TABLE IF EXISTS public.news_raw;
DROP TABLE IF EXISTS public.news_sources;
DROP TABLE IF EXISTS public.news_taxonomy;

-- ============================================================================
-- 4. DROP EXTENSION (volontairement désactivé)
-- ============================================================================
-- ATTENTION : DROP EXTENSION vector volontairement désactivé.
-- Rationale : l'extension pgvector peut être utilisée par d'autres
-- migrations futures (ou déjà activée hors de cette migration). Un rollback
-- doit être conservateur : on annule ce qu'on a créé, pas ce qui pourrait
-- être partagé. Si tu es CERTAIN que rien d'autre n'utilise pgvector,
-- décommente manuellement la ligne ci-dessous avant d'exécuter le rollback.
--
-- DROP EXTENSION IF EXISTS vector;
