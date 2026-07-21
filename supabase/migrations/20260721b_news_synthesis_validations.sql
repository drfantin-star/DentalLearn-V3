-- 20260721b_news_synthesis_validations.sql
-- Migration 2 (chantier CS) — validations éditoriales des synthèses news.
--
-- Objectif : étendre le dispositif de validation éditoriale au
-- content_type = 'news_synthesis' et enregistrer rétroactivement la validation
-- des 623 synthèses actives (traçabilité IA Act art. 50 §4 + Qualiopi #21).
--
-- Arbitrages actés par Dr Julie Fantin :
--   3A  — extension du content_type aux synthèses.
--   8A  — canal de lecture par RPC SECURITY DEFINER à colonnes sûres
--         (pas de policy RLS sur news_syntheses, qui exposerait embedding,
--         llm_model, ids internes, champs gdrive_*).
--   9B  — payload du hash limité au noyau scientifique STABLE (7 colonnes).
--   12A — backfill par INSERT ... SELECT direct (pas validate_content_bulk,
--         gardée par is_super_admin(auth.uid()) qui vaut NULL en service_role).
--   13A — commentaire honnête « Validation rétroactive (backfill) ».
--
-- ⚠️ Opération destructive sur la contrainte editorial_validations_content_type_check
-- (DROP + ADD). Aucune ligne existante ne la violera (0 validation news_synthesis
-- en base au moment de l'écriture ; 26 lignes formation/news_episode conformes).

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.1) Contrainte : accepter la 3e valeur 'news_synthesis'.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.editorial_validations
  DROP CONSTRAINT editorial_validations_content_type_check;

ALTER TABLE public.editorial_validations
  ADD CONSTRAINT editorial_validations_content_type_check
  CHECK (content_type IN ('formation','news_episode','news_synthesis'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 1.2) Branche news_synthesis de compute_content_hash.
--      Payload = noyau scientifique stable uniquement (9B) :
--        display_title | summary_fr | method | key_figures(trié) |
--        evidence_level | clinical_impact | caveats
--      key_figures (text[]) est trié avant concaténation → un simple
--      réordonnancement ne change pas le hash. Branches formation et
--      news_episode conservées à l'identique. search_path inchangé
--      (extensions nécessaire pour digest()).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.compute_content_hash(
  p_content_type character varying,
  p_content_id   uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_catalog'
AS $function$
DECLARE
  v_payload TEXT;
  v_extra   TEXT;
BEGIN
  IF p_content_type = 'formation' THEN
    SELECT
      COALESCE(f.title, '') || '|' ||
      COALESCE(f.axe_cp::text, '') || '|' ||
      COALESCE(
        (SELECT string_agg(s.title, '||' ORDER BY s.id)
         FROM public.sequences s
         WHERE s.formation_id = f.id),
        ''
      )
    INTO v_payload
    FROM public.formations f
    WHERE f.id = p_content_id;

  ELSIF p_content_type = 'news_episode' THEN
    SELECT
      COALESCE(e.title, '') || '|' ||
      COALESCE(e.type, '') || '|' ||
      COALESCE(e.week_iso, '') || '|' ||
      COALESCE(e.script_md, '')
    INTO v_payload
    FROM public.news_episodes e
    WHERE e.id = p_content_id;

    SELECT COALESCE(string_agg(synthesis_id::text, '||' ORDER BY order_idx), '')
    INTO v_extra
    FROM public.news_episode_items
    WHERE episode_id = p_content_id;

    v_payload := v_payload || '|' || COALESCE(v_extra, '');

  ELSIF p_content_type = 'news_synthesis' THEN
    SELECT
      COALESCE(ns.display_title, '') || '|' ||
      COALESCE(ns.summary_fr, '') || '|' ||
      COALESCE(ns.method, '') || '|' ||
      COALESCE(
        array_to_string(
          ARRAY(SELECT kf FROM unnest(ns.key_figures) AS kf ORDER BY kf),
          '||'
        ),
        ''
      ) || '|' ||
      COALESCE(ns.evidence_level, '') || '|' ||
      COALESCE(ns.clinical_impact, '') || '|' ||
      COALESCE(ns.caveats, '')
    INTO v_payload
    FROM public.news_syntheses ns
    WHERE ns.id = p_content_id;

  ELSE
    RAISE EXCEPTION 'Invalid content_type: %', p_content_type;
  END IF;

  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'Content not found: % %', p_content_type, p_content_id;
  END IF;

  RETURN encode(digest(v_payload, 'sha256'), 'hex');
END;
$function$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) Canal de lecture des synthèses (8A) — RPC SECURITY DEFINER à colonnes
--    sûres. Aucune policy RLS sur news_syntheses (exposerait la table entière).
--    Garde : cs_member OU super_admin. N'expose jamais embedding / llm_model /
--    scored_id / raw_id / added_by / gdrive_*.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_syntheses_for_validation()
RETURNS TABLE (
  id              uuid,
  display_title   text,
  summary_fr      text,
  method          text,
  key_figures     text[],
  evidence_level  text,
  clinical_impact text,
  caveats         text,
  specialite      text,
  published_at    date
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF NOT (public.is_cs_member(auth.uid()) OR public.is_super_admin(auth.uid())) THEN
    RAISE EXCEPTION 'Forbidden: cs_member or super_admin required';
  END IF;

  RETURN QUERY
  SELECT
    ns.id,
    ns.display_title::text,
    ns.summary_fr::text,
    ns.method::text,
    ns.key_figures,
    ns.evidence_level::text,
    ns.clinical_impact::text,
    ns.caveats::text,
    ns.specialite::text,
    ns.published_at
  FROM public.news_syntheses ns
  WHERE ns.status = 'active'
  ORDER BY ns.published_at DESC NULLS LAST, ns.id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_syntheses_for_validation() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3) Backfill des synthèses actives (12A/13A).
--    INSERT ... SELECT direct (pas validate_content_bulk). Lead = membre
--    is_lead actif, résolu par requête (pas d'UUID en dur). Idempotent via
--    NOT EXISTS sur une validation courante du même contenu (respect de
--    l'index unique editorial_validations_current_uniq).
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO public.editorial_validations (
  content_type, content_id, content_hash,
  validated_by_lead, validated_by_secondary,
  comments, is_current
)
SELECT
  'news_synthesis',
  ns.id,
  public.compute_content_hash('news_synthesis', ns.id),
  (SELECT m.id FROM public.cs_members m
     WHERE m.is_lead = true AND m.active = true
     ORDER BY m.joined_at ASC
     LIMIT 1),
  NULL,
  'Validation rétroactive (backfill)',
  TRUE
FROM public.news_syntheses ns
WHERE ns.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM public.editorial_validations ev
    WHERE ev.content_type = 'news_synthesis'
      AND ev.content_id = ns.id
      AND ev.is_current = TRUE
  );
