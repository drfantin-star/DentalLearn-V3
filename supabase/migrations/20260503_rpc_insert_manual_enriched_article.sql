-- Nom du fichier : 20260503_rpc_insert_manual_enriched_article.sql
-- Date de création : 2026-05-03
-- Ticket : T7-ter — Ingestion manuelle enrichie News (RPC atomique)
-- Description : crée la fonction `insert_manual_enriched_article` qui
--               encapsule, dans une transaction unique, les 4 INSERTs
--               nécessaires à la création d'un article enrichi manuellement
--               (news_raw + news_scored + news_syntheses + N questions).
--
-- Rollback : 20260503_rpc_insert_manual_enriched_article_down.sql.

-- ============================================================================
-- 1. Source virtuelle 'manual_admin'
-- ============================================================================
-- T7-ter introduit un second mode d'ingestion manuelle (formulaire enrichi).
-- Pour pouvoir distinguer dans les requêtes analytiques :
--   - les articles passés par le pipeline auto via /admin/news/manual (T8-P1,
--     source type='manual'),
--   - les articles saisis directement avec synthèse + questions via
--     /admin/news/manual mode "enriched" (T7-ter, source type='manual_admin'),
-- on crée une source dédiée. La contrainte CHECK existante sur
-- news_sources.type ne permet pas encore 'manual_admin' : on l'étend.

ALTER TABLE public.news_sources
  DROP CONSTRAINT IF EXISTS news_sources_type_check;

ALTER TABLE public.news_sources
  ADD CONSTRAINT news_sources_type_check
  CHECK (type = ANY (ARRAY[
    'pubmed'::text,
    'rss'::text,
    'crossref'::text,
    'semantic_scholar'::text,
    'openalex'::text,
    'manual'::text,
    'manual_admin'::text
  ]));

INSERT INTO public.news_sources (
  name, type, url, query, spe_tags, active, notes
)
SELECT
  'Ingestions manuelles enrichies admin',
  'manual_admin',
  NULL,
  '{"manual_enriched": true, "added_by": "admin_panel"}'::jsonb,
  ARRAY[]::text[],
  true,
  'Source virtuelle pour les articles saisis via /admin/news/manual en mode "enriched" (T7-ter). Chaque ligne news_raw avec ce source_id est créée par la RPC insert_manual_enriched_article et possède déjà sa synthèse + ses questions à l''insertion.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.news_sources WHERE type = 'manual_admin'
);

-- ============================================================================
-- 2. RPC : insert_manual_enriched_article
-- ============================================================================
-- Atomicité : toutes les insertions se font dans la même transaction
-- implicite que l'appel de la fonction. Si un INSERT échoue (FK, CHECK,
-- NOT NULL, contrainte XOR sur questions, etc.), Postgres rollback la
-- transaction entière — aucune ligne orpheline.
--
-- Permissions : SECURITY DEFINER + EXECUTE accordé au seul service_role,
-- ce qui force l'appel via createAdminClient() côté Next.js.

CREATE OR REPLACE FUNCTION public.insert_manual_enriched_article(
  -- Métadonnées article
  p_title          text,
  p_source_id      uuid,                 -- UUID de la source manual_admin
  p_questions      jsonb,                -- [{question_type, text, options, feedback, difficulty?, points?, recommended_time_seconds?}]
  p_doi            text DEFAULT NULL,
  p_journal        text DEFAULT NULL,
  p_abstract       text DEFAULT NULL,
  p_url            text DEFAULT NULL,
  p_spe_tags       text[] DEFAULT '{}',

  -- Champs synthèse
  p_display_title            text DEFAULT NULL,
  p_summary_fr               text DEFAULT NULL,
  p_clinical_impact          text DEFAULT NULL,
  p_evidence_level           text DEFAULT NULL,
  p_key_figures              text[] DEFAULT '{}',
  p_caveats                  text DEFAULT NULL,
  p_category_editorial       text DEFAULT NULL,
  p_formation_category_match text DEFAULT NULL,
  p_specialite               text DEFAULT NULL,
  p_embedding                vector(1536) DEFAULT NULL,
  p_added_by                 uuid DEFAULT NULL
)
RETURNS uuid                  -- retourne news_syntheses.id
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_raw_id        uuid;
  v_scored_id     uuid;
  v_synthesis_id  uuid;
  v_question      jsonb;
  v_order         int := 0;
BEGIN
  -- Validation minimale (le client valide aussi côté API, mais on
  -- défend la BDD) : NOT NULL sur summary_fr / display_title / title.
  IF p_title IS NULL OR length(btrim(p_title)) = 0 THEN
    RAISE EXCEPTION 'p_title required';
  END IF;
  IF p_summary_fr IS NULL OR length(btrim(p_summary_fr)) = 0 THEN
    RAISE EXCEPTION 'p_summary_fr required';
  END IF;
  IF p_display_title IS NULL OR length(btrim(p_display_title)) = 0 THEN
    RAISE EXCEPTION 'p_display_title required';
  END IF;
  IF p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array' THEN
    RAISE EXCEPTION 'p_questions must be a JSONB array';
  END IF;
  IF jsonb_array_length(p_questions) < 3 THEN
    RAISE EXCEPTION 'at least 3 questions required (got %)',
      jsonb_array_length(p_questions);
  END IF;

  -- 1. INSERT news_raw
  INSERT INTO news_raw (
    source_id, external_id, title, doi, journal, abstract, url, ingested_at
  )
  VALUES (
    p_source_id,
    'manual-enriched-' || gen_random_uuid()::text,
    p_title, p_doi, p_journal, p_abstract, p_url,
    now()
  )
  RETURNING id INTO v_raw_id;

  -- 2. INSERT news_scored (score forcé, status=selected, llm_model='manual')
  INSERT INTO news_scored (
    raw_id, relevance_score, spe_tags, status, llm_model, scored_at
  )
  VALUES (
    v_raw_id, 1.0, p_spe_tags, 'selected', 'manual', now()
  )
  RETURNING id INTO v_scored_id;

  -- 3. INSERT news_syntheses
  -- Note : niveau_preuve est rempli en miroir d'evidence_level pour rester
  -- cohérent avec les articles issus du pipeline auto qui peuplent les deux
  -- champs (evidence_level historique + niveau_preuve introduit en T8-P1).
  INSERT INTO news_syntheses (
    raw_id, scored_id,
    summary_fr, display_title, clinical_impact,
    evidence_level, niveau_preuve,
    key_figures, caveats, category_editorial, formation_category_match,
    specialite, embedding,
    manual_added, added_by, status
  )
  VALUES (
    v_raw_id, v_scored_id,
    p_summary_fr, p_display_title, p_clinical_impact,
    p_evidence_level, p_evidence_level,
    p_key_figures, p_caveats, p_category_editorial, p_formation_category_match,
    p_specialite, p_embedding,
    true, p_added_by, 'active'
  )
  RETURNING id INTO v_synthesis_id;

  -- 4. INSERT questions (boucle sur le JSONB array)
  -- Conventions T7-ter (cf. critères d'acceptation du handoff) :
  --   - sequence_id NULL (XOR avec news_synthesis_id)
  --   - feedback_correct = feedback_incorrect (même valeur)
  --   - is_daily_quiz_eligible = false (toujours, pour les questions news)
  --   - question_order = ordre du tableau JSONB (1..N), via compteur plpgsql
  --     (un row_number() OVER () dans un VALUES sans FROM ne s'incrémenterait
  --     pas entre les itérations).
  FOR v_question IN SELECT * FROM jsonb_array_elements(p_questions)
  LOOP
    v_order := v_order + 1;
    INSERT INTO questions (
      news_synthesis_id,
      sequence_id,
      question_type,
      question_text,
      options,
      feedback_correct,
      feedback_incorrect,
      difficulty,
      points,
      recommended_time_seconds,
      is_daily_quiz_eligible,
      question_order
    )
    VALUES (
      v_synthesis_id,
      NULL,
      (v_question->>'question_type')::text,
      (v_question->>'text')::text,
      COALESCE(v_question->'options', '[]'::jsonb),
      (v_question->>'feedback')::text,
      (v_question->>'feedback')::text,
      COALESCE((v_question->>'difficulty')::int, 2),
      COALESCE((v_question->>'points')::int, 10),
      COALESCE((v_question->>'recommended_time_seconds')::int, 30),
      false,
      v_order
    );
  END LOOP;

  RETURN v_synthesis_id;
END;
$$;

-- ============================================================================
-- 3. Permissions
-- ============================================================================
-- Accessible uniquement via service_role (appelée par Next.js avec
-- createAdminClient()). Les rôles authenticated/anon n'ont aucun accès.
--
-- ⚠️ Supabase configure des ALTER DEFAULT PRIVILEGES qui accordent
-- automatiquement EXECUTE sur les fonctions du schéma `public` aux rôles
-- anon + authenticated. Un simple REVOKE FROM PUBLIC ne suffit donc pas :
-- il faut révoquer explicitement de ces rôles nommés.

REVOKE ALL ON FUNCTION public.insert_manual_enriched_article(
  text, uuid, jsonb,
  text, text, text, text, text[],
  text, text, text, text, text[], text, text, text, text,
  vector, uuid
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.insert_manual_enriched_article(
  text, uuid, jsonb,
  text, text, text, text, text[],
  text, text, text, text, text[], text, text, text, text,
  vector, uuid
) TO service_role;

-- ============================================================================
-- Sanity checks (à exécuter manuellement après application)
-- ============================================================================
-- 1) Source manual_admin présente :
--    SELECT id, type, name FROM public.news_sources WHERE type='manual_admin';
-- 2) RPC créée :
--    SELECT routine_name, security_type, external_language
--    FROM information_schema.routines
--    WHERE routine_schema = 'public'
--      AND routine_name = 'insert_manual_enriched_article';
-- 3) Permissions :
--    SELECT grantee, privilege_type
--    FROM information_schema.routine_privileges
--    WHERE routine_name = 'insert_manual_enriched_article';
--    → seule ligne attendue : service_role / EXECUTE.
