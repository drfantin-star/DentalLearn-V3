-- Nom du fichier : 20260423_news_schema.sql
-- Date de création : 2026-04-23
-- Ticket : feature/news-ticket-1
-- Description : pgvector + 10 tables pipeline Section News + indexes + RLS admin-only
-- Rollback : supabase/migrations/20260423_news_schema_down.sql

-- ============================================================================
-- 1. EXTENSION
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- 2. TABLES (créées dans l'ordre des dépendances FK)
-- ============================================================================

-- --- 2.1. news_taxonomy -----------------------------------------------------
CREATE TABLE public.news_taxonomy (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type         text NOT NULL CHECK (type IN ('specialite','theme','niveau_preuve')),
  slug         text NOT NULL,
  label        text NOT NULL,
  description  text,
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_taxonomy_type_slug_uniq UNIQUE (type, slug)
);

COMMENT ON TABLE public.news_taxonomy IS
  'Vocabulaires contrôlés utilisés comme tags fermés par les LLM : spécialités (12), thèmes cliniques (semi-ouvert, géré via admin), niveaux de preuve (Oxford CEBM, 10). Spec §8bis.2.';

-- --- 2.2. news_sources ------------------------------------------------------
CREATE TABLE public.news_sources (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text NOT NULL,
  type             text NOT NULL CHECK (type IN (
                     'pubmed','rss','crossref','semantic_scholar','openalex','manual'
                   )),
  url              text,
  query            jsonb,
  spe_tags         text[],
  active           boolean NOT NULL DEFAULT true,
  notes            text,
  last_fetched_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.news_sources IS
  'Catalogue des sources d''ingestion (PubMed, RSS, API, manual). Le champ query stocke la requête MeSH ou la config RSS. Le champ notes documente les dépendances tierces (ex: rss.app pour L''Information Dentaire).';

-- --- 2.3. news_raw ----------------------------------------------------------
CREATE TABLE public.news_raw (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id     uuid REFERENCES public.news_sources(id) ON DELETE SET NULL,
  external_id   text,
  doi           text,
  title         text NOT NULL,
  abstract      text,
  authors       text[],
  journal       text,
  published_at  date,
  url           text,
  raw_payload   jsonb,
  ingested_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_raw_source_external_uniq UNIQUE (source_id, external_id)
);

COMMENT ON TABLE public.news_raw IS
  'Articles bruts ingérés (PubMed, RSS, Crossref, etc.). Dédoublonnés par (source_id, external_id). raw_payload conserve la réponse intégrale de l''API/RSS pour traçabilité et reparsing éventuel.';

-- --- 2.4. news_scored -------------------------------------------------------
CREATE TABLE public.news_scored (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_id           uuid NOT NULL REFERENCES public.news_raw(id) ON DELETE CASCADE,
  relevance_score  numeric(3,2),
  spe_tags         text[],
  reasoning        text,
  dedupe_hash      text,
  status           text NOT NULL DEFAULT 'candidate' CHECK (status IN (
                     'candidate','selected','rejected','duplicate'
                   )),
  llm_model        text,
  scored_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.news_scored IS
  'Scoring LLM (Claude Haiku, spec §6.3) des articles bruts. dedupe_hash = SHA256 de titre normalisé + DOI. status=''selected'' si relevance_score >= 0.70 (top 10-15 / semaine).';

-- --- 2.5. news_syntheses ----------------------------------------------------
CREATE TABLE public.news_syntheses (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scored_id         uuid REFERENCES public.news_scored(id) ON DELETE SET NULL,
  raw_id            uuid REFERENCES public.news_raw(id) ON DELETE SET NULL,
  summary_fr        text NOT NULL,
  method            text,
  key_figures       text[],
  evidence_level    text,
  clinical_impact   text,
  caveats           text,
  -- Tagging 3 dimensions (slugs issus de news_taxonomy)
  specialite        text,
  themes            text[],
  niveau_preuve     text,
  keywords_libres   text[],
  -- Recherche sémantique
  embedding         vector(1536),
  -- Export Google Drive
  gdrive_file_id    text,
  gdrive_url        text,
  gdrive_synced_at  timestamptz,
  -- Provenance
  manual_added      boolean NOT NULL DEFAULT false,
  added_by          uuid,
  -- État
  status            text NOT NULL DEFAULT 'active' CHECK (status IN ('active','retracted','deleted')),
  retracted_at      timestamptz,
  llm_model         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.news_syntheses IS
  'Fiches de synthèse structurées (Claude Sonnet, spec §6.4) + tagging 3 dimensions + embedding 1536 dims (OpenAI text-embedding-3-small). Double usage : alimentation podcast + Knowledge Base réutilisable (§8bis). manual_added=true si ajoutée hors pipeline via admin.';

-- --- 2.6. news_episodes -----------------------------------------------------
CREATE TABLE public.news_episodes (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type              text NOT NULL CHECK (type IN ('digest','insight')),
  week_iso          text,
  title             text NOT NULL,
  script_md         text NOT NULL,
  script_with_tags  text,
  audio_url         text,
  duration_s        integer,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN (
                      'draft','review_cs','ready','published','archived'
                    )),
  validated_by      uuid,
  cs_reviewed_by    uuid[],
  published_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.news_episodes IS
  'Épisodes podcast publiables : digest hebdomadaire (≈12 min) ou Insight ponctuel (5-8 min). script_md = version rédactionnelle, script_with_tags = version avec audio tags ElevenLabs v3 (Phase 2).';

-- --- 2.7. news_episode_items ------------------------------------------------
CREATE TABLE public.news_episode_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id    uuid NOT NULL REFERENCES public.news_episodes(id) ON DELETE CASCADE,
  synthesis_id  uuid REFERENCES public.news_syntheses(id) ON DELETE SET NULL,
  order_idx     integer NOT NULL
);

COMMENT ON TABLE public.news_episode_items IS
  'Liaison N:N entre épisodes et synthèses citées. order_idx = position dans le script. synthesis_id=NULL si la synthèse liée a été hard-deleted (cas rare : le soft delete via status reste la norme).';

-- --- 2.8. news_references ---------------------------------------------------
CREATE TABLE public.news_references (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id    uuid NOT NULL REFERENCES public.news_episodes(id) ON DELETE CASCADE,
  doi           text,
  citation_apa  text,
  url           text,
  archived_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.news_references IS
  'Références bibliographiques archivées par épisode (obligation §7bis.4 : affichage public des références + traçabilité scientifique). Une ligne par article cité.';

-- --- 2.9. news_cs_comments --------------------------------------------------
CREATE TABLE public.news_cs_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id  uuid NOT NULL REFERENCES public.news_episodes(id) ON DELETE CASCADE,
  cs_member   uuid NOT NULL,
  comment     text,
  status      text CHECK (status IN ('note','request_change','approved')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.news_cs_comments IS
  'Fil de commentaires du Conseil Scientifique sur un épisode. Circuit CS détaillé reporté à une v1.3 de la spec ; table en place dès Phase 1 pour éviter migration future.';

-- --- 2.10. news_corrections -------------------------------------------------
CREATE TABLE public.news_corrections (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  episode_id              uuid REFERENCES public.news_episodes(id) ON DELETE SET NULL,
  reported_by_email       text,
  reported_at             timestamptz NOT NULL DEFAULT now(),
  severity                text NOT NULL CHECK (severity IN ('1_mineur','2_significatif','3_critique')),
  nature                  text NOT NULL,
  faulty_script_snapshot  jsonb,
  decided_by              uuid,
  decided_at              timestamptz,
  correction_applied_at   timestamptz,
  retention_until         date NOT NULL DEFAULT (current_date + interval '3 years')
);

COMMENT ON TABLE public.news_corrections IS
  'Politique de rectification (spec §7ter) — conservation 3 ans. episode_id ON DELETE SET NULL pour préserver le dossier de correction même si l''épisode fautif est supprimé (exigence traçabilité). faulty_script_snapshot archive la version incriminée.';

-- ============================================================================
-- 3. INDEXES
-- ============================================================================

-- news_syntheses — recherche sémantique (pgvector ivfflat, distance cosinus).
-- Note : ivfflat optimal après REINDEX sur données réelles.
-- lists=100 convient jusqu'à ~10k synthèses ; à revoir au-delà.
CREATE INDEX news_syntheses_embedding_idx
  ON public.news_syntheses
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- news_syntheses — filtre par spécialité (B-tree).
CREATE INDEX news_syntheses_spe_idx
  ON public.news_syntheses (specialite);

-- news_syntheses — filtre par thèmes (GIN sur array text[]).
CREATE INDEX news_syntheses_themes_idx
  ON public.news_syntheses
  USING gin (themes);

-- news_syntheses — recherche plein texte français (GIN sur tsvector).
CREATE INDEX news_syntheses_fulltext_idx
  ON public.news_syntheses
  USING gin (to_tsvector('french', coalesce(summary_fr, '')));

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================
-- Modèle : RLS activée + aucune policy permissive pour anon/authenticated.
--   Seul le service_role (qui bypasse RLS par défaut) accède aux tables
--   news_*. La garde applicative est appliquée côté API routes Next.js via
--   email admin hardcodé (pattern existant — cf README "Dette technique
--   connue" et §4.11 du handoff).
--
-- La policy "Service role full access" est redondante (service_role bypasse
-- déjà RLS) mais rendue explicite pour documentation et review.
-- ============================================================================

ALTER TABLE public.news_taxonomy        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_sources         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_raw             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_scored          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_syntheses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_episodes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_episode_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_references      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_cs_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.news_corrections     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.news_taxonomy        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.news_sources         FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.news_raw             FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.news_scored          FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.news_syntheses       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.news_episodes        FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.news_episode_items   FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.news_references      FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.news_cs_comments     FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON public.news_corrections     FOR ALL TO service_role USING (true) WITH CHECK (true);
