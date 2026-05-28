-- ============================================
-- Migration: 20260528b_bloc_acquisition_rpcs
-- RPC du modèle d'acquisition par bloc (PARTIE_A_v4 §2.4 / §4.3)
-- ============================================
-- Source de vérité unique de l'acquisition : user_question_review.
-- Décision Dr Fantin (28/05/2026), modèle « Hybride » :
--   * mastered_at reste réservé au SM-2 (3 réussites consécutives).
--   * « acquise » (sens attestation/bloc) = ligne existe ET
--     consecutive_correct >= 1 (= dernière réponse correcte).
--   * « échouée »                          = ligne existe ET
--     consecutive_correct = 0.
--   * non tentée                           = aucune ligne.
--
-- record_question_acquisition enregistre les bonnes réponses du 1er coup avec
-- next_review_date = NULL : la question devient acquise SANS entrer dans la
-- file de révision SM-2 (get_sm2_review_questions exige next_review_date NOT
-- NULL). update_sm2_state n'est pas modifié.

-- ============================================
-- RPC : record_question_acquisition
-- Appelée en phase quiz sur une bonne réponse du 1er coup.
-- ON CONFLICT DO NOTHING : si une ligne existe déjà (échec antérieur, ou
-- déjà acquise, ou masterée SM-2), on ne touche pas l'état SM-2 existant.
-- ============================================

CREATE OR REPLACE FUNCTION public.record_question_acquisition(
  p_user_id uuid,
  p_question_id uuid,
  p_sequence_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.user_question_review (
    user_id, question_id, sequence_id,
    ease_factor, interval_days, consecutive_correct,
    next_review_date, mastered_at, last_reviewed_at, last_quality
  ) VALUES (
    p_user_id, p_question_id, p_sequence_id,
    2.50, 2, 1,
    NULL, NULL, now(), 5
  )
  ON CONFLICT (user_id, question_id) DO NOTHING;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_question_acquisition(uuid, uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_question_acquisition(uuid, uuid, uuid)
  TO authenticated;

-- ============================================
-- RPC : get_bloc_acquisition_status(p_user_id, p_formation_id)
-- Une ligne par bloc présent dans la formation. is_locked = le bloc N-1
-- n'est pas complet (bloc 1 jamais verrouillé). Un bloc sans question est
-- trivialement complet (acquired >= total avec total = 0).
-- ============================================

CREATE OR REPLACE FUNCTION public.get_bloc_acquisition_status(
  p_user_id uuid,
  p_formation_id uuid
)
RETURNS TABLE (
  bloc_number int,
  total_questions int,
  acquired_questions int,
  failed_questions int,
  is_complete boolean,
  is_locked boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  WITH blocs AS (
    SELECT DISTINCT s.bloc_number AS bn
    FROM public.sequences s
    WHERE s.formation_id = p_formation_id
  ),
  stats AS (
    SELECT
      b.bn,
      COUNT(q.id)::int AS total_q,
      COUNT(*) FILTER (WHERE r.id IS NOT NULL AND r.consecutive_correct >= 1)::int AS acquired_q,
      COUNT(*) FILTER (WHERE r.id IS NOT NULL AND r.consecutive_correct = 0)::int  AS failed_q
    FROM blocs b
    LEFT JOIN public.sequences s
      ON s.formation_id = p_formation_id AND s.bloc_number = b.bn
    LEFT JOIN public.questions q
      ON q.sequence_id = s.id
    LEFT JOIN public.user_question_review r
      ON r.question_id = q.id AND r.user_id = p_user_id
    GROUP BY b.bn
  ),
  computed AS (
    SELECT
      bn,
      total_q,
      acquired_q,
      failed_q,
      (acquired_q >= total_q) AS complete
    FROM stats
  )
  SELECT
    c.bn,
    c.total_q,
    c.acquired_q,
    c.failed_q,
    c.complete,
    COALESCE(
      (SELECT NOT prev.complete FROM computed prev WHERE prev.bn = c.bn - 1),
      false
    ) AS is_locked
  FROM computed c
  ORDER BY c.bn;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_bloc_acquisition_status(uuid, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bloc_acquisition_status(uuid, uuid)
  TO authenticated;

-- ============================================
-- RPC : get_bloc_failed_questions(p_user_id, p_formation_id, p_bloc_number)
-- Questions non acquises (consecutive_correct = 0) d'un bloc, pour l'écran
-- de remédiation. Triées par séquence d'origine puis ordre de question.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_bloc_failed_questions(
  p_user_id uuid,
  p_formation_id uuid,
  p_bloc_number integer
)
RETURNS TABLE (
  id uuid,
  question_text text,
  options jsonb,
  feedback_correct text,
  feedback_incorrect text,
  points integer,
  question_type varchar(20),
  image_url text,
  sequence_id uuid,
  sequence_title text,
  sequence_number integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
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
    q.image_url,
    s.id,
    s.title::text,
    s.sequence_number
  FROM public.user_question_review r
  JOIN public.questions q ON q.id = r.question_id
  JOIN public.sequences s ON s.id = q.sequence_id
  WHERE r.user_id = p_user_id
    AND s.formation_id = p_formation_id
    AND s.bloc_number = p_bloc_number
    AND r.consecutive_correct = 0
  ORDER BY s.sequence_number, q.question_order;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_bloc_failed_questions(uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_bloc_failed_questions(uuid, uuid, integer)
  TO authenticated;
