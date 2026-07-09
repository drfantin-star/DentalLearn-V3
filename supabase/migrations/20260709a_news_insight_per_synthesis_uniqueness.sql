-- Nom du fichier : 20260709a_news_insight_per_synthesis_uniqueness.sql
-- Date de création : 2026-07-09
-- Description : change la règle d'unicité des épisodes News de type 'insight'.
--
--   AVANT : l'index partiel UNIQUE news_episodes_type_week_uniq imposait
--           "1 seul épisode non-archivé par (type, week_iso)" pour TOUS les
--           types, insight compris. Conséquence : impossible d'avoir deux
--           insights actifs la même semaine, ce qui forçait le code applicatif
--           (route generate-script) à archiver tout insight actif de la
--           semaine à chaque nouvelle génération — y compris ceux d'autres
--           synthèses (effet de bord = perte de podcasts publiés).
--
--   APRÈS : décision produit — UN insight actif par SYNTHÈSE, plusieurs
--           insights peuvent coexister la même semaine.
--             1. L'unicité hebdo (type, week_iso) est CONSERVÉE pour les
--                types 'journal' et 'digest', mais NE s'applique plus à
--                'insight'.
--             2. Une nouvelle règle "1 insight non-archivé par synthèse" est
--                introduite. Le lien insight -> synthèse n'existe QUE via la
--                table de jonction news_episode_items (aucune colonne
--                synthesis_id sur news_episodes) ; le statut/type vivent sur
--                news_episodes. Un index partiel UNIQUE ne peut pas croiser
--                deux tables, on l'implémente donc via un trigger sur
--                news_episode_items (source de vérité du lien).
--
-- Rollback : 20260709a_news_insight_per_synthesis_uniqueness_down.sql.
--
-- Non destructif : aucun DROP TABLE/COLUMN, aucune donnée supprimée. Le
-- nouvel index couvre un sur-ensemble strictement plus petit que l'ancien
-- (mêmes lignes moins les insights) → sa création ne peut pas échouer sur
-- des données existantes valides. Le trigger ne valide QUE les nouvelles
-- écritures : il ne rejette pas d'éventuelles violations préexistantes.

-- ============================================================================
-- 1. Recréer l'index d'unicité hebdo en excluant le type 'insight'
-- ============================================================================
-- Conserve "1 non-archivé par (type, week_iso)" pour journal + digest.

DROP INDEX IF EXISTS public.news_episodes_type_week_uniq;

CREATE UNIQUE INDEX news_episodes_type_week_uniq
  ON public.news_episodes (type, week_iso)
  WHERE week_iso IS NOT NULL
    AND status <> 'archived'
    AND type <> 'insight';

-- ============================================================================
-- 2. Unicité "1 insight non-archivé par synthèse" via trigger
-- ============================================================================
-- Le lien insight -> synthèse vit uniquement dans news_episode_items ; le
-- statut/type vivent sur news_episodes. On contrôle donc à l'insertion (et
-- au repointage) d'un item : refuser qu'une synthèse soit rattachée à un
-- second épisode insight non-archivé.
--
-- Compatible avec le flux applicatif (route generate-script) : le step 4
-- archive les anciens épisodes de la synthèse AVANT que le step 8 n'insère
-- le nouvel item, donc au moment du contrôle il n'existe pas d'autre insight
-- actif pour cette synthèse.

CREATE OR REPLACE FUNCTION public.news_insight_one_active_per_synthesis()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_type     text;
  v_status   text;
  v_conflict uuid;
BEGIN
  -- Item non rattaché à une synthèse (synthesis_id devenu NULL après un
  -- hard-delete de synthèse) : rien à contrôler.
  IF NEW.synthesis_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Type + statut de l'épisode référencé par ce lien.
  SELECT e.type, e.status
    INTO v_type, v_status
    FROM public.news_episodes e
   WHERE e.id = NEW.episode_id;

  -- Contrôle limité aux insights non-archivés. Les journaux passent par
  -- news_episode_syntheses (autre table) ; les digests ne créent pas d'item
  -- via ce chemin.
  IF v_type IS DISTINCT FROM 'insight' OR v_status = 'archived' THEN
    RETURN NEW;
  END IF;

  -- Existe-t-il DÉJÀ un autre insight non-archivé lié à la même synthèse ?
  SELECT e.id
    INTO v_conflict
    FROM public.news_episode_items it
    JOIN public.news_episodes e ON e.id = it.episode_id
   WHERE it.synthesis_id = NEW.synthesis_id
     AND it.id <> NEW.id
     AND e.id <> NEW.episode_id
     AND e.type = 'insight'
     AND e.status <> 'archived'
   LIMIT 1;

  IF v_conflict IS NOT NULL THEN
    RAISE EXCEPTION
      'Un insight non-archivé existe déjà pour la synthèse % (épisode %)',
      NEW.synthesis_id, v_conflict
      USING ERRCODE = 'unique_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS news_episode_items_one_active_insight
  ON public.news_episode_items;

CREATE TRIGGER news_episode_items_one_active_insight
  BEFORE INSERT OR UPDATE OF synthesis_id, episode_id
  ON public.news_episode_items
  FOR EACH ROW
  EXECUTE FUNCTION public.news_insight_one_active_per_synthesis();
