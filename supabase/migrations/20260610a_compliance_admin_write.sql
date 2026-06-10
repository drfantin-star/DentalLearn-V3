-- Module Conformité Cabinet — droits d'écriture admin + colonnes fiche.
-- Contexte : la PR #374 (référentiel v2.2) a activé la RLS sur
-- cabinet_compliance_categories / cabinet_compliance_items avec UNIQUEMENT des
-- policies SELECT (compliance_*_read). L'interface admin doit pouvoir créer /
-- éditer / supprimer catégories et items : on ajoute donc les droits d'écriture
-- super_admin, calqués sur la policy « CRUD biblio admin » de
-- 20260529a_bibliotheque_ressources.sql (is_super_admin(auth.uid())).
--
-- On ajoute aussi 2 colonnes pour la fonctionnalité « importer une fiche » :
-- le PDF est uploadé dans le bucket public existant `bibliotheque-publique`
-- (déjà doté de policies admin), son URL publique et son chemin de stockage
-- sont mémorisés sur l'item.
--
-- Down jumelé : 20260610a_compliance_admin_write_down.sql.

-- 1. Colonnes fiche (PDF interne) sur les items.
ALTER TABLE cabinet_compliance_items
  ADD COLUMN IF NOT EXISTS fiche_url          text,
  ADD COLUMN IF NOT EXISTS fiche_storage_path text;

-- 2. Écriture super_admin sur les items (FOR ALL = INSERT/UPDATE/DELETE).
--    Les policies SELECT (compliance_items_read) restent intactes.
--    DROP IF EXISTS pour l'idempotence du re-run.
DROP POLICY IF EXISTS "compliance_items_admin_write" ON cabinet_compliance_items;
CREATE POLICY "compliance_items_admin_write" ON cabinet_compliance_items
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));

-- 3. Écriture super_admin sur les catégories.
DROP POLICY IF EXISTS "compliance_categories_admin_write" ON cabinet_compliance_categories;
CREATE POLICY "compliance_categories_admin_write" ON cabinet_compliance_categories
  FOR ALL TO authenticated
  USING (is_super_admin(auth.uid()))
  WITH CHECK (is_super_admin(auth.uid()));
