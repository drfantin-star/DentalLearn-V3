select cron.unschedule('notifications_purge_monthly');
drop function if exists public.purge_old_notifications();
