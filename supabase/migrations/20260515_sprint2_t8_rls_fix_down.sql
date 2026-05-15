-- Nom du fichier : 20260515_sprint2_t8_rls_fix_down.sql
-- Date de création : 2026-05-15
-- Ticket : T8 Sprint 2 — Rollback fix RLS live_session_reminders_sent
-- Description : Retour à l'état T7 (RLS désactivée, accès restreint uniquement par REVOKE).
-- Rollback de : supabase/migrations/20260515_sprint2_t8_rls_fix.sql

-- Retirer le GRANT service_role ajouté en T8
REVOKE ALL ON live_session_reminders_sent FROM service_role;

-- Désactiver RLS (retour état T7)
ALTER TABLE live_session_reminders_sent DISABLE ROW LEVEL SECURITY;
