-- ============================================
-- Table: daily_quiz_results
-- Stocke les résultats du quiz quotidien par utilisateur
-- ============================================

CREATE TABLE IF NOT EXISTS public.daily_quiz_results (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_date date NOT NULL DEFAULT CURRENT_DATE,
  score integer NOT NULL DEFAULT 0,
  total_questions integer NOT NULL DEFAULT 10,
  total_points integer NOT NULL DEFAULT 0,
  question_ids uuid[] DEFAULT '{}',
  completed_at timestamp with time zone NULL,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT daily_quiz_results_pkey PRIMARY KEY (id),
  CONSTRAINT daily_quiz_results_user_date_unique UNIQUE (user_id, quiz_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_quiz_results_user_id
  ON public.daily_quiz_results USING btree (user_id);

CREATE INDEX IF NOT EXISTS idx_daily_quiz_results_quiz_date
  ON public.daily_quiz_results USING btree (quiz_date);

-- RLS
ALTER TABLE public.daily_quiz_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own daily quiz results"
  ON public.daily_quiz_results
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily quiz results"
  ON public.daily_quiz_results
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily quiz results"
  ON public.daily_quiz_results
  FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================
-- RPC: get_daily_quiz(p_user_id uuid)
-- Sélection déterministe de 10 questions/jour via setseed()
-- Filtre : is_daily_quiz_eligible = true
-- Retourne les questions avec le titre de la formation associée
-- ============================================

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
  -- Seed déterministe basé sur la date du jour + user_id
  -- Cela garantit que chaque utilisateur reçoit les mêmes 10 questions
  -- pour une journée donnée, mais des questions différentes entre utilisateurs
  v_seed := (
    EXTRACT(EPOCH FROM v_today::timestamp)::bigint
    + ('x' || substr(p_user_id::text, 1, 8))::bit(32)::int
  )::double precision / 2147483647.0;

  -- Normaliser le seed entre 0 et 1
  v_seed := v_seed - floor(v_seed);
  IF v_seed < 0 THEN v_seed := v_seed + 1; END IF;

  -- Appliquer le seed pour un ordre aléatoire reproductible
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.get_daily_quiz(uuid) TO authenticated;
