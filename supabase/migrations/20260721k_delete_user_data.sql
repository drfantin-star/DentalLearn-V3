-- Migration B — RGPD : fonction centralisee de purge des donnees d'un compte.
--
-- delete_user_data(uuid) : appelee par le service_role (route admin / cron J+30).
-- SECURITY DEFINER pour pouvoir supprimer de auth.users. Reservee au service_role.
--
-- Garde-fous :
--  - refus si demande de suppression absente (user_profiles.deletion_requested_at NULL)
--  - refus si le user est proprietaire d'une organisation (owner_user_id)
--
-- Effets :
--  - cp_actions supprimees (decision 3A). proof_url = URL externe, proof_filename
--    colonne morte : AUCUN fichier Storage a supprimer (aucun bucket cp_actions).
--  - waitlist purgee par email (RGPD : l'inscription pre-compte doit aussi partir).
--  - DELETE auth.users -> cascade sur toutes les donnees praticien (via migration A).
--  - attestations conservees : FK SET NULL les detache (user_id -> NULL).
--
-- Non touche : complaints (depot sans compte, valeur Qualiopi), news_corrections,
--   course_watch_logs (CASCADE conserve, part avec le compte).

CREATE OR REPLACE FUNCTION public.delete_user_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_owned_orgs     int;
  v_cp_actions     int;
  v_attestations   int;
  v_waitlist       int;
  v_email          text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'delete_user_data: p_user_id NULL';
  END IF;

  -- Garde-fou 1 : aucune purge sans demande enregistree
  PERFORM 1 FROM public.user_profiles
    WHERE id = p_user_id AND deletion_requested_at IS NOT NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'delete_user_data: user % sans demande de suppression enregistree (deletion_requested_at NULL), purge refusee', p_user_id;
  END IF;

  -- Garde-fou 2 : un proprietaire d'organisation ne peut pas etre purge
  SELECT count(*) INTO v_owned_orgs
  FROM public.organizations WHERE owner_user_id = p_user_id;
  IF v_owned_orgs > 0 THEN
    RAISE EXCEPTION 'delete_user_data: user % est proprietaire de % organisation(s), purge refusee',
      p_user_id, v_owned_orgs;
  END IF;

  -- Existence + email (lu pour la purge waitlist, JAMAIS renvoye : on ne
  -- conserve aucun email apres effacement)
  SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'delete_user_data: user % introuvable dans auth.users', p_user_id;
  END IF;

  -- cp_actions : supprimees (aucun fichier Storage associe)
  SELECT count(*) INTO v_cp_actions FROM public.cp_actions WHERE user_id = p_user_id;
  DELETE FROM public.cp_actions WHERE user_id = p_user_id;

  -- Attestations : comptees avant ; la FK SET NULL les detache (conservees)
  SELECT count(*) INTO v_attestations FROM public.user_attestations WHERE user_id = p_user_id;

  -- Waitlist : purge par email (inscription pre-compte)
  WITH del AS (
    DELETE FROM public.waitlist
    WHERE v_email IS NOT NULL AND lower(email) = lower(v_email)
    RETURNING 1
  )
  SELECT count(*) INTO v_waitlist FROM del;

  -- Suppression du compte : cascade sur toutes les donnees praticien
  DELETE FROM auth.users WHERE id = p_user_id;

  -- Compte-rendu (sans email)
  RETURN jsonb_build_object(
    'user_id',               p_user_id,
    'purged_at',             now(),
    'auth_user_deleted',     true,
    'cp_actions_deleted',    v_cp_actions,
    'attestations_detached', v_attestations,
    'waitlist_deleted',      v_waitlist
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_data(uuid) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.delete_user_data(uuid) TO service_role;
