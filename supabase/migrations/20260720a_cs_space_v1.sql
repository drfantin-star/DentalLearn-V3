-- 20260720a_cs_space_v1.sql
-- Espace Comité Scientifique /cs — chaînon d'écriture manquant pour les
-- validations éditoriales par les membres du Comité Scientifique (CS).
--
-- Contexte (audit prod du 20/07/2026) : la table `editorial_validations`,
-- les RPC `compute_content_hash` / `get_validation_status` /
-- `revoke_validation`, la table `cs_members` et l'enum `app_role`
-- (valeur `cs_member`) existent déjà. Ce chantier n'ajoute QUE :
--   1. le helper `is_cs_member(uuid)` ;
--   2. deux policies de lecture/écriture sur `editorial_validations` ;
--   3. la RPC de co-signature `add_secondary_validation`.
--
-- NB SCHÉMA — IMPORTANT : `editorial_validations.validated_by_lead` et
-- `validated_by_secondary` sont des FK vers `cs_members.id` (vérifié en
-- prod), et NON vers `auth.users.id`. Les écritures attribuent donc l'`id`
-- de la ligne `cs_members` du membre courant, jamais son `auth.uid()`.
--
-- Les policies `cs_members_self_read` / `cs_members_cs_read_all` évoquées
-- au brief NE sont PAS créées : `cs_members_public_read_active` (déjà en
-- base) rend déjà lisibles toutes les lignes `active = true` à tout
-- utilisateur authentifié, ce qui couvre l'affichage du validateur
-- secondaire. Aucune ligne des 26 validations existantes n'est modifiée.

-- 1) Helper is_cs_member(uuid) — calqué sur is_super_admin.
--    true si l'utilisateur porte le rôle `cs_member` ET possède une ligne
--    `cs_members` active.
CREATE OR REPLACE FUNCTION public.is_cs_member(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT public.has_role(p_user_id, 'cs_member')
     AND EXISTS (
       SELECT 1 FROM public.cs_members m
       WHERE m.user_id = p_user_id AND m.active = true
     );
$$;

GRANT EXECUTE ON FUNCTION public.is_cs_member(uuid) TO authenticated;

-- 2) Lecture complète des validations pour un membre CS.
--    `editorial_validations_public_read_current` ne montre que les lignes
--    courantes ; l'historique d'un membre a besoin de voir aussi ses
--    validations périmées / non courantes.
CREATE POLICY editorial_validations_cs_read
  ON public.editorial_validations
  FOR SELECT
  TO authenticated
  USING (public.is_cs_member(auth.uid()));

-- 3) INSERT d'une validation « lead » par un membre CS (ou super_admin).
--    WITH CHECK : `validated_by_lead` DOIT être l'id `cs_members` du membre
--    courant → interdit toute usurpation d'un autre validateur, et garantit
--    la cohérence de la FK. `is_current` / `content_hash` restent posés
--    côté applicatif (hash issu de compute_content_hash).
CREATE POLICY editorial_validations_cs_insert
  ON public.editorial_validations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (public.is_cs_member(auth.uid()) OR public.is_super_admin(auth.uid()))
    AND validated_by_lead IN (
      SELECT m.id
      FROM public.cs_members m
      WHERE m.user_id = auth.uid() AND m.active = true
    )
  );

-- Pas de policy UPDATE ni DELETE sur editorial_validations : une validation
-- est un acte immuable. La correction passe par revoke_validation() ; la
-- co-signature passe par add_secondary_validation() ci-dessous.

-- 4) RPC add_secondary_validation — co-signature (validateur secondaire).
--    Seul write UPDATE autorisé sur editorial_validations, en
--    SECURITY DEFINER, et uniquement pour renseigner un `secondary` encore
--    vide sur une validation courante, par un membre CS différent du lead.
CREATE OR REPLACE FUNCTION public.add_secondary_validation(
  p_validation_id uuid,
  p_comments text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_member_id uuid;
  v_lead uuid;
  v_secondary uuid;
  v_is_current boolean;
BEGIN
  IF NOT public.is_cs_member(auth.uid()) THEN
    RAISE EXCEPTION 'Forbidden: cs_member required';
  END IF;

  SELECT m.id INTO v_member_id
  FROM public.cs_members m
  WHERE m.user_id = auth.uid() AND m.active = true
  LIMIT 1;

  IF v_member_id IS NULL THEN
    RAISE EXCEPTION 'No active cs_members row for current user';
  END IF;

  SELECT ev.validated_by_lead, ev.validated_by_secondary, ev.is_current
  INTO v_lead, v_secondary, v_is_current
  FROM public.editorial_validations ev
  WHERE ev.id = p_validation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Validation not found';
  END IF;

  IF NOT v_is_current THEN
    RAISE EXCEPTION 'Cannot co-sign a non-current validation';
  END IF;

  IF v_secondary IS NOT NULL THEN
    RAISE EXCEPTION 'A secondary validator is already recorded';
  END IF;

  IF v_lead = v_member_id THEN
    RAISE EXCEPTION 'Lead validator cannot also be the secondary validator';
  END IF;

  UPDATE public.editorial_validations
  SET validated_by_secondary = v_member_id,
      comments = CASE
        WHEN p_comments IS NULL OR length(trim(p_comments)) = 0 THEN comments
        WHEN comments IS NULL OR length(trim(comments)) = 0 THEN p_comments
        ELSE comments || E'\n---\n' || p_comments
      END,
      metadata = COALESCE(metadata, '{}'::jsonb)
                 || jsonb_build_object('secondary_signed_at', NOW())
  WHERE id = p_validation_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.add_secondary_validation(uuid, text) TO authenticated;
