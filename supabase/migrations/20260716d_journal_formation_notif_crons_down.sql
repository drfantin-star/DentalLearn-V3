-- Nom du fichier : 20260716d_journal_formation_notif_crons_down.sql
-- Rollback de : 20260716d_journal_formation_notif_crons.sql

DO $mig$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify_new_journal') THEN
    PERFORM cron.unschedule('notify_new_journal');
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'notify_new_formation') THEN
    PERFORM cron.unschedule('notify_new_formation');
  END IF;
END
$mig$;
