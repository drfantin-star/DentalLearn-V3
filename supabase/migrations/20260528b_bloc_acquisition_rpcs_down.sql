-- ============================================
-- Down: 20260528b_bloc_acquisition_rpcs
-- ============================================

DROP FUNCTION IF EXISTS public.get_bloc_failed_questions(uuid, uuid, integer);
DROP FUNCTION IF EXISTS public.get_bloc_acquisition_status(uuid, uuid);
DROP FUNCTION IF EXISTS public.record_question_acquisition(uuid, uuid, uuid);
