-- T7 — Attestations : organisme dynamique par tenant
--
-- Helpers SQL (attestation_organisme_for / _qualiopi_for / _odpc_for) +
-- trigger user_attestation_verifications enrichi pour insérer dynamiquement
-- l'organisme délivrant l'attestation selon le contexte user x formation.
--
-- Logique :
--   - super_admin / orgless / cabinet / hr_entity            → 'EROJU SAS — Dentalschool'
--   - training_org user, formation owned par cette org       → organizations.name
--   - training_org user, formation Dentalschool (owner_org_id IS NULL) → 'EROJU SAS — Dentalschool'
--   - p_formation_id NULL (cas EPP V1)                        → 'EROJU SAS — Dentalschool'
--
-- Note : organizations.qualiopi_number / odpc_number ont été ajoutées en T1
-- (migration sprint1_rbac_multitenant). Le ALTER TABLE ADD COLUMN IF NOT EXISTS
-- ci-dessous est strictement idempotent et ne touche rien si elles existent déjà.

ALTER TABLE organizations ADD COLUMN IF NOT EXISTS qualiopi_number varchar(20);
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS odpc_number varchar(10);

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

-- Trigger enrichi : alimente organisme/qualiopi/odpc dynamiquement.
-- Pour les attestations 'epp' (source_id = epp_audit_id, pas un formation_id),
-- on passe p_formation_id = NULL → fallback Dentalschool (politique V1).
CREATE OR REPLACE FUNCTION create_verification_on_attestation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nom          VARCHAR(255);
  v_rpps         VARCHAR(20);
  v_formation_id uuid;
  v_organisme    VARCHAR(100);
  v_qualiopi     VARCHAR(20);
  v_odpc         VARCHAR(10);
BEGIN
  SELECT
    CASE
      WHEN first_name IS NOT NULL AND last_name IS NOT NULL
      THEN 'Dr ' || UPPER(last_name) || ' ' || INITCAP(first_name)
      ELSE 'Praticien'
    END,
    rpps
  INTO v_nom, v_rpps
  FROM user_profiles
  WHERE id = NEW.user_id;

  IF NEW.type = 'formation_online' THEN
    v_formation_id := NEW.source_id;
  ELSE
    v_formation_id := NULL;
  END IF;

  v_organisme := attestation_organisme_for(NEW.user_id, v_formation_id);
  v_qualiopi  := attestation_qualiopi_for(NEW.user_id, v_formation_id);
  v_odpc      := attestation_odpc_for(NEW.user_id, v_formation_id);

  INSERT INTO user_attestation_verifications (
    attestation_id,
    verification_code,
    participant_nom,
    participant_rpps,
    formation_titre,
    date_emission,
    organisme,
    qualiopi,
    odpc
  ) VALUES (
    NEW.id,
    NEW.verification_code,
    v_nom,
    COALESCE(v_rpps, 'non renseigné'),
    NEW.title,
    NEW.completed_at,
    v_organisme,
    v_qualiopi,
    v_odpc
  );

  RETURN NEW;
END;
$$;
