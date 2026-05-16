-- ============================================
-- Down migration: 20260516d_sm2_review_down
-- Reverse exact opposite of 20260516d_sm2_review.sql
-- ============================================

DROP FUNCTION IF EXISTS public.update_sm2_state(uuid, uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.get_sm2_review_questions(uuid, uuid, integer);
DROP TABLE IF EXISTS public.user_question_review CASCADE;
