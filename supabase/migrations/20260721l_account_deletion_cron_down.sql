-- Down de Migration C — retire le job cron, la fonction et la table de log.
DO $$
BEGIN
  PERFORM cron.unschedule('account_deletion_purge_daily');
EXCEPTION WHEN OTHERS THEN
  NULL;  -- job absent : rien a faire
END $$;

DROP FUNCTION IF EXISTS public.purge_expired_deletions();
DROP TABLE IF EXISTS public.account_deletion_purge_runs;
