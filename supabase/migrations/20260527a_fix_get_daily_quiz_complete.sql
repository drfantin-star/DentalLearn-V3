-- ============================================
-- Fix get_daily_quiz: étendre + corriger la cause racine du bug 42804
-- ============================================
--
-- Contexte: le RPC get_daily_quiz échouait à CHAQUE appel en prod avec
--   ERROR 42804: structure of query does not match function result type
--   DETAIL: Returned type character varying(255) does not match
--           expected type text in column 8
-- Column 8 = formation_title. formations.title est varchar(255) en DB,
-- le RETURNS TABLE déclarait formation_title text → strict mode PG
-- refuse l'exécution. Le fallback SELECT côté route API masquait le
-- problème depuis la mise en service.
--
-- Cette migration:
--   1) Étend RETURNS TABLE avec image_url et recommended_time_seconds
--   2) Corrige le mismatch via cast f.title::text AS formation_title
--      (garde formation_title text dans le contrat de retour, moins
--      risqué qu'un changement de type qui forcerait à toucher les
--      callers)
-- ============================================

-- DROP requis car PostgreSQL refuse de changer le type de retour d'une
-- fonction existante via CREATE OR REPLACE (erreur 42P13)
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
  formation_title text,
  image_url text,
  recommended_time_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_seed double precision;
  v_today date := CURRENT_DATE;
BEGIN
  -- Seed déterministe basé sur la date du jour + user_id
  v_seed := (
    EXTRACT(EPOCH FROM v_today::timestamp)::bigint
    + ('x' || substr(p_user_id::text, 1, 8))::bit(32)::int
  )::double precision / 2147483647.0;

  -- Normaliser le seed entre 0 et 1
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
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_quiz(uuid) TO authenticated;
