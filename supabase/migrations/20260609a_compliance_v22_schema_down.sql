-- Rollback de 20260609a_compliance_v22_schema.sql

-- 1.3 down — RLS lecture
DROP POLICY IF EXISTS "compliance_items_read" ON cabinet_compliance_items;
DROP POLICY IF EXISTS "compliance_categories_read" ON cabinet_compliance_categories;
ALTER TABLE cabinet_compliance_items      DISABLE ROW LEVEL SECURITY;
ALTER TABLE cabinet_compliance_categories DISABLE ROW LEVEL SECURITY;

-- 1.2 down — restauration du vocabulaire de statut antérieur
ALTER TABLE user_cabinet_compliance DROP CONSTRAINT IF EXISTS ucc_status_check;
UPDATE user_cabinet_compliance SET status = 'pending' WHERE status = 'todo';
ALTER TABLE user_cabinet_compliance ALTER COLUMN status SET DEFAULT 'pending';
ALTER TABLE user_cabinet_compliance
  ADD CONSTRAINT user_cabinet_compliance_status_check
  CHECK (status IN ('pending','valid','warning','expired','not_applicable'));

-- 1.1 down — colonnes items
ALTER TABLE cabinet_compliance_items DROP CONSTRAINT IF EXISTS cabinet_compliance_items_frequency_check;
ALTER TABLE cabinet_compliance_items
  ADD CONSTRAINT cabinet_compliance_items_frequency_check
  CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly','on_change'));
ALTER TABLE cabinet_compliance_items DROP CONSTRAINT IF EXISTS cabinet_compliance_items_code_key;
ALTER TABLE cabinet_compliance_items DROP CONSTRAINT IF EXISTS cci_applies_when_check;
ALTER TABLE cabinet_compliance_items
  DROP COLUMN IF EXISTS applies_when,
  DROP COLUMN IF EXISTS fiche_slug,
  DROP COLUMN IF EXISTS official_url;
