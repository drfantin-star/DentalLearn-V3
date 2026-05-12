-- Nom du fichier : 20260511_t8_news_timeline_down.sql
-- Rollback de : 20260511_t8_news_timeline.sql (POC-T8).
-- Description : retire les colonnes timeline_url + timeline_published ainsi
--               que l'index partiel news_episodes_timeline_published_idx.
--
-- ⚠️ Destructeur : toute timeline persistée dans news_episodes.timeline_url
--    sera perdue (les JSON eux-mêmes restent dans le bucket audio-timelines,
--    mais le lien BDD disparaît).

DROP INDEX IF EXISTS public.news_episodes_timeline_published_idx;

ALTER TABLE public.news_episodes
  DROP COLUMN IF EXISTS timeline_published,
  DROP COLUMN IF EXISTS timeline_url;
