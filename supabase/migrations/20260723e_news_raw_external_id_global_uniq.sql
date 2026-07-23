-- Nom du fichier : 20260723e_news_raw_external_id_global_uniq.sql
-- Date de création : 2026-07-23
-- Ticket : news-pipeline-dedup-sizing
-- Description : Remplace l'unique (source_id, external_id) sur news_raw par un
--               unique global sur external_id. Lot 1 du plan dedup amont.
-- Rollback : supabase/migrations/20260723e_news_raw_external_id_global_uniq_down.sql

-- ============================================================================
-- Contexte
-- ============================================================================
-- Les 13 sources PubMed moissonnent le même PMID via plusieurs requêtes MeSH
-- différentes (source_id différents). L'index news_raw_source_external_uniq
-- porte sur (source_id, external_id) et ne détecte donc pas ces doublons
-- cross-source : 1334 lignes news_raw surnuméraires constatées le 23/07/2026,
-- purgées par une opération manuelle (DELETE, hors fichier de migration —
-- gardait la ligne la plus ancienne par external_id / ingested_at ASC) avant
-- l'application de cette migration.
--
-- Vérifié le 23/07/2026 avant purge : zéro collision d'external_id entre
-- types de source (PubMed = PMID, RSS = URL) — l'unicité peut donc devenir
-- globale sans risque de collision cross-type.
--
-- Pré-requis : purge des doublons déjà effectuée (sinon cette migration
-- échoue sur violation du nouvel index UNIQUE).

-- ============================================================================
-- 1. Drop de l'ancien index composite
-- ============================================================================

ALTER TABLE public.news_raw DROP CONSTRAINT IF EXISTS news_raw_source_external_uniq;

-- ============================================================================
-- 2. Ajout de l'unique global sur external_id
-- ============================================================================

ALTER TABLE public.news_raw ADD CONSTRAINT news_raw_external_id_uniq UNIQUE (external_id);

COMMENT ON TABLE public.news_raw IS
  'Articles bruts ingérés (PubMed, RSS, Crossref, etc.). Dédoublonnés par external_id (unique global depuis le 23/07/2026 — auparavant (source_id, external_id), qui laissait passer les doublons cross-source PubMed). raw_payload conserve la réponse intégrale de l''API/RSS pour traçabilité et reparsing éventuel.';

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'public.news_raw'::regclass;
--
-- Résultat attendu : news_raw_external_id_uniq | UNIQUE (external_id)
-- et absence de news_raw_source_external_uniq.
