-- Rappels push CP (auto-éval) + Autopilot : 2 nouvelles préférences de contenu
-- (2A) sur user_notification_preferences, + colonne de tracking d'envoi push
-- sur notifications (remplie par l'Edge Function send-reminder-push).
-- Opt-in par défaut, cohérent avec les colonnes de préférence existantes.

ALTER TABLE public.user_notification_preferences
  ADD COLUMN IF NOT EXISTS cp_reminders        boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS autopilot_reminders  boolean DEFAULT true;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS push_sent_at timestamptz;
