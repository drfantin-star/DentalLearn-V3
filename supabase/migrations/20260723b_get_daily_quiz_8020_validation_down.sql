-- 20260723b_get_daily_quiz_8020_validation_down.sql
-- Rollback de 20260723b : restaure get_daily_quiz dans son etat post-20260722a
-- (source news : news_synthesis_id + news_source_title), SANS verrou de
-- validation ni quota 80/20.
--
-- ATTENTION : cette version restauree ne filtre AUCUN statut de synthese et ne
-- lit pas is_editorially_validated. Elle peut donc etre jouee independamment de
-- 20260723a (elle ne reference plus la colonne). Type de retour inchange ->
-- CREATE OR REPLACE.

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
  recommended_time_seconds integer,
  news_synthesis_id uuid,
  news_source_title text
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
    q.recommended_time_seconds,
    q.news_synthesis_id,
    ns.display_title::text AS news_source_title
  FROM public.questions q
  LEFT JOIN public.sequences s ON s.id = q.sequence_id
  LEFT JOIN public.formations f ON f.id = s.formation_id
  LEFT JOIN public.news_syntheses ns ON ns.id = q.news_synthesis_id
  WHERE q.is_daily_quiz_eligible = true
    AND q.question_type != 'case_study'
  ORDER BY random()
  LIMIT 10;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_quiz(uuid) TO anon, authenticated, service_role;
