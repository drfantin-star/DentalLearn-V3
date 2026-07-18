-- Rollback de 20260717a_certily_organisme_rebrand.sql
-- Restaure la string sentinelle 'EROJU SAS — Dentalschool' d'origine
-- (20260503b_sprint1_attestations_organisme_dynamic) dans les 3 helpers.

CREATE OR REPLACE FUNCTION attestation_organisme_for(
  p_user_id uuid,
  p_formation_id uuid
) RETURNS varchar
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id uuid;
  v_org_type org_type;
  v_org_name varchar(200);
  v_owner_org_id uuid;
BEGIN
  IF p_formation_id IS NULL THEN
    RETURN 'EROJU SAS — Dentalschool';
  END IF;

  IF is_super_admin(p_user_id) THEN
    RETURN 'EROJU SAS — Dentalschool';
  END IF;

  v_org_id := user_org(p_user_id);

  IF v_org_id IS NULL THEN
    RETURN 'EROJU SAS — Dentalschool';
  END IF;

  SELECT type, name INTO v_org_type, v_org_name
  FROM organizations
  WHERE id = v_org_id;

  IF v_org_type IN ('cabinet', 'hr_entity') THEN
    RETURN 'EROJU SAS — Dentalschool';
  END IF;

  IF v_org_type = 'training_org' THEN
    SELECT owner_org_id INTO v_owner_org_id
    FROM formations
    WHERE id = p_formation_id;

    IF v_owner_org_id IS NULL THEN
      RETURN 'EROJU SAS — Dentalschool';
    END IF;

    IF v_owner_org_id = v_org_id THEN
      RETURN v_org_name;
    END IF;

    RETURN 'EROJU SAS — Dentalschool';
  END IF;

  RETURN 'EROJU SAS — Dentalschool';
END;
$$;

CREATE OR REPLACE FUNCTION attestation_qualiopi_for(
  p_user_id uuid,
  p_formation_id uuid
) RETURNS varchar
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organisme varchar;
  v_org_id uuid;
  v_qualiopi varchar(20);
BEGIN
  v_organisme := attestation_organisme_for(p_user_id, p_formation_id);
  IF v_organisme = 'EROJU SAS — Dentalschool' THEN
    RETURN 'QUA006589';
  END IF;
  v_org_id := user_org(p_user_id);
  SELECT qualiopi_number INTO v_qualiopi FROM organizations WHERE id = v_org_id;
  RETURN v_qualiopi;
END;
$$;

CREATE OR REPLACE FUNCTION attestation_odpc_for(
  p_user_id uuid,
  p_formation_id uuid
) RETURNS varchar
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_organisme varchar;
  v_org_id uuid;
  v_odpc varchar(10);
BEGIN
  v_organisme := attestation_organisme_for(p_user_id, p_formation_id);
  IF v_organisme = 'EROJU SAS — Dentalschool' THEN
    RETURN '9AGA';
  END IF;
  v_org_id := user_org(p_user_id);
  SELECT odpc_number INTO v_odpc FROM organizations WHERE id = v_org_id;
  RETURN v_odpc;
END;
$$;
