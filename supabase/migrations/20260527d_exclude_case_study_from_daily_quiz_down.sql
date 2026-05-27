-- Down migration : restaure l'état post-27/05a (case_study inclus dans le
-- pool daily quiz). À utiliser uniquement si la décision produit
-- d'exclusion (27 mai 2026, smoke D-DQ-06) est annulée.

CREATE OR REPLACE FUNCTION public.get_daily_quiz(p_user_id uuid)
RETURNS TABLE(
  id uuid,
  question_text text,
  options jsonb,
  feedback_correct text,
  feedback_incorrect text,
  points integer,
  question_type character varying,
  formation_title text,
  image_url text,
  recommended_time_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
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
    f.title::text AS formation_title,
    q.image_url,
    q.recommended_time_seconds
  FROM public.questions q
  LEFT JOIN public.sequences s ON s.id = q.sequence_id
  LEFT JOIN public.formations f ON f.id = s.formation_id
  WHERE q.is_daily_quiz_eligible = true
  ORDER BY random()
  LIMIT 10;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_quiz(uuid) TO authenticated;
