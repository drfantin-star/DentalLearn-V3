-- ============================================
-- Migration: 20260516d_sm2_review
-- Répétition espacée SM-2 (SuperMemo-2) pour les séquences de formation
-- ============================================
-- Décisions Dr Fantin (16 mai 2026) :
--   * Quiz du jour NON IMPACTÉ (option B)
--   * Quality binaire : correct=5, incorrect=1
--   * INSERT only on failure : pas de ligne créée si la question est réussie du 1er coup
--   * Isolation stricte : aucune écriture dans user_points, user_sequences, course_watch_logs

-- ============================================
-- Table : user_question_review
-- ============================================

CREATE TABLE IF NOT EXISTS public.user_question_review (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  sequence_id uuid REFERENCES public.sequences(id) ON DELETE SET NULL,
  ease_factor numeric(4,2) NOT NULL DEFAULT 2.50 CHECK (ease_factor >= 1.30),
  interval_days integer NOT NULL DEFAULT 2 CHECK (interval_days >= 0),
  consecutive_correct integer NOT NULL DEFAULT 0 CHECK (consecutive_correct >= 0),
  next_review_date date,
  mastered_at timestamptz,
  last_reviewed_at timestamptz,
  last_quality smallint CHECK (last_quality BETWEEN 0 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_question_review_pkey PRIMARY KEY (id),
  CONSTRAINT user_question_review_user_q_unique UNIQUE (user_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_uqr_user_pool
  ON public.user_question_review (user_id, next_review_date)
  WHERE mastered_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_uqr_user_mastered
  ON public.user_question_review (user_id)
  WHERE mastered_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_uqr_question
  ON public.user_question_review (question_id);

-- ============================================
-- RLS : lecture restreinte au propriétaire.
-- Aucune policy INSERT/UPDATE/DELETE — toute écriture passe par les RPC
-- SECURITY DEFINER ci-dessous. Cela bloque toute écriture directe depuis
-- PostgREST, même avec un JWT authentifié.
-- ============================================

ALTER TABLE public.user_question_review ENABLE ROW LEVEL SECURITY;

CREATE POLICY uqr_select_own
  ON public.user_question_review
  FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================
-- RPC : get_sm2_review_questions(p_user_id, p_sequence_id, p_limit)
-- Retourne les questions à réviser du même thème (formations.category)
-- que la séquence en cours. Filtre next_review_date <= today, non masterées.
-- Exclut les questions de la séquence en cours pour éviter un doublon
-- immédiat avec une question juste ratée.
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

-- ============================================
-- RPC : update_sm2_state(p_user_id, p_question_id, p_sequence_id, p_quality)
-- Politique INSERT only on failure :
--   * Quality >= 3 et pas de ligne existante  -> NOOP
--   * Quality <  3 et pas de ligne existante  -> INSERT initial
--   * Quality <  3 et ligne existante         -> UPDATE reset (interval=2,
--                                                 ease *= 0.85, consec=0,
--                                                 mastered_at=NULL)
--   * Quality >= 3 et ligne existante :
--       - consec+1 < 3 -> UPDATE progression
--       - consec+1 >= 3 -> UPDATE mastery (mastered_at=now(),
--                                          next_review_date=NULL)
-- ============================================

CREATE OR REPLACE FUNCTION public.update_sm2_state(
  p_user_id uuid,
  p_question_id uuid,
  p_sequence_id uuid,
  p_quality integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r record;
  v_new_ease     numeric(4,2);
  v_new_interval integer;
  v_new_consec   integer;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_quality IS NULL OR p_quality < 0 OR p_quality > 5 THEN
    RAISE EXCEPTION 'invalid quality (must be 0..5)';
  END IF;

  SELECT *
    INTO r
    FROM public.user_question_review
   WHERE user_id = p_user_id AND question_id = p_question_id
   FOR UPDATE;

  IF NOT FOUND THEN
    IF p_quality >= 3 THEN
      RETURN; -- insert-only-on-failure : NOOP
    END IF;

    INSERT INTO public.user_question_review (
      user_id, question_id, sequence_id,
      ease_factor, interval_days, consecutive_correct,
      next_review_date, last_reviewed_at, last_quality
    ) VALUES (
      p_user_id, p_question_id, p_sequence_id,
      2.50, 2, 0,
      CURRENT_DATE + 2, now(), p_quality
    );
    RETURN;
  END IF;

  IF p_quality < 3 THEN
    UPDATE public.user_question_review
       SET consecutive_correct = 0,
           interval_days       = 2,
           ease_factor         = GREATEST(1.30, ease_factor * 0.85),
           next_review_date    = CURRENT_DATE + 2,
           mastered_at         = NULL,
           last_reviewed_at    = now(),
           last_quality        = p_quality,
           updated_at          = now()
     WHERE id = r.id;
    RETURN;
  END IF;

  -- p_quality >= 3 et ligne existante
  v_new_consec   := r.consecutive_correct + 1;
  v_new_ease     := GREATEST(
    1.30,
    r.ease_factor + (0.10 - (5 - p_quality) * (0.08 + (5 - p_quality) * 0.02))
  );
  v_new_interval := GREATEST(1, ROUND(r.interval_days * v_new_ease))::integer;

  IF v_new_consec >= 3 THEN
    UPDATE public.user_question_review
       SET consecutive_correct = v_new_consec,
           ease_factor         = v_new_ease,
           interval_days       = v_new_interval,
           next_review_date    = NULL,
           mastered_at         = now(),
           last_reviewed_at    = now(),
           last_quality        = p_quality,
           updated_at          = now()
     WHERE id = r.id;
  ELSE
    UPDATE public.user_question_review
       SET consecutive_correct = v_new_consec,
           ease_factor         = v_new_ease,
           interval_days       = v_new_interval,
           next_review_date    = CURRENT_DATE + v_new_interval,
           last_reviewed_at    = now(),
           last_quality        = p_quality,
           updated_at          = now()
     WHERE id = r.id;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_sm2_state(uuid, uuid, uuid, integer)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_sm2_state(uuid, uuid, uuid, integer)
  TO authenticated;
