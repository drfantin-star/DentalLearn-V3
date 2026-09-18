-- Nom du fichier : 20260918a_rpc_get_unscored_articles_freshness_down.sql
-- Date de création : 2026-09-18
-- Ticket : news-pipeline-fraicheur-seuil-crons (Lot 1)
-- Description : Rollback — restaure la signature à un seul argument et le
--               FIFO strict ingested_at ASC (état 20260723g).
-- Rollback : n/a (ce fichier EST le rollback de
--            20260918a_rpc_get_unscored_articles_freshness.sql)

-- ⚠️ Comme à l'aller, le retour change la signature : DROP de la fonction à
-- deux arguments puis CREATE de celle à un seul, et re-GRANT explicite.

DROP FUNCTION public.get_unscored_articles(integer, integer);

CREATE FUNCTION public.get_unscored_articles(limit_count integer)
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
    r.ingested_at ASC
  LIMIT GREATEST(limit_count, 0);
$$;

COMMENT ON FUNCTION public.get_unscored_articles(integer) IS
  'Articles news_raw non encore présents en news_scored, triés FIFO (ingested_at ASC depuis le 23/07/2026 — auparavant published_at DESC NULLS LAST, qui affamait la queue). Filtre raw_payload->>retracted_at_ingestion = true. Appelée par l''Edge Function score_articles.';

REVOKE EXECUTE ON FUNCTION public.get_unscored_articles(integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_unscored_articles(integer) TO postgres;
GRANT  EXECUTE ON FUNCTION public.get_unscored_articles(integer) TO service_role;

-- ============================================================================
-- Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT ingested_at FROM get_unscored_articles(5);
-- Attendu : 5 lignes triées croissant sur ingested_at (les plus anciennes en
-- tête).
