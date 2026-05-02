-- Nom du fichier : 20260502_sprint1_formations_owner_org_down.sql
-- Date de création : 2026-05-02
-- Ticket : Sprint 1 / Ticket 3 — claude/tenant-isolation-rls-fzsnu
-- Description : Rollback symétrique de 20260502_sprint1_formations_owner_org.sql
--   Restaure exactement les 12 policies SELECT supprimées + les 4 policies hardcodées
--   (sequences INSERT/UPDATE/DELETE et epp_audits ALL), puis drop helper, index, colonne.
-- Rollback : N/A (ce fichier EST le rollback)

-- =============================================================================
-- 1. Drop des policies créées par la migration up
-- =============================================================================

DROP POLICY IF EXISTS "formations_select_with_tenant_isolation" ON formations;

DROP POLICY IF EXISTS "sequences_select_with_tenant_isolation" ON sequences;
DROP POLICY IF EXISTS "sequences_insert_super_admin" ON sequences;
DROP POLICY IF EXISTS "sequences_update_super_admin" ON sequences;
DROP POLICY IF EXISTS "sequences_delete_super_admin" ON sequences;

DROP POLICY IF EXISTS "questions_select_with_tenant_isolation" ON questions;

DROP POLICY IF EXISTS "user_formations_select" ON user_formations;
DROP POLICY IF EXISTS "user_sequences_select" ON user_sequences;
DROP POLICY IF EXISTS "course_watch_logs_select" ON course_watch_logs;

DROP POLICY IF EXISTS "epp_audits_select" ON epp_audits;
DROP POLICY IF EXISTS "epp_audits_all_super_admin" ON epp_audits;

-- =============================================================================
-- 2. Restauration exacte des policies pré-T3 (snapshot d'audit)
-- =============================================================================

-- ---- formations -------------------------------------------------------------

CREATE POLICY "Formations are viewable by authenticated users" ON formations
  FOR SELECT USING (is_published = true);

CREATE POLICY "Formations publiées accessibles à tous" ON formations
  FOR SELECT USING (is_published = true);

-- ---- sequences --------------------------------------------------------------

CREATE POLICY "Sequences accessibles à tous" ON sequences
  FOR SELECT USING (true);

CREATE POLICY "Sequences are viewable by authenticated users" ON sequences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM formations
      WHERE formations.id = sequences.formation_id
        AND formations.is_published = true
    )
  );

CREATE POLICY "Admins can insert sequences" ON sequences
  FOR INSERT WITH CHECK (auth.uid() = 'af506ec2-a281-4485-a504-b0633c8d2362'::uuid);

CREATE POLICY "Admins can update sequences" ON sequences
  FOR UPDATE
  USING (auth.uid() = 'af506ec2-a281-4485-a504-b0633c8d2362'::uuid)
  WITH CHECK (auth.uid() = 'af506ec2-a281-4485-a504-b0633c8d2362'::uuid);

CREATE POLICY "Admins can delete sequences" ON sequences
  FOR DELETE USING (auth.uid() = 'af506ec2-a281-4485-a504-b0633c8d2362'::uuid);

-- ---- questions --------------------------------------------------------------

CREATE POLICY "Questions accessibles à tous" ON questions
  FOR SELECT USING (true);

CREATE POLICY "Questions are viewable by authenticated users" ON questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM (sequences s
        JOIN formations f ON ((s.formation_id = f.id)))
      WHERE ((s.id = questions.sequence_id) AND (f.is_published = true))
    )
  );

-- ---- user_formations (doublons FR + EN) -------------------------------------

CREATE POLICY "Users can view own formations" ON user_formations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut voir ses formations" ON user_formations
  FOR SELECT USING (auth.uid() = user_id);

-- ---- user_sequences (doublons FR + EN) --------------------------------------

CREATE POLICY "Users can view own sequences" ON user_sequences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Utilisateur peut voir ses séquences" ON user_sequences
  FOR SELECT USING (auth.uid() = user_id);

-- ---- course_watch_logs ------------------------------------------------------

CREATE POLICY "Users can view own watch logs" ON course_watch_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ---- epp_audits -------------------------------------------------------------

CREATE POLICY "Admin peut tout faire" ON epp_audits
  FOR ALL USING (auth.uid() = 'af506ec2-a281-4485-a504-b0633c8d2362'::uuid);

CREATE POLICY "Audits publiés visibles par tous" ON epp_audits
  FOR SELECT USING (is_published = true);

-- =============================================================================
-- 3. Drop helper user_can_see_formation
-- =============================================================================

REVOKE EXECUTE ON FUNCTION user_can_see_formation(uuid, uuid) FROM authenticated, service_role;
DROP FUNCTION IF EXISTS user_can_see_formation(uuid, uuid);

-- =============================================================================
-- 4. Drop index + colonne formations.owner_org_id
-- =============================================================================

DROP INDEX IF EXISTS formations_owner_org_id_idx;
ALTER TABLE formations DROP COLUMN IF EXISTS owner_org_id;
