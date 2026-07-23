-- 20260723i_retag_in_vitro_syntheses.sql
-- Retag de 65 syntheses actives dont niveau_preuve porte un devis clinique
-- (cas-temoin, transversal, opinion-expert, cas-clinique) alors que method /
-- evidence_level decrivent une etude de laboratoire (in vitro / ex vivo),
-- sans aucun signal clinique concurrent. Le slug 'in-vitro' existe depuis
-- 20260723d.
--
-- Perimetre : status = 'active', niveau_preuve IN (cas-temoin, transversal,
-- opinion-expert, cas-clinique), signal labo present dans method OU
-- evidence_level (in vitro, in-vitro, ex vivo, ex-vivo, sur dents extraites,
-- laboratoire) ET aucun signal clinique concurrent (patient, participant,
-- volontaire, sujet humain, randomis*, essai clinique, cohorte, in vivo,
-- "suivi de N", "mois de suivi"). meta-analyse / revue-systematique /
-- consensus / rct hors perimetre (le design de synthese prime sur le
-- materiau etudie). Les lignes a double signal (labo + clinique, 67 lignes)
-- ne recoivent aucune ecriture.
--
-- Verifie en dry-run avant ecriture : 65 lignes exactement
-- (cas-temoin 35, transversal 17, opinion-expert 12, cas-clinique 1).
--
-- is_editorially_validated non touche (decision explicite de Julie).
--
-- Reversibilite : snapshot de (id, niveau_preuve, snapshotted_at) dans une
-- table dediee avant tout UPDATE. Le rollback restaure depuis ce snapshot
-- puis supprime la table (cf. fichier _down).

-- 1) Table de snapshot dediee a cette migration.
CREATE TABLE IF NOT EXISTS news_syntheses_retag_in_vitro_20260723_snapshot (
  id uuid PRIMARY KEY,
  niveau_preuve text NOT NULL,
  snapshotted_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Snapshot des lignes concernees (perimetre exact du dry-run : 65 lignes).
INSERT INTO news_syntheses_retag_in_vitro_20260723_snapshot (id, niveau_preuve, snapshotted_at)
SELECT ns.id, ns.niveau_preuve, now()
FROM news_syntheses ns
WHERE ns.status = 'active'
  AND ns.niveau_preuve IN ('cas-temoin', 'transversal', 'opinion-expert', 'cas-clinique')
  AND (
    ns.method ~* '(in.?vitro|ex.?vivo|sur dents extraites|laboratoire)'
    OR ns.evidence_level ~* '(in.?vitro|ex.?vivo|sur dents extraites|laboratoire)'
  )
  AND NOT (
    ns.method ~* '(patient|participant|volontaire|sujet humain|randomis|essai clinique|cohorte|in vivo|suivi de \d|mois de suivi)'
    OR ns.evidence_level ~* '(patient|participant|volontaire|sujet humain|randomis|essai clinique|cohorte|in vivo|suivi de \d|mois de suivi)'
  )
ON CONFLICT (id) DO NOTHING;

-- 3) UPDATE restreint aux lignes effectivement snapshotees : le retag
--    correspond exactement au snapshot, sans re-evaluation du critere.
UPDATE news_syntheses ns
SET niveau_preuve = 'in-vitro'
FROM news_syntheses_retag_in_vitro_20260723_snapshot snap
WHERE ns.id = snap.id;
