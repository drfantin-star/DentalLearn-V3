-- Nom du fichier : 20260504_news_v1_3_questions_fk_cascade_down.sql
-- Date de création : 2026-05-04
-- Ticket : fix/news-tech-debt-audit (D2 — FK ON DELETE bloquant)
-- Description : Rollback symétrique — repasse la FK
--               questions.news_synthesis_id → news_syntheses.id en
--               ON DELETE SET NULL (état antérieur).
-- Rollback : n/a (ce fichier EST le rollback de
--            20260504_news_v1_3_questions_fk_cascade.sql)

-- ============================================================================
-- ⚠️ ATTENTION — restaure le bug bloquant d'origine
-- ============================================================================
-- Ce rollback rétablit l'état antérieur (ON DELETE SET NULL), ce qui
-- réintroduit le bug documenté dans la migration UP : tout DELETE sur
-- news_syntheses ayant des questions liées échouera avec violation de la
-- contrainte questions_source_check. À utiliser uniquement si la bascule
-- CASCADE pose un problème métier non anticipé.

-- ============================================================================
-- 1. DROP de la FK CASCADE
-- ============================================================================

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_news_synthesis_id_fkey;

-- ============================================================================
-- 2. ADD de la FK SET NULL (état d'origine)
-- ============================================================================

ALTER TABLE public.questions
  ADD CONSTRAINT questions_news_synthesis_id_fkey
  FOREIGN KEY (news_synthesis_id)
  REFERENCES public.news_syntheses(id)
  ON DELETE SET NULL;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT conname, confdeltype
--   FROM pg_constraint
--  WHERE conrelid = 'public.questions'::regclass
--    AND conname  = 'questions_news_synthesis_id_fkey';
--
-- Résultat attendu : confdeltype = 'n' (SET NULL).
