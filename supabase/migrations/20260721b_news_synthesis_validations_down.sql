-- 20260721b_news_synthesis_validations_down.sql — rollback de
-- 20260721b_news_synthesis_validations.sql.
--
-- Ordre : purge des validations de backfill AVANT restauration de la
-- contrainte à deux valeurs (sinon l'ADD CONSTRAINT échouerait sur les lignes
-- news_synthesis présentes).
--
-- ⚠️ ÉCHEC ATTENDU ET VOLONTAIRE : si des validations 'news_synthesis' AUTRES
-- que le backfill subsistent (p. ex. créées par un membre CS via le front après
-- livraison de cette migration), la restauration de la contrainte à deux
-- valeurs (étape finale) ÉCHOUERA proprement (violation de CHECK). C'est
-- voulu : on ne supprime pas des validations éditoriales légitimes en silence.
-- Le rollback complet suppose alors de traiter d'abord ces validations
-- manuellement (revoke_validation puis suppression), décision humaine.

-- 3) Purge du backfill (uniquement les lignes portant le commentaire de backfill).
DELETE FROM public.editorial_validations
WHERE content_type = 'news_synthesis'
  AND comments = 'Validation rétroactive (backfill)';

-- 2) Suppression du canal de lecture des synthèses.
DROP FUNCTION IF EXISTS public.get_syntheses_for_validation();

-- 1.2) Restauration de compute_content_hash SANS la branche news_synthesis.
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

  ELSE
    RAISE EXCEPTION 'Invalid content_type: %', p_content_type;
  END IF;

  IF v_payload IS NULL THEN
    RAISE EXCEPTION 'Content not found: % %', p_content_type, p_content_id;
  END IF;

  RETURN encode(digest(v_payload, 'sha256'), 'hex');
END;
$function$;

-- 1.1) Restauration de la contrainte à deux valeurs (échouera si des
-- validations 'news_synthesis' subsistent — cf. avertissement en tête).
ALTER TABLE public.editorial_validations
  DROP CONSTRAINT editorial_validations_content_type_check;

ALTER TABLE public.editorial_validations
  ADD CONSTRAINT editorial_validations_content_type_check
  CHECK (content_type IN ('formation','news_episode'));
