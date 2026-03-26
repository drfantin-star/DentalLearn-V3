-- ============================================
-- Migration: Add theme_slug to epp_audits + themes_with_content view
-- ============================================

-- 1. Ajouter theme_slug dans epp_audits
ALTER TABLE epp_audits
ADD COLUMN IF NOT EXISTS theme_slug text;

-- Index pour les requêtes par thématique
CREATE INDEX IF NOT EXISTS idx_epp_audits_theme_slug ON epp_audits(theme_slug);

-- 2. Vue pour les thématiques avec leur contenu (formations + audits)
CREATE OR REPLACE VIEW themes_with_content AS
SELECT
  f.category as theme_slug,
  COUNT(DISTINCT f.id) as formations_count,
  COUNT(DISTINCT ea.id) as audits_count,
  array_agg(DISTINCT f.id) as formation_ids,
  array_agg(DISTINCT ea.id) FILTER (WHERE ea.id IS NOT NULL) as audit_ids
FROM formations f
LEFT JOIN epp_audits ea ON ea.theme_slug = f.category
WHERE f.is_published = true
GROUP BY f.category;
