-- Module Conformité Cabinet v2.2 — évolution de schéma
-- Réf. handoff REFERENTIEL_CONFORMITE_CABINET_DENTAIRE_v2_2_MASTER (9 juin 2026).
-- 12 catégories / 78 items. Le seed est dans 20260609b_compliance_v22_seed.sql.

-- 1.1 Nouvelles colonnes items
ALTER TABLE cabinet_compliance_items
  ADD COLUMN IF NOT EXISTS official_url text,
  ADD COLUMN IF NOT EXISTS fiche_slug   text,
  ADD COLUMN IF NOT EXISTS applies_when varchar NOT NULL DEFAULT 'always';

ALTER TABLE cabinet_compliance_items
  ADD CONSTRAINT cci_applies_when_check
  CHECK (applies_when IN ('always','xray','employer','hds','prescriber','stupefiant_stock','dae'));

-- `code` est la clé naturelle (JOIN/UPDATE du seed, ON CONFLICT). Unicité requise.
ALTER TABLE cabinet_compliance_items
  ADD CONSTRAINT cabinet_compliance_items_code_key UNIQUE (code);

-- frequency portait une CHECK (daily/weekly/monthly/quarterly/yearly/on_change) :
-- on l'étend avec 'once' et 'multi_year' (valeurs du référentiel v2.2).
ALTER TABLE cabinet_compliance_items DROP CONSTRAINT IF EXISTS cabinet_compliance_items_frequency_check;
ALTER TABLE cabinet_compliance_items
  ADD CONSTRAINT cabinet_compliance_items_frequency_check
  CHECK (frequency IN ('daily','weekly','monthly','quarterly','yearly','multi_year','on_change','once'));

-- 1.2 Vocabulaire de statut : todo / done / not_applicable ('expired' dérivé au front).
-- La table portait déjà une CHECK (pending/valid/warning/expired/not_applicable) :
-- on la DROP d'abord, sinon UPDATE -> 'todo' la violerait. Table vide + aucune
-- dépendance code (grep vérifié) => swap sans risque.
ALTER TABLE user_cabinet_compliance DROP CONSTRAINT IF EXISTS user_cabinet_compliance_status_check;
UPDATE user_cabinet_compliance SET status = 'todo' WHERE status = 'pending';
ALTER TABLE user_cabinet_compliance ALTER COLUMN status SET DEFAULT 'todo';
ALTER TABLE user_cabinet_compliance
  ADD CONSTRAINT ucc_status_check
  CHECK (status IN ('todo','done','not_applicable'));

-- 1.3 RLS lecture sur les 2 tables de référence (étaient OFF — advisory critique).
ALTER TABLE cabinet_compliance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cabinet_compliance_items      ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compliance_categories_read" ON cabinet_compliance_categories
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "compliance_items_read" ON cabinet_compliance_items
  FOR SELECT TO authenticated USING (true);
