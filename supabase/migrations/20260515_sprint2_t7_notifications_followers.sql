-- Nom du fichier : 20260515_sprint2_t7_notifications_followers.sql
-- Date de création : 2026-05-15
-- Ticket : T7 Sprint 2 — Notifications, Followers & Live Reminders
-- Description : Création formateur_followers, live_session_reminders_sent,
--               extension de notifications (metadata) et user_notification_preferences
--               (live_session_reminders, formateur_publications)
-- Rollback : supabase/migrations/20260515_sprint2_t7_notifications_followers_down.sql

-- ============================================================================
-- 1. TABLE formateur_followers
-- ============================================================================

CREATE TABLE IF NOT EXISTS formateur_followers (
  id                  uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formateur_user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_at         timestamptz DEFAULT now(),
  UNIQUE (user_id, formateur_user_id)
);

-- Index pour requêtes "combien de followers a ce formateur"
CREATE INDEX IF NOT EXISTS idx_formateur_followers_formateur_user_id
  ON formateur_followers (formateur_user_id);

-- RLS
ALTER TABLE formateur_followers ENABLE ROW LEVEL SECURITY;

-- SELECT : un utilisateur authentifié peut lire ses propres follows ET le
-- count des followers d'un formateur (les deux cas passent par cette policy).
CREATE POLICY "formateur_followers_select_authenticated"
  ON formateur_followers
  FOR SELECT
  TO authenticated
  USING (true);

-- INSERT : uniquement ses propres follows
CREATE POLICY "formateur_followers_insert_own"
  ON formateur_followers
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- DELETE : uniquement ses propres follows
CREATE POLICY "formateur_followers_delete_own"
  ON formateur_followers
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Interdire l'accès anonyme
REVOKE ALL ON formateur_followers FROM anon;

-- ============================================================================
-- 2. TABLE live_session_reminders_sent
-- ============================================================================

CREATE TABLE IF NOT EXISTS live_session_reminders_sent (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      uuid        NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_type   varchar(20) NOT NULL CHECK (reminder_type IN ('j_minus_1', 'h_minus_1')),
  sent_at         timestamptz DEFAULT now(),
  UNIQUE (session_id, user_id, reminder_type)
);

-- Table technique exclusivement service_role : RLS off, accès public restreint
ALTER TABLE live_session_reminders_sent DISABLE ROW LEVEL SECURITY;

REVOKE ALL ON live_session_reminders_sent FROM PUBLIC;
REVOKE ALL ON live_session_reminders_sent FROM anon;
REVOKE ALL ON live_session_reminders_sent FROM authenticated;

-- ============================================================================
-- 3. ALTER TABLE notifications — ajout colonne metadata jsonb
-- ============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS metadata jsonb;

-- ============================================================================
-- 4. ALTER TABLE user_notification_preferences — ajout 2 colonnes
-- ============================================================================

ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS live_session_reminders boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS formateur_publications  boolean DEFAULT true;

-- ============================================================================
-- Vérification (à exécuter dans un RUN SÉPARÉ)
-- ============================================================================
-- SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public'
--     AND table_name IN ('formateur_followers', 'live_session_reminders_sent');
--
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'notifications' AND column_name = 'metadata';
--
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'user_notification_preferences'
--    AND column_name IN ('live_session_reminders', 'formateur_publications');
