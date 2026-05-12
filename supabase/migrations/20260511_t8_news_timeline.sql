-- Nom du fichier : 20260511_t8_news_timeline.sql
-- Date de création : 2026-05-11
-- Ticket : POC-T8 — NewsVisualSequence + génération auto timeline news déterministe.
-- Description : ajoute deux colonnes additives sur news_episodes pour persister
--               la timeline JSON générée déterministiquement à partir des
--               synthèses associées (1 timeline par épisode/journal,
--               N chapitres = N synthèses).
--
-- Granularité : épisode/journal (Q-T8-2=a). 1 MP3 ↔ 1 timeline avec chapitres.
-- Source de vérité libellés taxonomy : news_taxonomy (Q-T8-5=c) — pas de
-- constante TS dupliquée.
--
-- Rollback : 20260511_t8_news_timeline_down.sql.
--
-- AUDIT PRÉALABLE (11 mai 2026) :
--   - Pré-flight SQL #2 : aucune colonne timeline_* n'existe sur news_episodes.
--   - Pré-flight SQL #3 : 2 lignes en BDD (1 insight archived + 1 journal
--     draft). Migration additive sans risque de migration de données.
--   - Pré-flight SQL #1 : 18 colonnes existantes — pas de collision de nom.
--   - Auto-publication (timeline_published=TRUE) : pas de validation humaine
--     requise (mapping déterministe pur, cf. Q6 spec POC §7).

-- ============================================================================
-- 1. Colonnes additives news_episodes.timeline_url + timeline_published
-- ============================================================================

ALTER TABLE public.news_episodes
  ADD COLUMN IF NOT EXISTS timeline_url text,
  ADD COLUMN IF NOT EXISTS timeline_published boolean NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.news_episodes.timeline_url IS
  'POC-T8 : URL Storage du JSON timeline (bucket audio-timelines, sous-dossier news/{type}/). NULL = pas de timeline générée. Granularité épisode/journal (1 MP3 ↔ 1 timeline avec chapitres = 1 chapitre par synthèse).';

COMMENT ON COLUMN public.news_episodes.timeline_published IS
  'POC-T8 : flag auto-publié à TRUE par buildNewsTimeline (mapping déterministe, pas de validation humaine requise). Distinct du status news_episodes pour éviter de coupler le cycle audio au cycle visu.';

-- ============================================================================
-- 2. Index partiel pour lookup rapide des épisodes avec timeline publiée
-- ============================================================================

CREATE INDEX IF NOT EXISTS news_episodes_timeline_published_idx
  ON public.news_episodes(timeline_published)
  WHERE timeline_published = TRUE;
