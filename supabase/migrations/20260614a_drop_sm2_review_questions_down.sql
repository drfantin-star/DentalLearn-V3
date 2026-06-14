-- ============================================
-- Down: 20260614a_drop_sm2_review_questions
-- Restaure la RPC get_sm2_review_questions avec son corps exact
-- (récupéré via pg_get_functiondef avant le drop) + grants d'origine.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_sm2_review_questions(
  p_user_id uuid,
  p_sequence_id uuid,
  p_limit integer DEFAULT 3
)
RETURNS TABLE (
  id uuid,
  question_text text,
  options jsonb,
  feedback_correct text,
  feedback_incorrect text,
  points integer,
  question_type varchar(20),
  image_url text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_category varchar;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT f.category
    INTO v_category
    FROM public.sequences s
    JOIN public.formations f ON f.id = s.formation_id
   WHERE s.id = p_sequence_id;

  IF v_category IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.question_text,
    q.options,
    q.feedback_correct,
    q.feedback_incorrect,
    q.points,
    q.question_type,
    q.image_url
  FROM public.user_question_review r
  JOIN public.questions  q  ON q.id = r.question_id
  JOIN public.sequences  s2 ON s2.id = q.sequence_id
  JOIN public.formations f2 ON f2.id = s2.formation_id
  WHERE r.user_id = p_user_id
    AND r.mastered_at IS NULL
    AND r.next_review_date IS NOT NULL
    AND r.next_review_date <= CURRENT_DATE
    AND f2.category = v_category
    AND q.sequence_id <> p_sequence_id
  ORDER BY r.next_review_date ASC, r.ease_factor ASC
  LIMIT LEAST(GREATEST(p_limit, 0), 5);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_sm2_review_questions(uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sm2_review_questions(uuid, uuid, integer)
  TO authenticated;
