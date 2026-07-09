-- Rollback de 20260709a_news_insight_per_synthesis_uniqueness.sql
--
-- Restaure l'index d'unicité hebdo d'origine (applicable à TOUS les types,
-- insight compris) et retire le trigger + la fonction "1 insight par synthèse".
--
-- ATTENTION : après ce rollback, insérer un second insight non-archivé la
-- même semaine ISO violera de nouveau news_episodes_type_week_uniq. Ne
-- rejouer ce down que si le code applicatif est également revenu à la version
-- archivant les insights de la semaine (bloc "archivage défensif").

-- ============================================================================
-- 1. Retirer le trigger + la fonction "1 insight par synthèse"
-- ============================================================================

DROP TRIGGER IF EXISTS news_episode_items_one_active_insight
  ON public.news_episode_items;

DROP FUNCTION IF EXISTS public.news_insight_one_active_per_synthesis();

-- ============================================================================
-- 2. Restaurer l'index d'unicité hebdo d'origine (tous types)
-- ============================================================================

DROP INDEX IF EXISTS public.news_episodes_type_week_uniq;

CREATE UNIQUE INDEX news_episodes_type_week_uniq
  ON public.news_episodes (type, week_iso)
  WHERE week_iso IS NOT NULL AND status <> 'archived';
