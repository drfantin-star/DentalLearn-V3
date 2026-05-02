-- Nom du fichier : 20260502_sprint1_formations_owner_org.sql
-- Date de création : 2026-05-02
-- Ticket : Sprint 1 / Ticket 3 — claude/tenant-isolation-rls-fzsnu
-- Description : Isolation contenu tenant + RLS multi-tenant.
--   1. Ajout formations.owner_org_id (NULL = catalogue Dentalschool, NOT NULL = contenu owned par un tenant)
--   2. Helper SQL user_can_see_formation(p_user_id, p_formation_id)
--   3. Refonte des policies RLS SELECT sur 7 tables (formations, sequences, questions,
--      user_formations, user_sequences, course_watch_logs, epp_audits) avec isolation tenant
--   4. Bonus durcissement : remplacement des UUID hardcodés (Dr Fantin) par is_super_admin()
--      dans les policies INSERT/UPDATE/DELETE de sequences et la policy ALL de epp_audits
--   5. course_watch_logs INSERT/UPDATE inchangées (immuabilité DPC garantie)
-- Rollback : 20260502_sprint1_formations_owner_org_down.sql

-- =============================================================================
-- 1. Colonne formations.owner_org_id
-- =============================================================================

ALTER TABLE formations
  ADD COLUMN owner_org_id uuid NULL
  REFERENCES organizations(id) ON DELETE RESTRICT;

CREATE INDEX formations_owner_org_id_idx ON formations(owner_org_id);

-- Aucun UPDATE : les 6 formations existantes sont Dentalschool → owner_org_id reste NULL

-- =============================================================================
-- 2. Helper SQL user_can_see_formation
-- =============================================================================

CREATE OR REPLACE FUNCTION user_can_see_formation(
  p_user_id uuid,
  p_formation_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    -- super_admin voit tout (y compris non publiées)
    is_super_admin(p_user_id)
    OR
    -- formation Dentalschool publiée (owner_org_id IS NULL = catalogue public)
    EXISTS (
      SELECT 1 FROM formations
      WHERE id = p_formation_id
        AND owner_org_id IS NULL
        AND is_published = true
    )
    OR
    -- formation owned par l'org active du user
    EXISTS (
      SELECT 1 FROM formations f
      WHERE f.id = p_formation_id
        AND f.owner_org_id IS NOT NULL
        AND f.owner_org_id = user_org(p_user_id)
    );
$$;

REVOKE EXECUTE ON FUNCTION user_can_see_formation(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION user_can_see_formation(uuid, uuid)
  TO authenticated, service_role;

-- =============================================================================
-- 3. RLS — refonte des policies sur les 7 tables
-- =============================================================================

-- ---- 3.1 formations ---------------------------------------------------------

DROP POLICY IF EXISTS "Formations are viewable by authenticated users" ON formations;
DROP POLICY IF EXISTS "Formations publiées accessibles à tous" ON formations;

CREATE POLICY "formations_select_with_tenant_isolation" ON formations
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR (owner_org_id IS NULL AND is_published = true)
    OR (owner_org_id IS NOT NULL AND owner_org_id = user_org(auth.uid()))
  );

-- ---- 3.2 sequences ----------------------------------------------------------
-- SELECT : isolation via la formation parente
-- INSERT/UPDATE/DELETE : remplacement UUID hardcodé Dr Fantin → is_super_admin()

DROP POLICY IF EXISTS "Sequences accessibles à tous" ON sequences;
DROP POLICY IF EXISTS "Sequences are viewable by authenticated users" ON sequences;
DROP POLICY IF EXISTS "Admins can insert sequences" ON sequences;
DROP POLICY IF EXISTS "Admins can update sequences" ON sequences;
DROP POLICY IF EXISTS "Admins can delete sequences" ON sequences;

CREATE POLICY "sequences_select_with_tenant_isolation" ON sequences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM formations f
      WHERE f.id = sequences.formation_id
        AND user_can_see_formation(auth.uid(), f.id)
    )
  );

CREATE POLICY "sequences_insert_super_admin" ON sequences
  FOR INSERT WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "sequences_update_super_admin" ON sequences
  FOR UPDATE USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

CREATE POLICY "sequences_delete_super_admin" ON sequences
  FOR DELETE USING (is_super_admin(auth.uid()));

-- ---- 3.3 questions ----------------------------------------------------------
-- Cas particulier : questions news (news_synthesis_id IS NOT NULL) restent publiques
-- (catalogue news Dentalschool). Questions formation → isolation via la séquence.

DROP POLICY IF EXISTS "Questions accessibles à tous" ON questions;
DROP POLICY IF EXISTS "Questions are viewable by authenticated users" ON questions;

CREATE POLICY "questions_select_with_tenant_isolation" ON questions
  FOR SELECT USING (
    -- Questions news : toujours publiques (catalogue Dentalschool)
    news_synthesis_id IS NOT NULL
    OR
    -- Questions formation : isolation tenant via la séquence + helper
    (
      sequence_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM sequences s
        JOIN formations f ON f.id = s.formation_id
        WHERE s.id = questions.sequence_id
          AND user_can_see_formation(auth.uid(), f.id)
      )
    )
  );

-- ---- 3.4 user_formations (DROP doublons FR + EN) ----------------------------

DROP POLICY IF EXISTS "Users can view own formations" ON user_formations;
DROP POLICY IF EXISTS "Utilisateur peut voir ses formations" ON user_formations;

CREATE POLICY "user_formations_select" ON user_formations
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_super_admin(auth.uid())
  );

-- ---- 3.5 user_sequences (DROP doublons FR + EN) -----------------------------

DROP POLICY IF EXISTS "Users can view own sequences" ON user_sequences;
DROP POLICY IF EXISTS "Utilisateur peut voir ses séquences" ON user_sequences;

CREATE POLICY "user_sequences_select" ON user_sequences
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_super_admin(auth.uid())
  );

-- ---- 3.6 course_watch_logs --------------------------------------------------
-- ⚠️ DPC : les policies INSERT et UPDATE restent strictement INTACTES.
-- On ne touche QUE la policy SELECT pour ajouter le super_admin.

DROP POLICY IF EXISTS "Users can view own watch logs" ON course_watch_logs;

CREATE POLICY "course_watch_logs_select" ON course_watch_logs
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_super_admin(auth.uid())
  );

-- ---- 3.7 epp_audits ---------------------------------------------------------
-- epp_audits est un CATALOGUE (pas de colonne user_id). Isolation = via formation_id.
-- ALL "Admin peut tout faire" (UUID hardcodé) → remplacée par is_super_admin().

DROP POLICY IF EXISTS "Audits publiés visibles par tous" ON epp_audits;
DROP POLICY IF EXISTS "Admin peut tout faire" ON epp_audits;

CREATE POLICY "epp_audits_select" ON epp_audits
  FOR SELECT USING (
    is_super_admin(auth.uid())
    OR (
      is_published = true
      AND (
        formation_id IS NULL
        OR user_can_see_formation(auth.uid(), formation_id)
      )
    )
  );

CREATE POLICY "epp_audits_all_super_admin" ON epp_audits
  FOR ALL USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
