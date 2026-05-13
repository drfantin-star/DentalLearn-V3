-- Nom du fichier : 20260513_t12_news_syntheses_audit_soft.sql
-- Date de création : 2026-05-13
-- Ticket : POC-T12 — Éditeur admin synthèse News + régénération audio/timeline.
-- Description : ajoute deux colonnes additives sur news_syntheses pour
--               persister une trace éditoriale soft (timestamp + auteur de
--               la dernière édition admin via /admin/news/[id]/edit).
--
-- Décision Q-T12-6=(b) : audit log SOFT (2 colonnes additives), pas de table
-- d'audit dédiée. Mise à jour côté API (pas trigger BDD) à chaque PATCH via
-- /api/admin/news/syntheses/[id]. Table d'audit complète (D-T12-02) reportée
-- post-POC.
--
-- Rollback : 20260513_t12_news_syntheses_audit_soft_down.sql.
--
-- AUDIT PRÉALABLE (13 mai 2026) :
--   - Pré-flight SQL PF6 : aucune colonne last_edited_at/by n'existe sur
--     news_syntheses (0 lignes retournées par information_schema).
--   - Pré-flight SQL PF7 : RLS active, policy unique "Service role full
--     access". Écritures via service role uniquement — pas de policy à
--     ajouter pour cette migration (les colonnes additives héritent du
--     contrôle RLS de la table).
--   - Table news_syntheses : 197 lignes au 12/05/2026. Migration purement
--     additive ; les 197 synthèses pré-T12 conservent leurs valeurs telles
--     quelles, last_edited_at/by valent NULL pour toutes — conformément au
--     critère §9(h) du prompt T12 v2 ("Footer Dernière modif visible
--     uniquement si last_edited_at IS NOT NULL").
--   - FK profiles(id) ON DELETE SET NULL : si un admin est supprimé de
--     profiles, la trace devient orpheline mais la synthèse reste. On ne
--     veut JAMAIS perdre une synthèse parce qu'un admin est parti.
--   - Index partiel sur last_edited_at DESC NULLS LAST WHERE NOT NULL :
--     support requête future "synthèses récemment éditées" sans alourdir
--     le stockage pour les 197 synthèses jamais éditées (cas dominant
--     initial). Pas d'index sur last_edited_by en V1 (aucune requête prévue
--     par auteur).

-- ============================================================================
-- 1. Colonnes additives news_syntheses.last_edited_at + last_edited_by
-- ============================================================================

ALTER TABLE public.news_syntheses
  ADD COLUMN IF NOT EXISTS last_edited_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_edited_by uuid NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.news_syntheses.last_edited_at IS
  'POC-T12 : timestamp de la dernière édition admin via /admin/news/[id]/edit (UPDATE applicatif, pas trigger BDD). NULL = synthèse jamais éditée via T12 (cas pré-T12 et synthèses ingérées non touchées). Q-T12-6=(b) audit soft.';

COMMENT ON COLUMN public.news_syntheses.last_edited_by IS
  'POC-T12 : admin auteur de la dernière édition (FK profiles.id, ON DELETE SET NULL). NULL si synthèse jamais éditée via T12, ou si l''admin a été supprimé de profiles (trace orpheline, synthèse préservée). Q-T12-6=(b) audit soft.';

-- ============================================================================
-- 2. Index partiel pour lookup rapide des synthèses récemment éditées
-- ============================================================================

CREATE INDEX IF NOT EXISTS news_syntheses_last_edited_at_idx
  ON public.news_syntheses (last_edited_at DESC NULLS LAST)
  WHERE last_edited_at IS NOT NULL;

COMMENT ON INDEX public.news_syntheses_last_edited_at_idx IS
  'POC-T12 : index partiel pour query future "synthèses récemment éditées" (rapport admin, dashboard de revue éditoriale). Filtre WHERE last_edited_at IS NOT NULL évite les ~197 lignes jamais éditées en V1.';
