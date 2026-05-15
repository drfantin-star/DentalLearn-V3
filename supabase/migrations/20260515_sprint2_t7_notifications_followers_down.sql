-- Nom du fichier : 20260515_sprint2_t7_notifications_followers_down.sql
-- Rollback de : 20260515_sprint2_t7_notifications_followers.sql

-- Ordre inversé par rapport au UP

ALTER TABLE user_notification_preferences
  DROP COLUMN IF EXISTS formateur_publications,
  DROP COLUMN IF EXISTS live_session_reminders;

ALTER TABLE notifications
  DROP COLUMN IF EXISTS metadata;

DROP TABLE IF EXISTS live_session_reminders_sent;

DROP TABLE IF EXISTS formateur_followers;
