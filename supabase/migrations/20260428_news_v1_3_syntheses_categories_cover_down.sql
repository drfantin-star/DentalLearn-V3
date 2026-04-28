-- Nom du fichier : 20260428_news_v1_3_syntheses_categories_cover_down.sql
-- Date de création : 2026-04-28
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Rollback symétrique — DROP INDEX puis DROP COLUMN dans l'ordre inverse de l'UP
-- Rollback : n/a (ce fichier EST le rollback de 20260428_news_v1_3_syntheses_categories_cover.sql)

-- ============================================================================
-- 1. Drop des indexes (en premier — la suppression de la colonne couverte
--    aurait drop l'index en cascade, mais on reste explicite)
-- ============================================================================

DROP INDEX IF EXISTS public.news_syntheses_formation_match_idx;
DROP INDEX IF EXISTS public.news_syntheses_category_editorial_idx;

-- ============================================================================
-- 2. Drop des 5 colonnes (ordre inverse de l'UP)
-- ============================================================================

ALTER TABLE public.news_syntheses
  DROP COLUMN IF EXISTS cover_image_source,
  DROP COLUMN IF EXISTS cover_image_url,
  DROP COLUMN IF EXISTS display_title,
  DROP COLUMN IF EXISTS formation_category_match,
  DROP COLUMN IF EXISTS category_editorial;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT count(*) AS remaining_v13_columns
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'news_syntheses'
--    AND column_name IN (
--      'category_editorial','formation_category_match',
--      'display_title','cover_image_url','cover_image_source'
--    );
--
-- Résultat attendu : 0.
