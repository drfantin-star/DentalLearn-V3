-- Nom du fichier : 20260723g_get_unscored_articles_fifo_down.sql
-- Date de création : 2026-07-23
-- Ticket : news-pipeline-dedup-sizing
-- Description : Rollback — restaure ORDER BY published_at DESC NULLS LAST (+ pubmed first + ingested_at ASC)
-- Rollback : n/a (ce fichier EST le rollback de 20260723g_get_unscored_articles_fifo.sql)

CREATE OR REPLACE FUNCTION public.get_unscored_articles(limit_count int)
RETURNS TABLE (
  id            uuid,
  title         text,
  abstract      text,
  doi           text,
  journal       text,
  published_at  date,
  ingested_at   timestamptz,
  raw_payload   jsonb,
  source_type   text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id,
    r.title,
    r.abstract,
    r.doi,
    r.journal,
    r.published_at,
    r.ingested_at,
    r.raw_payload,
    s.type AS source_type
  FROM public.news_raw r
  LEFT JOIN public.news_sources s ON s.id = r.source_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.news_scored ns WHERE ns.raw_id = r.id
  )
  AND COALESCE(r.raw_payload->>'retracted_at_ingestion', 'false') <> 'true'
  ORDER BY
    r.published_at DESC NULLS LAST,
    (s.type = 'pubmed') DESC,
    r.ingested_at ASC
  LIMIT GREATEST(limit_count, 0);
$$;

COMMENT ON FUNCTION public.get_unscored_articles(int) IS
  'Articles news_raw non encore présents en news_scored, triés (published_at DESC NULLS LAST, pubmed first, ingested_at ASC). Filtre raw_payload->>retracted_at_ingestion = true. Appelée par l''Edge Function score_articles (cf. ticket fix/score-articles-timeout, mai 2026).';

-- ============================================================================
-- Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT published_at FROM get_unscored_articles(5) ORDER BY published_at DESC NULLS LAST;
