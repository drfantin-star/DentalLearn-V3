-- Nom du fichier : 20260721i_sec_lot5_gate_validation_comments.sql
-- Date de création : 2026-07-21
-- Ticket : Durcissement sécurité — LOT 5 (restreindre le champ `comments`)
-- Description : `get_validation_status` reste exposée à anon/authenticated (le
--               badge de confiance doit rester public), mais le seul champ
--               sensible — `comments` (commentaires de relecture du Comité
--               Scientifique) — n'est renvoyé qu'aux membres du CS ou super
--               admins. Pour tout autre appelant : NULL.
--
--   Une seule modification vs la définition d'origine : la colonne `comments`
--   passe de `ev.comments` à un CASE gardé par is_cs_member/is_super_admin.
--   Les 8 autres colonnes, la signature (params + 9 colonnes, types, ordre),
--   SECURITY DEFINER, le SET search_path, le bloc compute_content_hash et la
--   branche IF NOT FOUND sont STRICTEMENT inchangés.
--
--   Grants non touchés : anon + authenticated conservent EXECUTE (voulu).
--
-- Rollback : supabase/migrations/20260721i_sec_lot5_gate_validation_comments_down.sql

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
    CASE WHEN public.is_cs_member(auth.uid()) OR public.is_super_admin(auth.uid())
         THEN ev.comments
         ELSE NULL::text
    END AS comments
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
