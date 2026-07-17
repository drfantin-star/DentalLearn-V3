ALTER TABLE public.user_notification_preferences
  DROP COLUMN IF EXISTS cp_reminders,
  DROP COLUMN IF EXISTS autopilot_reminders;

ALTER TABLE public.notifications
  DROP COLUMN IF EXISTS push_sent_at;
