-- Nom du fichier : 20260502_sprint1_rbac_multitenant_down.sql
-- Date de création : 2026-05-02
-- Ticket : Sprint 1 / Ticket 1 — claude/rbac-multi-tenant-setup-d0NC3
-- Description : Rollback symétrique de 20260502_sprint1_rbac_multitenant.sql — drop seed, policies, trigger, helpers, tables, enums dans l'ordre inverse des dépendances
-- Rollback : N/A (ce fichier EST le rollback)

-- =============================================================================
-- 1. Seed
-- =============================================================================

DELETE FROM user_roles
WHERE user_id = 'af506ec2-a281-4485-a504-b0633c8d2362'
  AND role = 'super_admin';

-- =============================================================================
-- 2. RLS policies
-- =============================================================================

DROP POLICY IF EXISTS "user_roles_select_own" ON user_roles;
DROP POLICY IF EXISTS "user_roles_insert_super_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_update_super_admin" ON user_roles;
DROP POLICY IF EXISTS "user_roles_delete_super_admin" ON user_roles;

DROP POLICY IF EXISTS "organizations_select" ON organizations;
DROP POLICY IF EXISTS "organizations_insert_super_admin" ON organizations;
DROP POLICY IF EXISTS "organizations_update_admins" ON organizations;
DROP POLICY IF EXISTS "organizations_delete_super_admin" ON organizations;

DROP POLICY IF EXISTS "org_members_select" ON organization_members;
DROP POLICY IF EXISTS "org_members_insert" ON organization_members;
DROP POLICY IF EXISTS "org_members_update" ON organization_members;

-- =============================================================================
-- 3. Trigger + sa fonction
-- =============================================================================

DROP TRIGGER IF EXISTS validate_intra_role_matches_org_type ON organization_members;
DROP FUNCTION IF EXISTS validate_intra_role_matches_org_type();

-- =============================================================================
-- 4. Helpers SQL
-- =============================================================================

DROP FUNCTION IF EXISTS org_can_create_content(uuid);
DROP FUNCTION IF EXISTS user_org(uuid);
DROP FUNCTION IF EXISTS is_super_admin(uuid);
DROP FUNCTION IF EXISTS has_role(uuid, app_role);

-- =============================================================================
-- 5. Tables (ordre FK inverse)
-- =============================================================================

DROP TABLE IF EXISTS organization_members;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS user_roles;

-- =============================================================================
-- 6. Enums (ordre dépendances inverse)
-- =============================================================================

DROP TYPE IF EXISTS membership_status;
DROP TYPE IF EXISTS org_plan;
DROP TYPE IF EXISTS intra_role;
DROP TYPE IF EXISTS org_type;
DROP TYPE IF EXISTS app_role;
