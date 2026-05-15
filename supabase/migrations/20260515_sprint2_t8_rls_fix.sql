-- Nom du fichier : 20260515_sprint2_t8_rls_fix.sql
-- Date de création : 2026-05-15
-- Ticket : T8 Sprint 2 — Fix RLS live_session_reminders_sent
-- Description : Active RLS sur live_session_reminders_sent (table de log interne).
--               La migration T7 avait intentionnellement désactivé RLS en faveur
--               des REVOKE explicites seuls. T8 ajoute la couche RLS pour
--               aligner avec le pattern de sécurité en profondeur du projet.
-- Rollback : supabase/migrations/20260515_sprint2_t8_rls_fix_down.sql

-- ============================================================================
-- Fix : activer RLS sur live_session_reminders_sent
-- ============================================================================

-- RLS activée : aucune policy publique = deny-all pour anon + authenticated.
-- service_role bypasse RLS nativement en Supabase — pas de policy nécessaire.
ALTER TABLE live_session_reminders_sent ENABLE ROW LEVEL SECURITY;

-- REVOKE redondant-mais-explicite (déjà appliqué par T7, conservé pour lisibilité).
-- Pattern obligatoire du projet : toujours REVOKE explicite sur anon ET authenticated.
REVOKE ALL ON live_session_reminders_sent FROM PUBLIC;
REVOKE ALL ON live_session_reminders_sent FROM anon;
REVOKE ALL ON live_session_reminders_sent FROM authenticated;

-- GRANT explicite service_role au niveau table (DML).
GRANT ALL ON live_session_reminders_sent TO service_role;

-- ============================================================================
-- Vérification (à exécuter dans un run séparé)
-- ============================================================================
-- SELECT relrowsecurity
--   FROM pg_class
--  WHERE relname = 'live_session_reminders_sent';
-- → attendu : true
