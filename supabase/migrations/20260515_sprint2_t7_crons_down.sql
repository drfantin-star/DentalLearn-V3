-- Nom du fichier : 20260515_sprint2_t7_crons_down.sql
-- Rollback de : 20260515_sprint2_t7_crons.sql

DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'live_session_reminders') THEN
    PERFORM cron.unschedule('live_session_reminders');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify_followers_new_publication') THEN
    PERFORM cron.unschedule('notify_followers_new_publication');
  END IF;
END
$mig$;
