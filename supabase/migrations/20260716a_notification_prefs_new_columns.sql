-- Nom du fichier : 20260716a_notification_prefs_new_columns.sql
-- Date de création : 2026-07-16
-- Description : user_notification_preferences — ajout du consentement global
--               (notifications_enabled) et de 2 nouveaux types de préférence
--               (weekly_journal = journal hebdo en ligne,
--                new_formations = nouvelle formation en ligne).
-- Rollback : supabase/migrations/20260716a_notification_prefs_new_columns_down.sql

-- Convention du projet : ligne absente = opt-in par défaut ; toutes les
-- colonnes de préférence sont DEFAULT true (cohérent avec les colonnes
-- existantes push_enabled / daily_reminders / live_session_reminders / …).
--
-- notifications_enabled agit comme kill-switch global : lorsqu'il vaut false,
-- tous les senders (crons + Edge Functions) sautent l'utilisateur, quelles que
-- soient les préférences granulaires.

ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS weekly_journal        boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS new_formations        boolean DEFAULT true;

-- ============================================================================
-- Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'user_notification_preferences'
--    AND column_name IN ('notifications_enabled', 'weekly_journal', 'new_formations');
