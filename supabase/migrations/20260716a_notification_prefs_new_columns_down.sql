-- Nom du fichier : 20260716a_notification_prefs_new_columns_down.sql
-- Rollback de : 20260716a_notification_prefs_new_columns.sql

ALTER TABLE user_notification_preferences
  DROP COLUMN IF EXISTS new_formations,
  DROP COLUMN IF EXISTS weekly_journal,
  DROP COLUMN IF EXISTS notifications_enabled;
