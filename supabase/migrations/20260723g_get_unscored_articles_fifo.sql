-- Nom du fichier : 20260723g_get_unscored_articles_fifo.sql
-- Date de création : 2026-07-23
-- Ticket : news-pipeline-dedup-sizing
-- Description : get_unscored_articles — ORDER BY published_at DESC NULLS LAST
--               remplacé par ORDER BY ingested_at ASC (FIFO). Lot 4 du plan.
-- Rollback : supabase/migrations/20260723g_get_unscored_articles_fifo_down.sql

-- ============================================================================
-- Contexte
-- ============================================================================
-- L'ordre published_at DESC NULLS LAST fait passer les articles les plus
-- récents en premier à chaque run limit:50. Avec un flux d'ingestion >
-- capacité de scoring hebdo, les articles plus anciens ne remontent jamais
-- en tête de file (famine de la queue) — le backlog vieillit sans jamais être
-- traité. Un FIFO strict sur ingested_at (le plus ancien d'abord) garantit
-- que chaque article finit par être scoré, et rend le mode « Ingérer un
-- article » (ingestion manuelle ponctuelle) réellement utilisable : l'article
-- ingéré prend sa place dans la file au lieu d'être repoussé indéfiniment par
-- de nouveaux articles plus récents.
--
-- Seul le ORDER BY change. Signature, filtres (NOT EXISTS news_scored,
-- retracted_at_ingestion), sécurité (SECURITY DEFINER, grants) inchangés.

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
    r.ingested_at ASC
  LIMIT GREATEST(limit_count, 0);
$$;

COMMENT ON FUNCTION public.get_unscored_articles(int) IS
  'Articles news_raw non encore présents en news_scored, triés FIFO (ingested_at ASC depuis le 23/07/2026 — auparavant published_at DESC NULLS LAST, qui affamait la queue). Filtre raw_payload->>retracted_at_ingestion = true. Appelée par l''Edge Function score_articles.';

-- ============================================================================
-- Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT ingested_at FROM get_unscored_articles(5) ORDER BY ingested_at;
-- Résultat attendu : 5 lignes triées croissant sur ingested_at (les plus
-- anciennes en tête).
