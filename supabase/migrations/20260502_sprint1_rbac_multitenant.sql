-- Nom du fichier : 20260502_sprint1_rbac_multitenant.sql
-- Date de création : 2026-05-02
-- Ticket : Sprint 1 / Ticket 1 — claude/rbac-multi-tenant-setup-d0NC3
-- Description : Fondations BDD multi-tenant — 5 enums + 3 tables (user_roles, organizations, organization_members) + trigger cohérence intra_role/org_type + 4 helpers SQL + RLS sur les 3 tables + seed super_admin Dr Fantin
-- Rollback : supabase/migrations/20260502_sprint1_rbac_multitenant_down.sql

-- =============================================================================
-- 1. ENUMS
-- =============================================================================

CREATE TYPE app_role AS ENUM (
  'super_admin', 'formateur', 'cs_member', 'marketing', 'support', 'user'
);

CREATE TYPE org_type AS ENUM (
  'cabinet', 'hr_entity', 'training_org'
);

CREATE TYPE intra_role AS ENUM (
  'titulaire', 'collaborateur', 'assistante',
  'admin_rh', 'manager', 'praticien_salarie',
  'admin_of', 'formateur_of', 'apprenant_of'
);

CREATE TYPE org_plan AS ENUM (
  'standard', 'premium'
);

CREATE TYPE membership_status AS ENUM (
  'active', 'invited', 'revoked'
);

-- =============================================================================
-- 2. TABLES
-- =============================================================================

-- user_roles : rôles globaux additifs (un user peut cumuler plusieurs rôles)
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX user_roles_user_id_idx ON user_roles (user_id);

-- organizations : tenants clients (cabinets, RH, OF tiers)
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(200) NOT NULL,
  type org_type NOT NULL,
  plan org_plan NOT NULL DEFAULT 'standard',
  branding_logo_url text,
  branding_primary_color varchar(7),
  qualiopi_number varchar(20),
  odpc_number varchar(10),
  owner_user_id uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT branding_only_for_hr_or_of CHECK (
    type IN ('hr_entity', 'training_org')
    OR (branding_logo_url IS NULL AND branding_primary_color IS NULL)
  )
);

-- organization_members : appartenance user → org (1 user = 1 org max en V1, cf. Q1 matrice)
CREATE TABLE organization_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  intra_role intra_role NOT NULL,
  manager_id uuid REFERENCES auth.users(id),
  status membership_status NOT NULL DEFAULT 'invited',
  joined_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX organization_members_org_id_idx ON organization_members (org_id);

-- =============================================================================
-- 3. TRIGGER COHÉRENCE intra_role / org_type (V1.2 — assistante valide partout)
-- =============================================================================

CREATE OR REPLACE FUNCTION validate_intra_role_matches_org_type()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_type org_type;
BEGIN
  SELECT type INTO v_org_type
  FROM organizations
  WHERE id = NEW.org_id;

  IF v_org_type = 'cabinet' AND NEW.intra_role NOT IN (
    'titulaire', 'collaborateur', 'assistante'
  ) THEN
    RAISE EXCEPTION 'intra_role % invalide pour org_type cabinet', NEW.intra_role;
  END IF;

  IF v_org_type = 'hr_entity' AND NEW.intra_role NOT IN (
    'admin_rh', 'manager', 'praticien_salarie', 'assistante'
  ) THEN
    RAISE EXCEPTION 'intra_role % invalide pour org_type hr_entity', NEW.intra_role;
  END IF;

  IF v_org_type = 'training_org' AND NEW.intra_role NOT IN (
    'admin_of', 'formateur_of', 'apprenant_of', 'assistante'
  ) THEN
    RAISE EXCEPTION 'intra_role % invalide pour org_type training_org', NEW.intra_role;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_intra_role_matches_org_type
  BEFORE INSERT OR UPDATE ON organization_members
  FOR EACH ROW EXECUTE FUNCTION validate_intra_role_matches_org_type();

-- =============================================================================
-- 4. HELPERS SQL
-- =============================================================================

-- has_role : vérifier si un user a un rôle global donné
CREATE OR REPLACE FUNCTION has_role(p_user_id uuid, p_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id AND role = p_role
  );
$$;

-- is_super_admin : raccourci pour le rôle global le plus élevé
CREATE OR REPLACE FUNCTION is_super_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT has_role(p_user_id, 'super_admin');
$$;

-- user_org : retourne l'org_id du user (NULL si orgless ou invité non actif)
CREATE OR REPLACE FUNCTION user_org(p_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT org_id FROM organization_members
  WHERE user_id = p_user_id AND status = 'active'
  LIMIT 1;
$$;

-- org_can_create_content : gating D.07 (création contenu sandbox) — premium HR/OF uniquement
CREATE OR REPLACE FUNCTION org_can_create_content(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organizations
    WHERE id = p_org_id
      AND plan = 'premium'
      AND type IN ('hr_entity', 'training_org')
  );
$$;

-- Hardening : ces helpers SECURITY DEFINER ne doivent pas être exposés via
-- PostgREST /rest/v1/rpc/ au rôle anon (info-leak inutile). authenticated doit
-- conserver EXECUTE car les policies RLS appellent ces helpers dans son contexte.
-- Pattern : REVOKE FROM PUBLIC puis GRANT explicite aux rôles autorisés.
REVOKE EXECUTE ON FUNCTION has_role(uuid, app_role) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION is_super_admin(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION user_org(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION org_can_create_content(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION user_org(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION org_can_create_content(uuid) TO authenticated, service_role;

-- =============================================================================
-- 5. RLS — activation + policies
-- =============================================================================

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- ---- user_roles -------------------------------------------------------------

CREATE POLICY "user_roles_select_own" ON user_roles
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_super_admin(auth.uid())
  );

CREATE POLICY "user_roles_insert_super_admin" ON user_roles
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "user_roles_update_super_admin" ON user_roles
  FOR UPDATE USING (is_super_admin(auth.uid()));

CREATE POLICY "user_roles_delete_super_admin" ON user_roles
  FOR DELETE USING (is_super_admin(auth.uid()));

-- ---- organizations ----------------------------------------------------------

CREATE POLICY "organizations_select" ON organizations
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR user_org(auth.uid()) = id
  );

CREATE POLICY "organizations_insert_super_admin" ON organizations
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "organizations_update_admins" ON organizations
  FOR UPDATE USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members
      WHERE org_id = organizations.id
        AND user_id = auth.uid()
        AND status = 'active'
        AND intra_role IN ('titulaire', 'admin_rh', 'admin_of')
    )
  );

CREATE POLICY "organizations_delete_super_admin" ON organizations
  FOR DELETE USING (is_super_admin(auth.uid()));

-- ---- organization_members ---------------------------------------------------
-- Pas de policy DELETE : suppression = soft delete via UPDATE status='revoked'

CREATE POLICY "org_members_select" ON organization_members
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR user_org(auth.uid()) = org_id
    OR auth.uid() = user_id
  );

CREATE POLICY "org_members_insert" ON organization_members
  FOR INSERT WITH CHECK (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.org_id = organization_members.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.intra_role IN ('titulaire', 'admin_rh', 'admin_of')
    )
  );

CREATE POLICY "org_members_update" ON organization_members
  FOR UPDATE USING (
    is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.org_id = organization_members.org_id
        AND om.user_id = auth.uid()
        AND om.status = 'active'
        AND om.intra_role IN ('titulaire', 'admin_rh', 'admin_of')
    )
  );

-- =============================================================================
-- 6. SEED — super_admin Dr Julie Fantin
-- =============================================================================
-- Décision Q2 (matrice §7.1) : Dr Fantin reste orgless en V1, pas d'org Dentalschool

INSERT INTO user_roles (user_id, role)
VALUES ('af506ec2-a281-4485-a504-b0633c8d2362', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;
