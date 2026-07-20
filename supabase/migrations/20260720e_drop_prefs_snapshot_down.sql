-- Rollback 20260720e — recrée prefs_snapshot (nullable, sans données).

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS prefs_snapshot jsonb;
