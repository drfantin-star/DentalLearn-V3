-- T7 DOWN — Restaure le trigger d'origine et supprime les helpers attestations.
-- Ne touche pas aux colonnes organizations.qualiopi_number / odpc_number :
-- elles ont été ajoutées en T1 (sprint1_rbac_multitenant) et sortent du périmètre T7.

CREATE OR REPLACE FUNCTION create_verification_on_attestation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_nom       VARCHAR(255);
  v_rpps      VARCHAR(20);
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

  INSERT INTO user_attestation_verifications (
    attestation_id,
    verification_code,
    participant_nom,
    participant_rpps,
    formation_titre,
    date_emission
  ) VALUES (
    NEW.id,
    NEW.verification_code,
    v_nom,
    COALESCE(v_rpps, 'non renseigné'),
    NEW.title,
    NEW.completed_at
  );

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS attestation_odpc_for(uuid, uuid);
DROP FUNCTION IF EXISTS attestation_qualiopi_for(uuid, uuid);
DROP FUNCTION IF EXISTS attestation_organisme_for(uuid, uuid);
