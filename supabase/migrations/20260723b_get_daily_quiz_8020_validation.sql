-- 20260723b_get_daily_quiz_8020_validation.sql
-- Chantier verrou news + quota 80/20 du quiz du jour (suite audit 23/07/2026).
--
-- Deux changements sur get_daily_quiz, SANS toucher a la signature ni aux
-- colonnes renvoyees :
--   1) VERROU : une question news n'est eligible que si sa synthese est
--      status='active' ET is_editorially_validated=true. Corrige au passage le
--      defaut latent : l'ancienne version ne filtrait AUCUN statut de synthese
--      (une question news dont la synthese etait retractee restait tirable).
--   2) QUOTA 80/20 : sur 10 questions, viser 8 formations + 2 news, avec repli
--      symetrique :
--        - moins de 2 news eligibles -> completer avec des formations ;
--        - moins de 8 formations      -> completer avec des news ;
--      renvoie toujours 10 questions si le volume total le permet, n'echoue
--      jamais.
--
-- Conserves A L'IDENTIQUE : colonnes (dont image_url, recommended_time_seconds,
-- cast f.title::text, news_synthesis_id, news_source_title), exclusion
-- case_study, filtre is_daily_quiz_eligible=true, seed deterministe par
-- (user, jour). Type de retour inchange -> CREATE OR REPLACE (grants preserves).
-- Aucune ecriture (user_points, streaks, resultats) : fonction en lecture pure.

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
  v_form_avail integer;
  v_news_avail integer;
  v_take_form integer;
  v_take_news integer;
  v_deficit integer;
BEGIN
  v_seed := (
    EXTRACT(EPOCH FROM v_today::timestamp)::bigint
    + ('x' || substr(p_user_id::text, 1, 8))::bit(32)::int
  )::double precision / 2147483647.0;

  v_seed := v_seed - floor(v_seed);
  IF v_seed < 0 THEN v_seed := v_seed + 1; END IF;

  PERFORM setseed(v_seed);

  -- Tailles des deux pools eligibles (formation vs news validee).
  -- La clause d'eligibilite est identique a celle du RETURN QUERY ci-dessous.
  SELECT
    count(*) FILTER (WHERE q.news_synthesis_id IS NULL),
    count(*) FILTER (WHERE q.news_synthesis_id IS NOT NULL)
  INTO v_form_avail, v_news_avail
  FROM public.questions q
  LEFT JOIN public.news_syntheses ns ON ns.id = q.news_synthesis_id
  WHERE q.is_daily_quiz_eligible = true
    AND q.question_type <> 'case_study'
    AND (
      q.news_synthesis_id IS NULL
      OR (ns.status = 'active' AND ns.is_editorially_validated = true)
    );

  -- Allocation 80/20 avec repli symetrique (formations d'abord, puis news).
  v_take_form := LEAST(8, v_form_avail);
  v_take_news := LEAST(2, v_news_avail);
  v_deficit := 10 - v_take_form - v_take_news;
  IF v_deficit > 0 THEN
    v_take_form := v_take_form + LEAST(v_deficit, v_form_avail - v_take_form);
    v_deficit := 10 - v_take_form - v_take_news;
  END IF;
  IF v_deficit > 0 THEN
    v_take_news := v_take_news + LEAST(v_deficit, v_news_avail - v_take_news);
  END IF;

  RETURN QUERY
  WITH pool AS (
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
      ns.display_title::text AS news_source_title,
      (q.news_synthesis_id IS NOT NULL) AS is_news,
      row_number() OVER (
        PARTITION BY (q.news_synthesis_id IS NOT NULL)
        ORDER BY random()
      ) AS rn
    FROM public.questions q
    LEFT JOIN public.sequences s ON s.id = q.sequence_id
    LEFT JOIN public.formations f ON f.id = s.formation_id
    LEFT JOIN public.news_syntheses ns ON ns.id = q.news_synthesis_id
    WHERE q.is_daily_quiz_eligible = true
      AND q.question_type <> 'case_study'
      AND (
        q.news_synthesis_id IS NULL
        OR (ns.status = 'active' AND ns.is_editorially_validated = true)
      )
  )
  SELECT
    p.id,
    p.question_text,
    p.options,
    p.feedback_correct,
    p.feedback_incorrect,
    p.points,
    p.question_type,
    p.formation_title,
    p.image_url,
    p.recommended_time_seconds,
    p.news_synthesis_id,
    p.news_source_title
  FROM pool p
  WHERE (p.is_news = false AND p.rn <= v_take_form)
     OR (p.is_news = true  AND p.rn <= v_take_news)
  ORDER BY random()
  LIMIT 10;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_daily_quiz(uuid) TO anon, authenticated, service_role;
