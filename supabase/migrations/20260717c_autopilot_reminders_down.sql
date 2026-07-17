select cron.unschedule('autopilot_reminder_mid');
select cron.unschedule('autopilot_reminder_end');

drop function if exists public.send_autopilot_reminders(text);
