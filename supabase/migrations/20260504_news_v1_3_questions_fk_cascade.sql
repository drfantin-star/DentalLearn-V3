-- Nom du fichier : 20260504_news_v1_3_questions_fk_cascade.sql
-- Date de création : 2026-05-04
-- Ticket : fix/news-tech-debt-audit (D2 — FK ON DELETE bloquant)
-- Description : Bascule la FK questions.news_synthesis_id → news_syntheses.id
--               de ON DELETE SET NULL vers ON DELETE CASCADE.
-- Rollback : supabase/migrations/20260504_news_v1_3_questions_fk_cascade_down.sql

-- ============================================================================
-- ⚠️ CONTEXTE — bug bloquant introduit par 20260428_news_v1_3_questions_link
-- ============================================================================
-- La migration originale a posé la FK avec ON DELETE SET NULL en pensant
-- préserver les questions news en cas de hard-delete de leur synthèse parente.
-- Mais la contrainte questions_source_check (XOR sequence_id / news_synthesis_id)
-- rejette systématiquement le résultat : pour une question news, sequence_id
-- est NULL et news_synthesis_id devient NULL après le SET NULL → les deux
-- branches du OR sont fausses → CHECK violé → DELETE bloqué côté news_syntheses.
--
-- Le commentaire de la migration originale (lignes 35-41) reconnaissait le
-- problème en parlant de « nettoyage applicatif explicite » — mais aucun code
-- applicatif ne fait ce nettoyage avant DELETE, et la conséquence est que
-- TOUT DELETE sur news_syntheses ayant des questions liées échoue avec :
--   ERROR:  new row for relation "questions" violates check constraint
--           "questions_source_check"
--
-- Bascule donc en CASCADE : si une synthèse est hard-deletée, ses questions
-- news partent avec elle. Cohérent avec la réalité métier (une question news
-- sans synthèse parente n'a aucun sens — elle référence le contenu de la
-- synthèse pour son énoncé/feedback).

-- ============================================================================
-- 1. DROP de l'ancienne FK (ON DELETE SET NULL)
-- ============================================================================
-- Nom auto-généré par PG lors du ADD COLUMN ... REFERENCES inline :
-- questions_news_synthesis_id_fkey (vérifié via pg_constraint).

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_news_synthesis_id_fkey;

-- ============================================================================
-- 2. ADD de la nouvelle FK (ON DELETE CASCADE)
-- ============================================================================
-- Même nom de contrainte conservé pour rester cohérent avec le naming PG.

ALTER TABLE public.questions
  ADD CONSTRAINT questions_news_synthesis_id_fkey
  FOREIGN KEY (news_synthesis_id)
  REFERENCES public.news_syntheses(id)
  ON DELETE CASCADE;

-- ============================================================================
-- 3. Vérification (à exécuter dans un RUN SÉPARÉ — règle ping-pong)
-- ============================================================================
-- SELECT conname, confdeltype, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid = 'public.questions'::regclass
--    AND conname  = 'questions_news_synthesis_id_fkey';
--
-- Résultat attendu : confdeltype = 'c' (CASCADE), def contient
-- "ON DELETE CASCADE".
--
-- Test fonctionnel (avec rollback) :
--   BEGIN;
--   DELETE FROM news_syntheses WHERE id = (SELECT id FROM news_syntheses LIMIT 1);
--   -- Aucune erreur attendue ; les questions liées sont CASCADE-deleted.
--   ROLLBACK;
