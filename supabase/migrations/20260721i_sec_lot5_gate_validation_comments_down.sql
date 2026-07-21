-- Nom du fichier : 20260721i_sec_lot5_gate_validation_comments_down.sql
-- Date de création : 2026-07-21
-- Rollback de : 20260721i_sec_lot5_gate_validation_comments.sql (LOT 5)
-- Restaure à l'identique la version de get_validation_status antérieure au LOT 5
-- (colonne `comments` = ev.comments, sans garde-fou). Définition capturée en
-- base via pg_get_functiondef avant modification.

CREATE OR REPLACE FUNCTION public.get_validation_status(p_content_type character varying, p_content_id uuid)
 RETURNS TABLE(validated boolean, is_stale boolean, validation_id uuid, validated_at timestamp with time zone, lead_name character varying, lead_title character varying, secondary_name character varying, secondary_title character varying, comments text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  v_current_hash TEXT;
BEGIN
  BEGIN
    v_current_hash := public.compute_content_hash(p_content_type, p_content_id);
  EXCEPTION WHEN OTHERS THEN
    v_current_hash := NULL;
  END;

  RETURN QUERY
  SELECT
    TRUE AS validated,
    (ev.content_hash <> v_current_hash) AS is_stale,
    ev.id AS validation_id,
    ev.validated_at,
    lead_m.display_name AS lead_name,
    lead_m.title AS lead_title,
    sec_m.display_name AS secondary_name,
    sec_m.title AS secondary_title,
    ev.comments
  FROM public.editorial_validations ev
  JOIN public.cs_members lead_m ON lead_m.id = ev.validated_by_lead
  LEFT JOIN public.cs_members sec_m ON sec_m.id = ev.validated_by_secondary
  WHERE ev.content_type = p_content_type
    AND ev.content_id = p_content_id
    AND ev.is_current = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, NULL::TIMESTAMPTZ,
                        NULL::VARCHAR, NULL::VARCHAR,
                        NULL::VARCHAR, NULL::VARCHAR, NULL::TEXT;
  END IF;
END;
$function$;
