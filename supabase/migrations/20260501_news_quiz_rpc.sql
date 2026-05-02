-- Nom du fichier : 20260501_news_quiz_rpc.sql
-- Date de création : 2026-05-01
-- Ticket : feature/news-frontend-ticket-9 (claude/news-backend-foundations-oEQFw)
-- Description : RPC `get_news_quiz_by_specialite` — retourne `p_limit` questions
--               news aléatoires (is_daily_quiz_eligible=true) pour une spécialité
--               donnée, avec join sur news_syntheses pour récupérer le titre
--               et la spécialité affichables côté frontend.
-- Rollback : supabase/migrations/20260501_news_quiz_rpc_down.sql

CREATE OR REPLACE FUNCTION get_news_quiz_by_specialite(
  p_specialite text,
  p_limit int DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  question_text text,
  options jsonb,
  feedback_correct text,
  feedback_incorrect text,
  points int,
  question_type varchar,
  display_title text,
  specialite text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM setseed(random());
  RETURN QUERY
  SELECT
    q.id,
    q.question_text,
    q.options,
    q.feedback_correct,
    q.feedback_incorrect,
    q.points,
    q.question_type,
    ns.display_title,
    ns.specialite
  FROM public.questions q
  JOIN public.news_syntheses ns ON ns.id = q.news_synthesis_id
  WHERE q.is_daily_quiz_eligible = true
    AND ns.specialite = p_specialite
    AND ns.status = 'active'
  ORDER BY random()
  LIMIT p_limit;
END;
$$;
