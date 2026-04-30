-- Nom du fichier : 20260430_news_syntheses_published_at.sql
-- Date de création : 2026-04-30
-- Ticket : Ticket 8 — admin News (claude/news-admin-ticket-8-phase1)
-- Description : dénormalisation de news_raw.published_at sur
--               news_syntheses pour permettre un tri direct sans
--               JOIN PostgREST + index DESC NULLS LAST + trigger
--               de sync depuis news_raw.

-- ============================================================================
-- Contexte
-- ============================================================================
-- Le tri par table jointe via PostgREST (option foreignTable /
-- referencedTable du Supabase JS .order()) ne s'applique pas de manière
-- fiable sur un LEFT JOIN news_raw : silencieusement ignoré → la liste
-- /admin/news reste triée par created_at.
--
-- Plan B : dénormaliser news_raw.published_at sur news_syntheses,
-- alimenté automatiquement par un trigger BDD à chaque INSERT ou
-- UPDATE OF raw_id. Avantages :
--   - tri SQL natif sur la table principale (perf + index B-tree),
--   - pas de JOIN PostgREST côté API,
--   - cohérence garantie même si l'edge function ne sait rien de la
--     colonne (le trigger remplit à l'INSERT).
--
-- Choix de type : DATE (mêmes contraintes que news_raw.published_at,
-- granularité jour suffisante pour l'éditorial).
--
-- Index : DESC NULLS LAST aligné sur le cas d'usage majoritaire
-- (?sort=published_at_desc, articles les plus récents en tête).

-- ============================================================================
-- 1. Colonne published_at sur news_syntheses
-- ============================================================================

ALTER TABLE public.news_syntheses
  ADD COLUMN IF NOT EXISTS published_at DATE;

-- ============================================================================
-- 2. Index B-tree pour tri performant
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_news_syntheses_published_at
  ON public.news_syntheses (published_at DESC NULLS LAST);

-- ============================================================================
-- 3. Backfill — recopie depuis news_raw pour les lignes existantes
-- ============================================================================
-- Note : avant migration, 196 lignes news_syntheses, toutes avec raw_id
-- non NULL → backfill complet attendu sur les 196.

UPDATE public.news_syntheses ns
SET published_at = nr.published_at
FROM public.news_raw nr
WHERE nr.id = ns.raw_id
  AND ns.published_at IS NULL;

-- ============================================================================
-- 4. Trigger BEFORE INSERT/UPDATE OF raw_id pour sync automatique
-- ============================================================================
-- Le trigger ne déclenche que si raw_id est défini (cas pipeline normal).
-- Si l'utilisateur définit explicitement published_at à l'INSERT, le
-- trigger ÉCRASE la valeur fournie par celle de news_raw : seule source
-- de vérité = news_raw.published_at. Les ajouts manuels sans raw_id
-- conservent published_at NULL.

CREATE OR REPLACE FUNCTION public.sync_news_synthesis_published_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.raw_id IS NOT NULL THEN
    SELECT published_at INTO NEW.published_at
    FROM public.news_raw
    WHERE id = NEW.raw_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_news_synthesis_published_at
  ON public.news_syntheses;

CREATE TRIGGER trg_sync_news_synthesis_published_at
  BEFORE INSERT OR UPDATE OF raw_id ON public.news_syntheses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_news_synthesis_published_at();

-- ============================================================================
-- Sanity checks (à exécuter manuellement après application)
-- ============================================================================
-- SELECT count(*) FILTER (WHERE published_at IS NOT NULL) AS filled,
--        count(*)                                          AS total
-- FROM public.news_syntheses;
-- → attendu : filled = 196, total = 196
--
-- EXPLAIN SELECT id FROM public.news_syntheses
-- ORDER BY published_at DESC NULLS LAST LIMIT 20;
-- → doit utiliser idx_news_syntheses_published_at
