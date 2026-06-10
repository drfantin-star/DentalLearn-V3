-- Rollback de 20260610a_compliance_admin_write.sql.
-- ATTENTION : DESTRUCTIF — le DROP COLUMN supprime fiche_url / fiche_storage_path
-- et donc les références aux fiches importées (les PDF restent dans le bucket,
-- mais le lien item -> fiche est perdu).

DROP POLICY IF EXISTS "compliance_items_admin_write"      ON cabinet_compliance_items;
DROP POLICY IF EXISTS "compliance_categories_admin_write" ON cabinet_compliance_categories;

ALTER TABLE cabinet_compliance_items
  DROP COLUMN IF EXISTS fiche_storage_path,
  DROP COLUMN IF EXISTS fiche_url;
