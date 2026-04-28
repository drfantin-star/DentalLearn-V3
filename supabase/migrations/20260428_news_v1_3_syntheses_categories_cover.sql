-- Nom du fichier : 20260428_news_v1_3_syntheses_categories_cover.sql
-- Date de création : 2026-04-28
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Migration v1.3 — colonnes catégorie éditoriale / alignement formations / display_title / cover image sur news_syntheses + 2 indexes
-- Rollback : supabase/migrations/20260428_news_v1_3_syntheses_categories_cover_down.sql

-- ============================================================================
-- Contexte (spec_news_podcast_pipeline_v1_3.md §5.2 — migration 0011)
-- ============================================================================
-- Le Ticket 5 (synthèse + tagging Sonnet) doit produire en plus du tagging 3D
-- existant (specialite, themes, niveau_preuve) :
--   - category_editorial         : 1 valeur parmi 4 (cf CHECK ci-dessous)
--   - formation_category_match   : slug de formations.category si match, sinon NULL
--   - display_title              : titre court d'affichage (≤60 caractères)
--   - cover_image_url            : URL de la cover (Ticket 10, mode cascade)
--   - cover_image_source         : provenance de la cover (svg_auto par défaut)
--
-- État BDD à l'application : 0 ligne dans news_syntheses (Ticket 5 non
-- encore livré au moment de cette migration). Les 5 colonnes sont ajoutées
-- nullable, avec CHECK strict sur les deux énumérations fermées.
--
-- Les 2 indexes B-tree sur category_editorial et formation_category_match
-- accélèrent les filtres admin (Ticket 8 vue articles + recherche KB).

-- ============================================================================
-- 1. Ajout des 5 colonnes
-- ============================================================================

ALTER TABLE public.news_syntheses
  ADD COLUMN category_editorial text
    CHECK (category_editorial IN ('reglementaire','scientifique','pratique','humour') OR category_editorial IS NULL),
  ADD COLUMN formation_category_match text,
  ADD COLUMN display_title text,
  ADD COLUMN cover_image_url text,
  ADD COLUMN cover_image_source text
    CHECK (cover_image_source IN ('svg_auto','ai_generated','unsplash','manual_upload') OR cover_image_source IS NULL);

-- ============================================================================
-- 2. Indexes B-tree sur les 2 colonnes filtrantes
-- ============================================================================
-- IF NOT EXISTS pour rendre la création rejouable même partiellement (les
-- ALTER TABLE plus haut ne sont PAS protégés par IF NOT EXISTS — convention
-- héritée du Ticket 1, on force le passage par le _down.sql pour re-rouler).

CREATE INDEX IF NOT EXISTS news_syntheses_category_editorial_idx
  ON public.news_syntheses (category_editorial);

CREATE INDEX IF NOT EXISTS news_syntheses_formation_match_idx
  ON public.news_syntheses (formation_category_match);

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'news_syntheses'
--    AND column_name IN (
--      'category_editorial','formation_category_match',
--      'display_title','cover_image_url','cover_image_source'
--    )
--  ORDER BY column_name;
--
-- Résultat attendu : 5 lignes, toutes nullable=YES.
--
-- SELECT indexname
--   FROM pg_indexes
--  WHERE schemaname = 'public'
--    AND tablename  = 'news_syntheses'
--    AND indexname IN (
--      'news_syntheses_category_editorial_idx',
--      'news_syntheses_formation_match_idx'
--    );
--
-- Résultat attendu : 2 lignes.
