-- Nom du fichier : 20260918a_rpc_get_unscored_articles_freshness.sql
-- Date de création : 2026-09-18
-- Ticket : news-pipeline-fraicheur-seuil-crons (Lot 1)
-- Description : get_unscored_articles — tri par fraîcheur de publication en
--               tête de file, FIFO d'ingestion conservé pour le reste.
--               Ajout du paramètre freshness_days integer DEFAULT 90.
-- Rollback : supabase/migrations/20260918a_rpc_get_unscored_articles_freshness_down.sql

-- ============================================================================
-- Contexte
-- ============================================================================
-- Depuis 20260723g, la RPC trie en FIFO strict sur r.ingested_at. Ce choix
-- garantissait qu'aucun article ne reste indéfiniment dans la file, mais il
-- a un effet de bord mesuré le 18/09/2026 : les 30 places quotidiennes de
-- scoring partent aux articles ingérés en juin, et un article scoré a en
-- moyenne 162 jours au moment où il est évalué. La rubrique actualités
-- publie donc de la science vieille de plusieurs mois.
--
-- État mesuré le 18/09/2026 :
--   - 2 593 articles non scorés, le plus ancien ingéré le 08/06
--   - dont 1 265 publiés il y a moins de 90 jours (fenêtre retenue)
--   - reste hors fenêtre : 1 328
--   - ~190 articles ingérés / semaine, 210 scorés / semaine (30/jour)
--
-- Correctif : deux files. Les articles publiés dans la fenêtre de fraîcheur
-- passent d'abord, du plus récent au plus ancien ; tout le reste conserve le
-- FIFO d'ingestion existant et consomme les places restantes. Aucun article
-- ne devient inéligible : count_unscored_articles() est inchangé.
--
-- Fenêtre de 90 jours (arbitrage Dr Fantin) : assez large pour laisser
-- passer les revues systématiques et méta-analyses, qui sortent plus
-- lentement que les essais cliniques. À 210 scorés / semaine, il faut
-- compter ~6 semaines pour absorber le stock de la fenêtre et traiter les
-- publications de la semaine en cours.
--
-- ============================================================================
-- Pourquoi un DROP + CREATE (et non un CREATE OR REPLACE)
-- ============================================================================
-- Ajouter un paramètre change la signature de la fonction. Un CREATE OR
-- REPLACE créerait une seconde fonction get_unscored_articles(integer,
-- integer) à côté de get_unscored_articles(integer), et l'appel à un seul
-- argument deviendrait ambigu. Le DROP explicite de l'ancienne signature est
-- donc obligatoire.
--
-- ⚠️ Migration destructive sur un objet fonction (DROP FUNCTION). Aucune
-- donnée n'est touchée : news_raw, news_scored et news_sources sont en
-- lecture seule ici.
--
-- ⚠️ Le DROP fait perdre les GRANT. L'état à restaurer à l'identique est :
--   proacl = {postgres=X/postgres,service_role=X/postgres}
-- soit EXECUTE pour postgres et service_role uniquement — ni anon, ni
-- authenticated (fermeture de surface 20260721e_sec_lot1_close_surface.sql).
--
-- ============================================================================
-- Appelant inchangé
-- ============================================================================
-- supabase/functions/score_articles/index.ts appelle
--   supabase.rpc("get_unscored_articles", { limit_count: limit })
-- Grâce au DEFAULT 90, aucun changement TypeScript n'est nécessaire, et la
-- valeur de la fenêtre reste modifiable par simple migration, sans
-- redéploiement d'Edge Function.

-- ============================================================================
-- 1. DROP de l'ancienne signature
-- ============================================================================

DROP FUNCTION public.get_unscored_articles(integer);

-- ============================================================================
-- 2. CREATE — nouvelle signature (limit_count, freshness_days DEFAULT 90)
-- ============================================================================
-- Conservés à l'identique par rapport à 20260723g : LANGUAGE sql, STABLE,
-- SECURITY DEFINER, SET search_path = public, la liste des colonnes
-- retournées, le filtre NOT EXISTS news_scored, le filtre
-- retracted_at_ingestion, et LIMIT GREATEST(limit_count, 0).

CREATE FUNCTION public.get_unscored_articles(
  limit_count    integer,
  freshness_days integer DEFAULT 90
)
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
  -- Groupe 0 = fenêtre de fraîcheur, du plus récent au plus ancien.
  -- Groupe 1 = tout le reste (y compris published_at NULL, car NULL >= date
  -- vaut NULL donc le CASE retombe sur ELSE 1). Dans ce groupe, la seconde
  -- expression vaut NULL pour toutes les lignes : elles sont ex aequo et le
  -- tri retombe sur le FIFO d'ingestion de 20260723g.
  ORDER BY
    CASE WHEN r.published_at >= CURRENT_DATE - freshness_days THEN 0 ELSE 1 END,
    CASE WHEN r.published_at >= CURRENT_DATE - freshness_days THEN r.published_at END DESC,
    r.ingested_at ASC
  LIMIT GREATEST(limit_count, 0);
$$;

COMMENT ON FUNCTION public.get_unscored_articles(integer, integer) IS
  'Articles news_raw non encore présents en news_scored. Tri à deux files depuis le 18/09/2026 : les articles publiés dans les freshness_days derniers jours (défaut 90) passent d''abord, du plus récent au plus ancien ; les autres conservent le FIFO ingested_at ASC introduit le 23/07/2026. Aucun article n''est rendu inéligible. Filtre raw_payload->>retracted_at_ingestion = true. Appelée par l''Edge Function score_articles, qui ne passe que limit_count.';

-- ============================================================================
-- 3. Droits — restauration à l'identique de l'état pré-DROP
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.get_unscored_articles(integer, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_unscored_articles(integer, integer) TO postgres;
GRANT  EXECUTE ON FUNCTION public.get_unscored_articles(integer, integer) TO service_role;

-- ============================================================================
-- 4. Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- -- 4.1 Les 30 premiers sont dans la fenêtre, du plus récent au plus ancien
-- SELECT published_at, ingested_at FROM get_unscored_articles(30);
-- Attendu : 30 lignes, published_at >= CURRENT_DATE - 90, tri décroissant.
--
-- -- 4.2 Au-delà de la fenêtre, le tri redevient croissant sur ingested_at
-- SELECT published_at, ingested_at FROM get_unscored_articles(2000);
--
-- -- 4.3 Appel à un seul argument (comportement du code TypeScript)
-- SELECT COUNT(*) FROM get_unscored_articles(30);   -- attendu : 30
--
-- -- 4.4 Aucun article perdu
-- SELECT count_unscored_articles();  -- attendu : identique à avant migration
--
-- -- 4.5 Droits
-- SELECT p.oid::regprocedure, p.proacl
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'get_unscored_articles';
-- Attendu : {postgres=X/postgres,service_role=X/postgres} — ni anon, ni
-- authenticated.
