-- Rebranding Certily — organisme par défaut des attestations
--
-- La string sentinelle 'EROJU SAS — Dentalschool' (migration d'origine
-- 20260503b_sprint1_attestations_organisme_dynamic) devient
-- 'EROJU SAS — Certily' dans les 3 helpers SQL qui calculent l'organisme /
-- Qualiopi / ODPC par défaut d'une attestation (super_admin, orgless,
-- cabinet, hr_entity, EPP, formation Dentalschool/Certily catalogue).
--
-- Portée : uniquement le texte renvoyé pour les NOUVELLES attestations.
-- Les attestations déjà émises ont leur organisme figé dans
-- user_attestation_verifications au moment de l'émission (par
-- create_verification_on_attestation()) et ne sont pas retouchées — elles
-- gardent "Dentalschool" comme organisme historique, même logique que les
-- codes de vérification DL- qui restent valides après le passage à CL-.
--
-- attestation_qualiopi_for / attestation_odpc_for comparent le retour de
-- attestation_organisme_for() à la string sentinelle pour décider
-- d'appliquer les numéros Qualiopi QUA006589 / ODPC 9AGA par défaut : les
-- trois fonctions doivent donc être renommées ensemble pour ne pas casser
-- ces mentions sur les futures attestations.

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
    RETURN 'EROJU SAS — Certily';
  END IF;

  IF is_super_admin(p_user_id) THEN
    RETURN 'EROJU SAS — Certily';
  END IF;

  v_org_id := user_org(p_user_id);

  IF v_org_id IS NULL THEN
    RETURN 'EROJU SAS — Certily';
  END IF;

  SELECT type, name INTO v_org_type, v_org_name
  FROM organizations
  WHERE id = v_org_id;

  IF v_org_type IN ('cabinet', 'hr_entity') THEN
    RETURN 'EROJU SAS — Certily';
  END IF;

  IF v_org_type = 'training_org' THEN
    SELECT owner_org_id INTO v_owner_org_id
    FROM formations
    WHERE id = p_formation_id;

    IF v_owner_org_id IS NULL THEN
      RETURN 'EROJU SAS — Certily';
    END IF;

    IF v_owner_org_id = v_org_id THEN
      RETURN v_org_name;
    END IF;

    RETURN 'EROJU SAS — Certily';
  END IF;

  RETURN 'EROJU SAS — Certily';
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
  IF v_organisme = 'EROJU SAS — Certily' THEN
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
  IF v_organisme = 'EROJU SAS — Certily' THEN
    RETURN '9AGA';
  END IF;
  v_org_id := user_org(p_user_id);
  SELECT odpc_number INTO v_odpc FROM organizations WHERE id = v_org_id;
  RETURN v_odpc;
END;
$$;
