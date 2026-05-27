-- Migration : exclure question_type = 'case_study' du pool éligible au daily quiz.
--
-- Décision produit (smoke D-DQ-06, 27 mai 2026) :
-- le format case_study (raisonnement clinique en plusieurs sous-questions
-- avec contexte partagé) est conçu pour le SequencePlayer (rythme long
-- des formations) et l'EPP. Il ne s'adapte pas au daily quiz, qui est un
-- format d'engagement court (10 questions enchaînées, < 30 s par item).
--
-- Findings ayant motivé la décision :
--   1. Sur 11 case_study structurées en base, aucune n'a n_sub_questions >= 2,
--      donc le bloc contexte clinique (caseOpts.context.history +
--      chief_complaint) n'est jamais rendu en UI (pattern
--      caseOpts.questions.length > 1 dans DailyQuizModal.tsx:963).
--   2. 10 case_study legacy ont options = array(4) au lieu du format
--      structuré → MCQ déguisées passant par la branche isCaseStudyLegacy.
--
-- Impact : pool d'éligibilité passe de 384 à 363 questions (-21, -5,5%).
-- Aucune modification côté client : DailyQuizModal garde sa logique de
-- rendu case_study intacte (toujours utilisée par SequencePlayer).
-- Aucune migration data : les 21 case_study restent en DB, disponibles
-- pour SequencePlayer et EPP.

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
    AND q.question_type != 'case_study'
  ORDER BY random()
  LIMIT 10;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_quiz(uuid) TO authenticated;
