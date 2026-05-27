-- ============================================
-- DOWN: 20260527a_fix_get_daily_quiz_complete
-- ============================================
-- Note: restaure l'état pré-27/05 incluant le bug 42804 (mismatch
-- varchar(255) vs text sur formation_title qui fait échouer le RPC
-- à chaque appel). Le fallback API reste fonctionnel.
-- ============================================

DROP FUNCTION IF EXISTS public.get_daily_quiz(uuid);

CREATE OR REPLACE FUNCTION public.get_daily_quiz(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  question_text text,
  options jsonb,
  feedback_correct text,
  feedback_incorrect text,
  points integer,
  question_type varchar(20),
  formation_title text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seed double precision;
  v_today date := CURRENT_DATE;
BEGIN
  v_seed := (
    EXTRACT(EPOCH FROM v_today::timestamp)::bigint
    + ('x' || substr(p_user_id::text, 1, 8))::bit(32)::int
  )::double precision / 2147483647.0;

  v_seed := v_seed - floor(v_seed);
  IF v_seed < 0 THEN v_seed := v_seed + 1; END IF;

  PERFORM setseed(v_seed);

  RETURN QUERY
  SELECT
    q.id,
    q.question_text,
    q.options,
    q.feedback_correct,
    q.feedback_incorrect,
    q.points,
    q.question_type,
    f.title AS formation_title
  FROM public.questions q
  LEFT JOIN public.sequences s ON s.id = q.sequence_id
  LEFT JOIN public.formations f ON f.id = s.formation_id
  WHERE q.is_daily_quiz_eligible = true
  ORDER BY random()
  LIMIT 10;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_quiz(uuid) TO authenticated;
