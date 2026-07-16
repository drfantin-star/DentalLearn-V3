select cron.unschedule('autoeval_reminder_oct');
select cron.unschedule('autoeval_reminder_dec');
drop function if exists public.send_autoeval_reminders(text);
