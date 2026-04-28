-- Nom du fichier : 20260428_news_v1_3_episodes_format_down.sql
-- Date de création : 2026-04-28
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Rollback symétrique — DROP CONSTRAINT puis DROP COLUMN dans l'ordre inverse de l'UP
-- Rollback : n/a (ce fichier EST le rollback de 20260428_news_v1_3_episodes_format.sql)

-- ============================================================================
-- 1. Drop de la contrainte cohérence (en premier — référence les colonnes)
-- ============================================================================

ALTER TABLE public.news_episodes
  DROP CONSTRAINT IF EXISTS news_episodes_format_narrator_check;

-- ============================================================================
-- 2. Drop des 4 colonnes (ordre inverse de l'UP)
-- ============================================================================

ALTER TABLE public.news_episodes
  DROP COLUMN IF EXISTS editorial_tone,
  DROP COLUMN IF EXISTS target_duration_min,
  DROP COLUMN IF EXISTS narrator,
  DROP COLUMN IF EXISTS format;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT count(*) AS remaining_v13_columns
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'news_episodes'
--    AND column_name IN ('format','narrator','target_duration_min','editorial_tone');
--
-- Résultat attendu : 0.
