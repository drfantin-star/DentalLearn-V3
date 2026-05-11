-- Nom du fichier : 20260511_sprint2_formateur_entities_down.sql
-- Date de création : 2026-05-11
-- Ticket : Sprint 2 / Ticket 1 — claude/dentallearn-development-u4ueJ
-- Description : Rollback symétrique de 20260511_sprint2_formateur_entities.sql
--               Ordre inverse : triggers → policies → helpers SQL → indexes → tables.
--               NB : DROP TABLE … CASCADE drop automatiquement les indexes, policies
--               et triggers attachés. Les statements DROP TRIGGER/POLICY/INDEX en amont
--               sont explicites pour transparence et facilité d'audit du rollback.

-- =============================================================================
-- 1. TRIGGERS updated_at
-- =============================================================================

DROP TRIGGER IF EXISTS set_updated_at_live_sessions      ON live_sessions;
DROP TRIGGER IF EXISTS set_updated_at_live_events        ON live_events;
DROP TRIGGER IF EXISTS set_updated_at_formateur_profiles ON formateur_profiles;

-- =============================================================================
-- 2. POLICIES RLS
-- =============================================================================

-- live_registrations
DROP POLICY IF EXISTS "live_registrations_delete_super_admin" ON live_registrations;
DROP POLICY IF EXISTS "live_registrations_update"             ON live_registrations;
DROP POLICY IF EXISTS "live_registrations_insert_self"        ON live_registrations;
DROP POLICY IF EXISTS "live_registrations_select"             ON live_registrations;

-- live_sessions
DROP POLICY IF EXISTS "live_sessions_delete" ON live_sessions;
DROP POLICY IF EXISTS "live_sessions_update" ON live_sessions;
DROP POLICY IF EXISTS "live_sessions_insert" ON live_sessions;
DROP POLICY IF EXISTS "live_sessions_select" ON live_sessions;

-- live_events
DROP POLICY IF EXISTS "live_events_delete" ON live_events;
DROP POLICY IF EXISTS "live_events_update" ON live_events;
DROP POLICY IF EXISTS "live_events_insert" ON live_events;
DROP POLICY IF EXISTS "live_events_select" ON live_events;

-- formateur_profiles
DROP POLICY IF EXISTS "formateur_profiles_delete_super_admin" ON formateur_profiles;
DROP POLICY IF EXISTS "formateur_profiles_update"             ON formateur_profiles;
DROP POLICY IF EXISTS "formateur_profiles_insert_super_admin" ON formateur_profiles;
DROP POLICY IF EXISTS "formateur_profiles_select"             ON formateur_profiles;

-- formation_instructors
DROP POLICY IF EXISTS "formation_instructors_delete_super_admin" ON formation_instructors;
DROP POLICY IF EXISTS "formation_instructors_update_super_admin" ON formation_instructors;
DROP POLICY IF EXISTS "formation_instructors_insert_super_admin" ON formation_instructors;
DROP POLICY IF EXISTS "formation_instructors_select_public"      ON formation_instructors;

-- =============================================================================
-- 3. HELPERS SQL
-- =============================================================================

DROP FUNCTION IF EXISTS formateur_aggregated_stats(uuid, date, date);
DROP FUNCTION IF EXISTS get_formateur_formations(uuid);
DROP FUNCTION IF EXISTS is_formateur_of(uuid, uuid);

-- =============================================================================
-- 4. INDEXES (explicite ; auto-droppés par DROP TABLE en aval)
-- =============================================================================

DROP INDEX IF EXISTS live_registrations_session_idx;
DROP INDEX IF EXISTS live_registrations_user_idx;

DROP INDEX IF EXISTS live_sessions_status_idx;
DROP INDEX IF EXISTS live_sessions_starts_at_idx;
DROP INDEX IF EXISTS live_sessions_formateur_idx;

DROP INDEX IF EXISTS live_events_published_upcoming_idx;
DROP INDEX IF EXISTS live_events_starts_at_idx;
DROP INDEX IF EXISTS live_events_formateur_idx;

DROP INDEX IF EXISTS formateur_profiles_published_idx;
DROP INDEX IF EXISTS formateur_profiles_slug_idx;

DROP INDEX IF EXISTS formation_instructors_user_id_idx;

-- =============================================================================
-- 5. TABLES (ordre inverse — d'abord les dépendantes, puis les racines)
-- =============================================================================

DROP TABLE IF EXISTS live_registrations;
DROP TABLE IF EXISTS live_sessions;
DROP TABLE IF EXISTS live_events;
DROP TABLE IF EXISTS formateur_profiles;
DROP TABLE IF EXISTS formation_instructors;
