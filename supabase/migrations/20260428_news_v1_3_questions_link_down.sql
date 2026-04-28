-- Nom du fichier : 20260428_news_v1_3_questions_link_down.sql
-- Date de création : 2026-04-28
-- Ticket : feature/news-ticket-5 (claude/news-section-ticket-5-hPm1t)
-- Description : Rollback symétrique — DROP INDEX puis DROP CONSTRAINT puis DROP COLUMN dans l'ordre inverse de l'UP
-- Rollback : n/a (ce fichier EST le rollback de 20260428_news_v1_3_questions_link.sql)

-- ============================================================================
-- ⚠️ ATTENTION — perte de données potentielle
-- ============================================================================
-- Si ce rollback est exécuté APRÈS que des questions news ont été insérées
-- (Ticket 5 livré et 1+ run du pipeline effectué), le DROP COLUMN
-- news_synthesis_id va supprimer le pointeur de toutes ces lignes vers leur
-- synthèse parente. Les lignes elles-mêmes restent en place mais deviennent
-- orphelines (sequence_id IS NULL → ne tombent plus dans aucun pool).
--
-- À utiliser uniquement en cas de problème détecté juste après l'application
-- de la migration UP, AVANT que le pipeline news n'ait inséré quoi que ce
-- soit. Au-delà : audit + cleanup manuel des questions news avant rollback.

-- ============================================================================
-- 1. Drop de l'index FK (en premier — non bloquant pour la suite)
-- ============================================================================

DROP INDEX IF EXISTS public.questions_news_synthesis_idx;

-- ============================================================================
-- 2. Drop de la contrainte CHECK
-- ============================================================================

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_source_check;

-- ============================================================================
-- 3. Drop de la colonne FK
-- ============================================================================

ALTER TABLE public.questions
  DROP COLUMN IF EXISTS news_synthesis_id;

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT count(*) AS column_present
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'questions'
--    AND column_name  = 'news_synthesis_id';
--
-- Résultat attendu : 0.
--
-- SELECT count(*) AS check_present
--   FROM pg_constraint
--  WHERE conname = 'questions_source_check';
--
-- Résultat attendu : 0.
