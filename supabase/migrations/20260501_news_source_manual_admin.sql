-- Nom du fichier : 20260501_news_source_manual_admin.sql
-- Date de création : 2026-05-01
-- Ticket : Ticket 8 — admin News (claude/news-admin-ticket-8-phase1)
-- Description : insertion d'une source 'manual' dédiée aux ingestions
--               admin ad hoc via /admin/news/manual.

-- ============================================================================
-- Contexte
-- ============================================================================
-- La contrainte CHECK sur news_sources.type autorise déjà 'manual' (cf
-- 20260423_news_schema.sql). Cette migration ajoute simplement la ligne
-- correspondante. L'INSERT est idempotent (NOT EXISTS sur type='manual').
--
-- Tous les articles ingérés via le panneau admin auront source_id pointant
-- sur cette ligne, ce qui permet :
--   - de distinguer les articles manuels des articles automatiques
--     (PubMed/RSS) dans les requêtes d'analyse,
--   - de respecter la FK news_raw.source_id sans bypass,
--   - de garantir l'unicité dédup (source_id, external_id) où external_id
--     contient le DOI ou un identifiant 'manual-<uuid>' généré côté API.

INSERT INTO public.news_sources (
  name, type, url, query, spe_tags, active, notes
)
SELECT
  'Ingestions manuelles admin',
  'manual',
  NULL,
  '{"manual": true, "added_by": "admin_panel"}'::jsonb,
  ARRAY[]::text[],
  true,
  'Source virtuelle pour les articles ajoutés manuellement via /admin/news/manual. Pas de fetch automatique, pas de cron. Chaque ligne news_raw avec ce source_id correspond à une saisie admin ad hoc.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.news_sources WHERE type = 'manual'
);

-- ============================================================================
-- Sanity check (à exécuter manuellement après application)
-- ============================================================================
-- SELECT id, name, type, active FROM public.news_sources WHERE type = 'manual';
-- → 1 ligne attendue, active = true.
