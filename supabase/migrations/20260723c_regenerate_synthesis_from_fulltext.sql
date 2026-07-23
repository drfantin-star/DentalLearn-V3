-- 20260723c_regenerate_synthesis_from_fulltext.sql
-- Chantier : regeneration d'une synthese news depuis le texte integral.
--
-- Objectif : RPC transactionnelle qui ecrase EN PLACE le contenu d'une synthese
-- NON validee editorialement (+ regenere ses questions), a partir d'une sortie
-- Sonnet produite cote Next (route POST /api/admin/news/syntheses/[id]/regenerate).
--
-- Non destructif au sens migration : cette migration CREE une nouvelle RPC.
-- Aucun code deploye ne l'appelle encore. Elle ne modifie AUCUNE table,
-- contrainte, trigger ou RPC existant. Rejouable (CREATE OR REPLACE).
--
-- Contrat / invariants (cf brief section 5.2) :
--   * Ne touche QUE news_syntheses (UPDATE en place, id preserve) + questions
--     (DELETE puis INSERT). Ne touche jamais : status, is_editorially_validated,
--     id, raw_id, scored_id, editorial_validations, news_raw, news_scored.
--   * Double garde-fou (la route verifie deja cote serveur) :
--       - is_editorially_validated doit etre false, sinon EXCEPTION.
--       - aucune reference dans news_episode_syntheses ni dans un
--         news_episode_items non archive, sinon EXCEPTION.
--   * Reinitialise la timeline devenue obsolete (timeline_published=false,
--     timeline_url=null) puisque le contenu source change.
--   * Chaque question inseree a is_daily_quiz_eligible=false (decision D3).
--   * Mapping des champs aligne sur l'Edge Function synthesize_articles
--     (persist.ts) : evidence_level et niveau_preuve sont DISTINCTS (le gabarit
--     insert_manual_enriched_article les confond, on ne reprend pas ce raccourci).
--
-- Rollback : 20260723c_regenerate_synthesis_from_fulltext_down.sql (DROP FUNCTION).

CREATE OR REPLACE FUNCTION public.regenerate_synthesis_from_fulltext(
  p_synthesis_id            uuid,
  p_summary_fr              text,
  p_display_title           text,
  p_specialite              text,
  p_niveau_preuve           text,
  p_category_editorial      text,
  p_questions               jsonb,
  p_embedding               vector DEFAULT NULL::vector,
  p_method                  text   DEFAULT NULL::text,
  p_key_figures             text[] DEFAULT '{}'::text[],
  p_evidence_level          text   DEFAULT NULL::text,
  p_clinical_impact         text   DEFAULT NULL::text,
  p_caveats                 text   DEFAULT NULL::text,
  p_themes                  text[] DEFAULT '{}'::text[],
  p_keywords_libres         text[] DEFAULT '{}'::text[],
  p_formation_category_match text  DEFAULT NULL::text,
  p_llm_model               text   DEFAULT NULL::text,
  p_edited_by               uuid   DEFAULT NULL::uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_is_validated  boolean;
  v_status        text;
  v_ref_count     integer;
  v_question      jsonb;
  v_order         int := 0;
  v_inserted      int := 0;
BEGIN
  -- ----- Validations d'entree -----
  IF p_synthesis_id IS NULL THEN
    RAISE EXCEPTION 'p_synthesis_id required';
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
  IF jsonb_array_length(p_questions) < 1 THEN
    RAISE EXCEPTION 'at least 1 question required (got %)',
      jsonb_array_length(p_questions);
  END IF;

  -- ----- Verrou + existence + garde validation editoriale -----
  SELECT ns.is_editorially_validated, ns.status
    INTO v_is_validated, v_status
    FROM public.news_syntheses ns
   WHERE ns.id = p_synthesis_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'synthesis % not found', p_synthesis_id;
  END IF;

  IF v_is_validated IS TRUE THEN
    RAISE EXCEPTION
      'synthesis % is editorially validated: regeneration forbidden',
      p_synthesis_id
      USING ERRCODE = 'raise_exception';
  END IF;

  -- ----- Garde : aucune reference episode / insight (double controle) -----
  SELECT count(*)::int INTO v_ref_count
    FROM public.news_episode_syntheses es
   WHERE es.synthesis_id = p_synthesis_id;
  IF v_ref_count > 0 THEN
    RAISE EXCEPTION
      'synthesis % is referenced by % episode(s): regeneration forbidden',
      p_synthesis_id, v_ref_count
      USING ERRCODE = 'raise_exception';
  END IF;

  SELECT count(*)::int INTO v_ref_count
    FROM public.news_episode_items it
    JOIN public.news_episodes e ON e.id = it.episode_id
   WHERE it.synthesis_id = p_synthesis_id
     AND e.status <> 'archived';
  IF v_ref_count > 0 THEN
    RAISE EXCEPTION
      'synthesis % is referenced by % non-archived episode item(s): regeneration forbidden',
      p_synthesis_id, v_ref_count
      USING ERRCODE = 'raise_exception';
  END IF;

  -- ----- UPDATE en place (id, status, is_editorially_validated preserves) -----
  UPDATE public.news_syntheses ns
     SET summary_fr                = p_summary_fr,
         display_title             = p_display_title,
         method                    = p_method,
         key_figures               = p_key_figures,
         evidence_level            = p_evidence_level,
         clinical_impact           = p_clinical_impact,
         caveats                   = p_caveats,
         specialite                = p_specialite,
         themes                    = p_themes,
         niveau_preuve             = p_niveau_preuve,
         keywords_libres           = p_keywords_libres,
         category_editorial        = p_category_editorial,
         formation_category_match  = p_formation_category_match,
         embedding                 = p_embedding,
         -- Timeline obsolete apres changement du contenu source.
         timeline_url              = NULL,
         timeline_published        = false,
         -- Traces (pas de trigger BDD : ecriture explicite ici).
         last_edited_at            = now(),
         last_edited_by            = p_edited_by,
         llm_model                 = p_llm_model
   WHERE ns.id = p_synthesis_id;

  -- ----- DELETE des anciennes questions PUIS INSERT des nouvelles -----
  DELETE FROM public.questions
   WHERE news_synthesis_id = p_synthesis_id;

  FOR v_question IN SELECT * FROM jsonb_array_elements(p_questions)
  LOOP
    v_order := v_order + 1;
    INSERT INTO public.questions (
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
      p_synthesis_id,
      NULL,
      (v_question->>'question_type')::text,
      (v_question->>'question_text')::text,
      COALESCE(v_question->'options', '[]'::jsonb),
      (v_question->>'feedback')::text,
      (v_question->>'feedback')::text,
      COALESCE((v_question->>'difficulty')::int, 2),
      COALESCE((v_question->>'points')::int, 10),
      COALESCE((v_question->>'recommended_time_seconds')::int, 30),
      false,
      v_order
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$function$;
