-- Migration C — RGPD : purge automatique J+30 (cron quotidien)
--
-- purge_expired_deletions() : parcourt les demandes de suppression echues
-- (deletion_requested_at < now() - 30j), appelle delete_user_data() ligne a
-- ligne avec capture d'exception (un compte proprietaire d'organisation ne
-- fait pas echouer le lot), compte succes/echecs, journalise le passage et
-- RAISE WARNING en cas d'echec.
--
-- Semantique : le filtre suppose que deletion_requested_at stocke la DATE DE
-- DEMANDE (correction cote UI, Etape 4). La securite du delai repose sur le
-- fait que la reconnexion remet deletion_requested_at a NULL (Etape 4).
--
-- Cron : appel SQL direct (SELECT public.purge_expired_deletions();), pas
-- d'Edge Function, pas de pg_net, aucun JWT en clair (la fonction est
-- SECURITY DEFINER, proprietaire postgres, elle a tous les droits).

-- Table de log des passages : visibilite durable des echecs. Ecrite
-- uniquement par la fonction definer (bypass RLS). Lecture super_admin seule.
CREATE TABLE public.account_deletion_purge_runs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at          timestamptz NOT NULL DEFAULT now(),
  eligible_count  int NOT NULL DEFAULT 0,
  succeeded_count int NOT NULL DEFAULT 0,
  failed_count    int NOT NULL DEFAULT 0,
  failures        jsonb NOT NULL DEFAULT '[]'::jsonb  -- [{user_id, error}]
);
ALTER TABLE public.account_deletion_purge_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY account_deletion_purge_runs_select_super_admin
  ON public.account_deletion_purge_runs
  FOR SELECT
  USING (public.is_super_admin(auth.uid()));
-- Aucune policy write : seule la fonction SECURITY DEFINER insere.

CREATE OR REPLACE FUNCTION public.purge_expired_deletions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  r          record;
  v_eligible int := 0;
  v_ok       int := 0;
  v_fail     int := 0;
  v_failures jsonb := '[]'::jsonb;
BEGIN
  FOR r IN
    SELECT id FROM public.user_profiles
    WHERE deletion_requested_at IS NOT NULL
      AND deletion_requested_at < now() - interval '30 days'
  LOOP
    v_eligible := v_eligible + 1;
    BEGIN
      PERFORM public.delete_user_data(r.id);
      v_ok := v_ok + 1;
    EXCEPTION WHEN OTHERS THEN
      v_fail := v_fail + 1;
      v_failures := v_failures || jsonb_build_object('user_id', r.id, 'error', SQLERRM);
      RAISE WARNING 'purge_expired_deletions: echec purge user %: %', r.id, SQLERRM;
    END;
  END LOOP;

  INSERT INTO public.account_deletion_purge_runs
    (eligible_count, succeeded_count, failed_count, failures)
  VALUES (v_eligible, v_ok, v_fail, v_failures);

  IF v_fail > 0 THEN
    RAISE WARNING 'purge_expired_deletions: % succes, % echecs sur % eligibles',
      v_ok, v_fail, v_eligible;
  END IF;

  -- Auto-purge du log : la table qui surveille les suppressions ne doit pas
  -- devenir un stock non borne d'UUID de comptes effaces.
  DELETE FROM public.account_deletion_purge_runs WHERE ran_at < now() - interval '90 days';

  RETURN jsonb_build_object(
    'ran_at', now(), 'eligible', v_eligible,
    'succeeded', v_ok, 'failed', v_fail, 'failures', v_failures
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_expired_deletions() FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_expired_deletions() TO service_role;

-- Job quotidien 3h UTC
SELECT cron.schedule(
  'account_deletion_purge_daily',
  '0 3 * * *',
  'SELECT public.purge_expired_deletions();'
);
