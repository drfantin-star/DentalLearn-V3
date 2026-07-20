-- Rollback 20260720c — retrait des colonnes de suivi soft-ask.

ALTER TABLE public.user_notification_preferences
  DROP COLUMN IF EXISTS softask_shown_at,
  DROP COLUMN IF EXISTS softask_dismissed_count,
  DROP COLUMN IF EXISTS prefs_snapshot;
