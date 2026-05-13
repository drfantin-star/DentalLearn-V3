-- Nom du fichier : 20260513_t12_news_syntheses_audit_soft_down.sql
-- Date de création : 2026-05-13
-- Ticket : POC-T12 — Éditeur admin synthèse News.
-- Description : rollback symétrique de 20260513_t12_news_syntheses_audit_soft.sql.
--
-- Ordre strict :
--   1. DROP INDEX d'abord (sinon il faudrait DROP COLUMN ... CASCADE)
--   2. DROP COLUMN last_edited_by (FK → profiles, à retirer avant la colonne
--      associée — Postgres gère le DROP CONSTRAINT implicite via DROP COLUMN)
--   3. DROP COLUMN last_edited_at
--
-- IF EXISTS partout : idempotence en cas de rollback partiel ou de re-run.
-- Pas de transaction explicite — Supabase wrappe automatiquement les
-- migrations dans une transaction.
--
-- ⚠️ Impact en cas d'application :
--   - Toute trace d'édition admin via T12 est PERDUE (last_edited_at/by
--     supprimées). Acceptable car ces colonnes sont une dette éditoriale
--     soft (Q-T12-6=(b)), pas une donnée applicative critique.
--   - Les 197+ synthèses sont préservées (contenu inchangé).
--   - Les éditions Sonnet pré-T12 ne sont pas affectées (elles n'ont jamais
--     écrit dans ces colonnes).

-- ============================================================================
-- 1. DROP INDEX partiel
-- ============================================================================

DROP INDEX IF EXISTS public.news_syntheses_last_edited_at_idx;

-- ============================================================================
-- 2. DROP COLUMN last_edited_by (FK profiles → SET NULL retiré
--    automatiquement via DROP COLUMN)
-- ============================================================================

ALTER TABLE public.news_syntheses
  DROP COLUMN IF EXISTS last_edited_by;

-- ============================================================================
-- 3. DROP COLUMN last_edited_at
-- ============================================================================

ALTER TABLE public.news_syntheses
  DROP COLUMN IF EXISTS last_edited_at;
