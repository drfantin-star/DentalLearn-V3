-- Nom du fichier : 20260518_rpc_get_unscored_articles.sql
-- Date de création : 2026-05-18
-- Ticket : fix/score-articles-timeout
-- Description : RPC get_unscored_articles + count_unscored_articles pour
--               remplacer le double SELECT * sans filtre (news_raw +
--               news_scored, ~50k lignes chacun) qui faisait dépasser
--               IDLE_TIMEOUT 150s à l'Edge Function score_articles.
-- Rollback : supabase/migrations/20260518_rpc_get_unscored_articles_down.sql
--
-- ============================================================================
-- Contexte
-- ============================================================================
-- L'ancienne implémentation chargeait toute news_raw + toute news_scored
-- côté JS puis filtrait "déjà scoré" en mémoire. Avec le volume actuel
-- (>10k lignes news_raw), ce double chargement seul dépassait 150s et
-- coupait l'invocation avant le moindre appel Haiku.
--
-- Les RPC ci-dessous poussent le NOT EXISTS et le tri côté Postgres :
--   * get_unscored_articles(limit_count int) : renvoie au plus limit_count
--     lignes news_raw non encore scorées, triées selon l'ordre canonique
--     du pipeline (published_at DESC NULLS LAST, pubmed first, ingested_at ASC).
--     Filtre aussi les articles marqués retracted_at_ingestion=true dans
--     raw_payload (économie supplémentaire — ils seraient écartés en aval).
--   * count_unscored_articles() : compte rapide (HEAD-like) des articles
--     non scorés. Sert à alimenter total_remaining_estimate / has_more sans
--     charger les lignes elles-mêmes.
--
-- Index utilisés :
--   * news_scored_raw_id_idx (existant) — accélère le NOT EXISTS.
--   * news_raw_source_id_idx (existant) — accélère le JOIN news_sources.
--
-- Sécurité :
--   * SECURITY DEFINER + search_path = public figé (best practice Supabase
--     pour éviter le hijack via search_path utilisateur).
--   * STABLE (lecture seule, pas de side effects).
--   * EXECUTE révoqué de public ; accordé uniquement à service_role car la
--     fonction n'est appelée que depuis l'Edge Function score_articles
--     (Bearer service_role_key).

-- ----------------------------------------------------------------------------
-- 1. get_unscored_articles(limit_count int)
-- ----------------------------------------------------------------------------
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

REVOKE EXECUTE ON FUNCTION public.get_unscored_articles(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_unscored_articles(int) TO service_role;

-- ----------------------------------------------------------------------------
-- 2. count_unscored_articles()
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.count_unscored_articles()
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM public.news_raw r
  WHERE NOT EXISTS (
    SELECT 1 FROM public.news_scored ns WHERE ns.raw_id = r.id
  )
  AND COALESCE(r.raw_payload->>'retracted_at_ingestion', 'false') <> 'true';
$$;

COMMENT ON FUNCTION public.count_unscored_articles() IS
  'Compte des articles news_raw non encore scorés (filtre retracted appliqué, cohérent avec get_unscored_articles). Sert à alimenter total_remaining_estimate / has_more dans score_articles sans charger les lignes.';

REVOKE EXECUTE ON FUNCTION public.count_unscored_articles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unscored_articles() TO service_role;
