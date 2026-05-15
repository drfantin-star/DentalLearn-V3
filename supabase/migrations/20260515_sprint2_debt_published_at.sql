-- Nom du fichier : 20260515_sprint2_debt_published_at.sql
-- Date de création : 2026-05-15
-- Dette : D2-T7-02 — Notifications manquées si publication tardive
-- Description : Ajoute published_at à live_sessions pour que la Edge Function
--               notify_followers_new_publication filtre sur la date de publication
--               effective plutôt que sur created_at.
-- Rollback : supabase/migrations/20260515_sprint2_debt_published_at_down.sql

ALTER TABLE live_sessions ADD COLUMN IF NOT EXISTS published_at timestamptz;

-- Index partiel pour les queries de la Edge Function (fenêtre glissante 1h)
CREATE INDEX IF NOT EXISTS live_sessions_published_at_idx
  ON live_sessions (published_at DESC)
  WHERE published_at IS NOT NULL;

-- REVOKE explicite — pattern obligatoire du projet
REVOKE ALL ON live_sessions FROM anon;
REVOKE ALL ON live_sessions FROM authenticated;
-- Note : les GRANTs existants sur live_sessions (Sprint 2 T7) restent en place,
-- cette migration ne les modifie pas.
