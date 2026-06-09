-- Module Conformité Cabinet v2.2 — seed 12 catégories / 78 items.
-- Source de vérité : REFERENTIEL_CONFORMITE_CABINET_DENTAIRE_v2_2_MASTER (9 juin 2026).
-- Statut MASTER -> is_mandatory : M=true, R=false, C=true (obligatoire quand applicable).
-- official_url = lien officiel littéral du MASTER (NULL pour les ◔ sans deep-link et
-- les items sans URL : enregistrement_asnr, controle_qualite, controle_qualite_externe,
-- maintenance_autoclave, lignes_eau_units, gestion_aerosols, vaccination_hepatite_b,
-- multirisque_pro). fiche_slug = NULL partout (fiches ✦ produites séparément).

-- ─────────────────────────────────────────────────────────────────────────
-- SETUP — Catégories : UPDATE des 6 existantes + INSERT des 6 nouvelles
-- ─────────────────────────────────────────────────────────────────────────
UPDATE cabinet_compliance_categories SET name = 'Radioprotection',          display_order = 1 WHERE code = 'radioprotection';
UPDATE cabinet_compliance_categories SET name = 'Hygiène & Stérilisation',  display_order = 2 WHERE code = 'sterilisation';
UPDATE cabinet_compliance_categories SET name = 'Déchets (DASRI & Amalgame)', display_order = 4 WHERE code = 'dechets';
UPDATE cabinet_compliance_categories SET name = 'Sécurité & ERP',           display_order = 5 WHERE code = 'securite';
UPDATE cabinet_compliance_categories SET name = 'Accessibilité',            display_order = 6 WHERE code = 'accessibilite';
UPDATE cabinet_compliance_categories SET name = 'RGPD & Données de santé',  display_order = 7 WHERE code = 'rgpd';

INSERT INTO cabinet_compliance_categories (code, name, description, icon, color, display_order) VALUES
  ('materiovigilance', 'Matériovigilance',                 'Vigilance des dispositifs médicaux',        'activity',           '#EF4444', 3),
  ('numerique_sante',  'Numérique en santé / Ségur',       'Ségur, INS, Mon Espace Santé',              'monitor-smartphone', '#06B6D4', 8),
  ('info_patient',     'Information patient & Affichages',  'Information patient, devis et affichages',   'file-text',          '#0EA5E9', 9),
  ('facturation',      'Facturation électronique',         'Facturation électronique',                  'receipt',            '#10B981', 10),
  ('employeur_rh',     'Employeur / RH',                   'Obligations employeur et RH',               'users',              '#F97316', 11),
  ('assurances_ordre', 'Assurances, Ordre & Prescription', 'Assurances, Ordre et prescription',         'briefcase',          '#6366F1', 12)
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- LOT A — Catégorie 1 Radioprotection (applies_when = xray)
-- ─────────────────────────────────────────────────────────────────────────
UPDATE cabinet_compliance_items SET
  title = 'Désignation CRP (PCR/OCR)', reference_text = 'C. travail R.4451-112 et s. ; désignation CRP (PCR interne / OCR externe)',
  official_url = 'https://reglementation-controle.asnr.fr/reglementation/guides-de-l-asnr/principales-dispositions-reglementaires-de-radioprotection-applicables-en-radiologie-medicale-et-dentaire',
  applies_when = 'xray', is_mandatory = true, frequency = 'yearly', display_order = 1
WHERE code = 'pcr_designation';

UPDATE cabinet_compliance_items SET
  title = 'Suivi dosimétrique', reference_text = 'C. travail R.4451-64 et s. ; suivi dosimétrique',
  official_url = 'https://reglementation-controle.asnr.fr/reglementation/guides-de-l-asnr/principales-dispositions-reglementaires-de-radioprotection-applicables-en-radiologie-medicale-et-dentaire',
  applies_when = 'xray', is_mandatory = true, frequency = 'monthly', display_order = 3
WHERE code = 'dosimetrie';

UPDATE cabinet_compliance_items SET
  title = 'Contrôle qualité interne (CQI) + audit', reference_text = 'Décision ANSM 8/12/2008 ; CQI mensuel/trimestriel + audit annuel',
  official_url = NULL, applies_when = 'xray', is_mandatory = true, frequency = 'monthly', display_order = 5
WHERE code = 'controle_qualite';

INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, v.is_mandatory, 'xray', v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('enregistrement_asnr',      'Enregistrement activité ASNR',          'once',       true, 'CSP L.1333-8 ; enregistrement de l''activité (ASNR Téléservices)', NULL::text, 2),
  ('formation_radioprotection','Formation radioprotection (triennale)', 'multi_year', true, 'C. travail R.4451-58 ; formation radioprotection triennale', 'https://reglementation-controle.asnr.fr/reglementation/guides-de-l-asnr/principales-dispositions-reglementaires-de-radioprotection-applicables-en-radiologie-medicale-et-dentaire', 4),
  ('controle_qualite_externe', 'Contrôle qualité externe (CQE)',        'multi_year', true, 'Décision ANSM 8/12/2008 ; CQE quinquennal (5 ans) — conditionne le remboursement AM', NULL, 6),
  ('verifications_periodiques','Vérifications périodiques',             'yearly',     true, 'C. travail R.4451-40 à 51 ; vérifications périodiques', 'https://reglementation-controle.asnr.fr/reglementation/guides-de-l-asnr/principales-dispositions-reglementaires-de-radioprotection-applicables-en-radiologie-medicale-et-dentaire', 7),
  ('conformite_locaux',        'Conformité des locaux',                 'once',       true, 'Décision ASNR 2017-DC-0591 ; NF C 15-160', 'https://reglementation-controle.asnr.fr/reglementation/guides-de-l-asnr/principales-dispositions-reglementaires-de-radioprotection-applicables-en-radiologie-medicale-et-dentaire', 8),
  ('paq',                      'Programme d''assurance qualité (PAQ)',  'on_change',  true, 'Réglementation ASNR ; programme d''assurance qualité (PAQ)', 'https://reglementation-controle.asnr.fr/reglementation/guides-de-l-asnr/principales-dispositions-reglementaires-de-radioprotection-applicables-en-radiologie-medicale-et-dentaire', 9)
) AS v(code, title, frequency, is_mandatory, reference_text, official_url, display_order)
WHERE c.code = 'radioprotection'
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- LOT B — Catégorie 2 Hygiène & Stérilisation (applies_when = always)
-- ─────────────────────────────────────────────────────────────────────────
UPDATE cabinet_compliance_items SET
  title = 'Traçabilité stérilisation (DM–cycle–patient)', reference_text = 'Guide DGS 2006 ; CSP R.5211-1 ; traçabilité DM–cycle–patient',
  official_url = 'https://www.paca.ars.sante.fr/media/15464/download',
  applies_when = 'always', is_mandatory = true, frequency = 'daily', display_order = 1
WHERE code = 'tracabilite';

UPDATE cabinet_compliance_items SET
  title = 'Test de Bowie-Dick', reference_text = 'NF EN ISO 11140-4 ; Guide DGS 2006 ; HAS 2007 (R29)',
  official_url = 'https://www.paca.ars.sante.fr/media/15464/download',
  applies_when = 'always', is_mandatory = true, frequency = 'daily', display_order = 2
WHERE code = 'test_bowie_dick';

UPDATE cabinet_compliance_items SET
  title = 'Maintenance + qualification autoclave', reference_text = 'NF EN ISO 17665 (ex-NF EN 554) ; HAS 2007 (R30)',
  official_url = NULL, applies_when = 'always', is_mandatory = true, frequency = 'yearly', display_order = 4
WHERE code = 'maintenance_autoclave';

INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, v.is_mandatory, 'always', v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('test_vide',              'Test de vide / d''étanchéité',                   'daily',     true,  'NF EN 13060 ; Guide DGS 2006', 'https://www.paca.ars.sante.fr/media/15464/download', 3),
  ('predesinfection',        'Protocole pré-désinfection / nettoyage',         'on_change', true,  'Guide DGS 2006 ; protocole pré-désinfection / nettoyage', 'https://www.paca.ars.sante.fr/media/15464/download', 5),
  ('plan_nettoyage_surfaces','Plan de nettoyage-désinfection des surfaces',    'on_change', true,  'Guide DGS 2006 ; plan de nettoyage-désinfection des surfaces', 'https://www.paca.ars.sante.fr/media/15464/download', 6),
  ('lignes_eau_units',       'Entretien des lignes d''eau des units',          'daily',     false, 'HAS 2007 (R4-R5) ; purge ≥1 min, chaud >60 °C / froid <20 °C', NULL::text, 7),
  ('gestion_aerosols',       'Gestion des aérosols (aspiration/ventilation)',  'on_change', false, 'Reco HAS-SF2H ; aspiration / ventilation', NULL, 8),
  ('epi_equipe',             'EPI de l''équipe',                               'on_change', true,  'Arrêté 10/07/2013 ; HAS 2007 (R44-R47)', 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000027914606', 9),
  ('vaccination_hepatite_b', 'Vaccination hépatite B (personnel exposé)',      'on_change', true,  'CSP L.3111-4 / L.3112-1 ; arrêtés 23/08/1991 et 26/04/1999 ; HAS 2007 (R84)', NULL, 10),
  ('protocole_aes',          'Protocole AES (accident d''exposition au sang)', 'on_change', true,  'Décret 2013-607 du 9/07/2013 ; arrêté 10/07/2013 ; HAS 2007 (R52)', 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000027914606', 11)
) AS v(code, title, frequency, is_mandatory, reference_text, official_url, display_order)
WHERE c.code = 'sterilisation'
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- LOT C — Catégorie 3 Matériovigilance (always, NEW) + Catégorie 4 Déchets
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, true, 'always', v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('materiovigilance_registre',   'Registre de matériovigilance',                'on_change', 'MDR (UE) 2017/745 ; CSP L.5212-2', 'https://ansm.sante.fr/documents/reference/dispositifs-medicaux-signalement-de-vigilance', 1),
  ('signalement_ansm',            'Signalement des incidents à l''ANSM',         'on_change', 'MDR (UE) 2017/745 ; signalement des incidents à l''ANSM', 'https://entreprendre.service-public.gouv.fr/vosdroits/R14403', 2),
  ('tracabilite_dm_implantables', 'Traçabilité des lots de DM implantables',     'on_change', 'MDR (UE) 2017/745 ; traçabilité des lots de DM implantables', 'https://ansm.sante.fr/documents/reference/dispositifs-medicaux-signalement-de-vigilance', 3),
  ('gestion_alertes_fsca',        'Procédure de gestion des alertes / FSCA',     'on_change', 'ANSM ; procédure de gestion des alertes / FSCA', 'https://ansm.sante.fr/documents/reference/dispositifs-medicaux-signalement-de-vigilance', 4)
) AS v(code, title, frequency, reference_text, official_url, display_order)
WHERE c.code = 'materiovigilance'
ON CONFLICT (code) DO NOTHING;

UPDATE cabinet_compliance_items SET
  title = 'Convention collecteur DASRI agréé', reference_text = 'CSP R.1335-1 et s. ; convention avec collecteur DASRI agréé',
  official_url = 'https://www.iledefrance.ars.sante.fr/dechets-dactivites-de-soins-risques-infectieux-dasri-1',
  applies_when = 'always', is_mandatory = true, frequency = 'yearly', display_order = 1
WHERE code = 'contrat_dasri';

UPDATE cabinet_compliance_items SET
  title = 'Bordereaux (Trackdéchets ; conservation 3 ans)', reference_text = 'Arrêté 7/09/1999 ; loi AGEC ; Trackdéchets, conservation 3 ans',
  official_url = 'https://www.formulaires.service-public.fr/gf/getNotice.do?cerfaNotice=51814&cerfaFormulaire=11351',
  applies_when = 'always', is_mandatory = true, frequency = 'on_change', display_order = 2
WHERE code = 'bordereau_suivi';

INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, true, 'always', v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('conditionnement_dasri', 'Conditionnement + délais de stockage',          'on_change', 'Arrêté 24/11/2003 (emballages) ; arrêté 7/09/1999 mod. 20/04/2020 (entreposage/délais)', 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000416613', 3),
  ('separateur_amalgame',   'Séparateur d''amalgame + recyclage',            'yearly',    'Arrêté 30/03/1998 ; Règl. (UE) 2017/852', 'https://www.ordre-chirurgiens-dentistes.fr/actualites/mercure-note-dinformation/', 4),
  ('tracabilite_amalgame',  'Traçabilité usage dérogatoire amalgame',        'on_change', 'Règl. (UE) 2024/1849 ; usage dérogatoire amalgame', 'https://www.ordre-chirurgiens-dentistes.fr/actualites/mercure-note-dinformation/', 5)
) AS v(code, title, frequency, reference_text, official_url, display_order)
WHERE c.code = 'dechets'
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- LOT D — Catégorie 5 Sécurité & ERP (mixte) + Catégorie 6 Accessibilité
-- ─────────────────────────────────────────────────────────────────────────
UPDATE cabinet_compliance_items SET
  title = 'Registre de sécurité ERP', reference_text = 'CCH R.123-51 ; obligatoire seulement ERP avec locaux à sommeil → recommandé pour le cabinet',
  official_url = 'https://www.herault.gouv.fr/content/download/32063/218702/file/guide%20sur%20la%20s%C3%A9curit%C3%A9%20incendie%20dans%20les%20ERP%20de%205%C3%A8me%20cat%C3%A9gorie%20sans%20locaux%20%C3%A0%20sommeil.pdf',
  applies_when = 'always', is_mandatory = false, frequency = 'yearly', display_order = 1
WHERE code = 'registre_securite';

UPDATE cabinet_compliance_items SET
  title = 'Vérification des extincteurs', reference_text = 'Règlement de sécurité ERP — arrêté 25/06/1980 mod. 1/12/2025 ; entretien annuel',
  official_url = 'https://www.legifrance.gouv.fr/codes/section_lc/JORFTEXT000000290033/LEGISCTA000020342841/',
  applies_when = 'always', is_mandatory = true, frequency = 'yearly', display_order = 2
WHERE code = 'extincteurs';

UPDATE cabinet_compliance_items SET
  title = 'DUERP (conservation 40 ans)', reference_text = 'C. travail R.4121-1 et s. ; conservation 40 ans',
  official_url = 'https://entreprendre.service-public.gouv.fr/vosdroits/F35360',
  applies_when = 'employer', is_mandatory = true, frequency = 'yearly', display_order = 4
WHERE code = 'duerp';

INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, v.is_mandatory, v.applies_when, v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('verif_electrique',   'Vérification installations électriques',     'yearly', true,  'employer', 'C. travail R.4226-16 ; arrêté 26/12/2011 ; périodicité 1 an (2 ans si rapport sans observation)', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000022765070/', 3),
  ('affichage_incendie', 'Affichage consignes incendie / évacuation',  'once',   true,  'always',   'CCH (ERP) ; C. travail R4227-34 à R4227-41 ; NF EN ISO 7010', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F23106', 5),
  ('dae',                'DAE (maintenance, Géo''DAE, signalétique)',   'yearly', false, 'dae',      'Décret 2018-1259 ; arrêté 29/10/2019 ; décret 5/12/2025 ; maintenance, Géo''DAE, signalétique', 'https://geodae.atlasante.fr/apropos', 6)
) AS v(code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
WHERE c.code = 'securite'
ON CONFLICT (code) DO NOTHING;

INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, v.is_mandatory, v.applies_when, v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('accessibilite_conformite',     'Conformité accessibilité (ou dérogation)', 'once',      true, 'always',   'Loi 11/02/2005 ; CCH ; conformité accessibilité ou dérogation', 'https://www.ecologie.gouv.fr/politiques-publiques/laccessibilite-etablissements-recevant-du-public-erp', 1),
  ('attestation_accessibilite',    'Attestation d''accessibilité (cat. 5)',     'once',      true, 'always',   'CCH ; attestation d''accessibilité (ERP cat. 5)', 'https://entreprendre.service-public.gouv.fr/vosdroits/F32873', 2),
  ('registre_public_accessibilite','Registre Public d''Accessibilité (RPA)',    'on_change', true, 'always',   'Décret 2017-431 ; arrêté 19/04/2017 ; registre public d''accessibilité', 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000034307896', 3),
  ('formation_accueil_pmr',        'Formation accueil PMR',                     'on_change', true, 'employer', 'Arrêté 19/04/2017 ; formation à l''accueil des personnes handicapées', 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000034454237', 4)
) AS v(code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
WHERE c.code = 'accessibilite'
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- LOT E — Catégorie 7 RGPD & Données de santé
-- ─────────────────────────────────────────────────────────────────────────
UPDATE cabinet_compliance_items SET
  title = 'Registre des activités de traitement', reference_text = 'Art. 30 RGPD ; référentiels CNIL santé',
  official_url = 'https://www.cnil.fr/fr/la-cnil-publie-trois-referentiels-pour-le-secteur-de-la-sante',
  applies_when = 'always', is_mandatory = true, frequency = 'on_change', display_order = 1
WHERE code = 'registre_traitement';

UPDATE cabinet_compliance_items SET
  title = 'Consentement image (photos cliniques)', reference_text = 'Droit à l''image : C. civ. art. 9 ; C. pénal art. 226-1 ; CSP L.1111-8 ; consentement explicite (RGPD)',
  official_url = 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006419288',
  applies_when = 'always', is_mandatory = true, frequency = 'on_change', display_order = 8
WHERE code = 'consentement';

INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, v.is_mandatory, v.applies_when, v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('hebergement_hds',          'Hébergement HDS certifié',                  'once',      true, 'hds',    'CSP L.1111-8 ; décret 2018-137 ; hébergement de données de santé certifié', 'https://esante.gouv.fr/produits-services/hds', 2),
  ('contrats_sous_traitance',  'Contrats sous-traitance art. 28',           'on_change', true, 'always', 'Art. 28 RGPD ; contrats de sous-traitance', 'https://www.cnil.fr/fr/rgpd-et-professionnels-de-sante-liberaux-ce-que-vous-devez-savoir', 3),
  ('information_patients_rgpd','Information des patients',                  'on_change', true, 'always', 'Art. 13 RGPD ; information des patients', 'https://www.cnil.fr/fr/rgpd-et-professionnels-de-sante-liberaux-ce-que-vous-devez-savoir', 4),
  ('notification_violation',   'Notification violation < 72 h + registre',  'on_change', true, 'always', 'Art. 33/34 RGPD ; notification < 72 h + registre des violations', 'https://www.cnil.fr/fr/rgpd-et-professionnels-de-sante-liberaux-ce-que-vous-devez-savoir', 5),
  ('durees_conservation',      'Maîtrise durées de conservation (20/28 ans)','yearly',   true, 'always', 'CSP R.1112-7 ; dossier 20 ans, prorogé au 28e anniversaire ; 10 ans après décès', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036658351', 6),
  ('acces_dossier_patient',    'Procédure d''accès au dossier patient',     'on_change', true, 'always', 'CSP L.1111-7 ; R.1111-1 à R.1111-7', 'https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000006196866/', 7),
  ('secret_partage',           'Secret partagé en équipe de soins',         'on_change', true, 'always', 'CSP L.1110-4 ; L.1110-12 ; R.1110-1 ; R.1110-3-I', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000043895798', 9),
  ('evaluation_dpo',           'Évaluation nécessité d''un DPO',            'once',      true, 'always', 'Art. 37 RGPD ; évaluation de la nécessité d''un DPO', 'https://www.cnil.fr/fr/rgpd-et-professionnels-de-sante-liberaux-ce-que-vous-devez-savoir', 10),
  ('cybersecurite',            'Cyber-sécurité (sauvegardes, MDP, antivirus)','on_change',true, 'always', 'Art. 32 RGPD ; sauvegardes, mots de passe, antivirus', 'https://cyberveille.esante.gouv.fr/', 11)
) AS v(code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
WHERE c.code = 'rgpd'
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- LOT F — Catégorie 8 Numérique en santé + Catégorie 10 Facturation (always, NEW)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, true, 'always', v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('ins_identitovigilance', 'INS / identitovigilance (opposable 2026)', 'on_change',  'CSP L.1111-8-1 ; arrêté 24/12/2019 mod. 12/12/2024 ; INS opposable 2026', 'https://esante.gouv.fr/produits-services/referentiel-ins', 1),
  ('mon_espace_sante_dmp',  'Alimentation Mon Espace Santé / DMP',      'on_change',  'CSP L.1111-15 ; alimentation Mon Espace Santé / DMP', 'https://gnius.esante.gouv.fr/fr/reglementation/fiches-reglementation/dossier-medical-partage-dmp', 2),
  ('cartes_cps',            'Cartes CPS / CPx',                         'multi_year', 'Référentiel ANS ; cartes CPS / CPx', 'https://esante.gouv.fr/produits-services/certificats-logiciels', 3)
) AS v(code, title, frequency, reference_text, official_url, display_order)
WHERE c.code = 'numerique_sante'
ON CONFLICT (code) DO NOTHING;

INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, true, 'always', v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('reception_factures_electroniques', 'Réception factures électroniques (1/9/2026)', 'once',      'CGI art. 289 bis ; 1737 ; réception des factures électroniques (1/9/2026)', 'https://www.impots.gouv.fr/facturation-electronique-qu-est-ce-que-ca-change-pour-moi', 1),
  ('emission_plateforme_agreee',       'Émission via Plateforme Agréée (1/9/2027)',   'once',      'Réforme e-invoicing ; émission via Plateforme Agréée (1/9/2027)', 'https://www.economie.gouv.fr/tout-savoir-sur-la-facturation-electronique-pour-les-entreprises', 2),
  ('e_reporting',                      'e-reporting',                                 'on_change', 'Réforme e-invoicing ; e-reporting', 'https://www.impots.gouv.fr/facturation-electronique-qu-est-ce-que-ca-change-pour-moi', 3)
) AS v(code, title, frequency, reference_text, official_url, display_order)
WHERE c.code = 'facturation'
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- LOT G — Catégorie 9 Information patient & Affichages (always, NEW)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, true, 'always', v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('affichage_honoraires',               'Affichage honoraires',                          'on_change', 'Arrêté 30/05/2018 ; consultation + ≥5 actes opposables + ≥5 prothétiques', 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000037032490', 1),
  ('affichage_situation_conventionnelle','Affichage situation conventionnelle',           'on_change', 'Arrêté 30/05/2018 ; affichage de la situation conventionnelle', 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000037032490', 2),
  ('devis_conventionnel',                'Devis conventionnel / 100 % Santé',             'on_change', 'Arrêté 30/05/2018 ; devis conventionnel / 100 % Santé', 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000037032490', 3),
  ('tracabilite_protheses',              'Traçabilité prothèses (remise patient)',        'on_change', 'MDR ; DGCCRF ; traçabilité des prothèses remises au patient', 'https://www.ordre-chirurgiens-dentistes.fr/actualites/information-des-patients-les-controles-de-la-dgccrf-ont-commence/', 4),
  ('information_ecrite_prealable',       'Information écrite préalable (>70 € / non remboursé)', 'on_change', 'Arrêté 30/05/2018 ; information écrite préalable (>70 € / acte non remboursé)', 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000037032490', 5),
  ('consentement_eclaire',               'Consentement éclairé',                          'on_change', 'CSP L.1111-2 ; L.1111-4 ; consentement libre et éclairé', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054137408', 6),
  ('plaque_mentions_ordinales',          'Plaque / mentions ordinales',                   'once',      'Code de déontologie — CSP R4127-201 et s.', 'https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006190548', 7),
  ('affichage_interdiction_fumer',       'Affichage interdiction fumer / vapoter',        'once',      'Fumer : CSP R3512-7 ; vapoter : CSP L3513-1 à L3513-6, D3513-1 à R3513-4', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F23106', 8),
  ('communication_publicite',            'Communication & publicité conformes',           'on_change', 'Décret 2020-1658 ; déontologie ; communication & publicité conformes', 'https://www.legifrance.gouv.fr/codes/id/LEGISCTA000006190548', 9)
) AS v(code, title, frequency, reference_text, official_url, display_order)
WHERE c.code = 'info_patient'
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- LOT H — Catégorie 11 Employeur / RH (applies_when = employer, NEW)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, v.is_mandatory, 'employer', v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('ccn_dentaire',             'CCN cabinets dentaires (IDCC 1619) + info salariés', 'on_change', true, 'CCN 17/01/1992 (IDCC 1619) ; NAF 851E ; affichage C. travail R2262-1 à R2262-5', 'https://www.legifrance.gouv.fr/conv_coll/id/KALICONT000005635655', 1),
  ('dpae',                     'DPAE',                                               'on_change', true, 'C. travail L.1221-10 ; déclaration préalable à l''embauche', 'https://www.urssaf.fr/accueil/employeur/embaucher-gerer-salaries/embaucher/declaration-prealable-embauche.html', 2),
  ('registre_unique_personnel','Registre unique du personnel',                       'on_change', true, 'C. travail L.1221-13 ; registre unique du personnel', 'https://www.economie.gouv.fr/entreprises/gerer-ses-ressources-humaines-et-ses-salaries/registre-unique-du-personnel-quelles-sont', 3),
  ('adhesion_spst',            'Adhésion SPST + visites',                            'yearly',    true, 'C. travail L.4624-1 ; adhésion SPST + visites', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F2211', 4),
  ('mutuelle_collective',      'Mutuelle collective (≥50 %)',                        'once',      true, 'ANI 11/01/2013 ; CSS L.911-7 ; mutuelle collective (≥50 %)', 'https://entreprendre.service-public.gouv.fr/vosdroits/F33754', 5),
  ('affichages_employeur',     'Affichages obligatoires employeur',                  'once',      true, 'C. travail D4711-1 ; documents et affichages obligatoires (selon effectif)', 'https://www.service-public.gouv.fr/particuliers/vosdroits/F23106', 6),
  ('prevention_tms',           'Prévention des TMS',                                 'on_change', true, 'C. travail L.4121-1 / L.4121-2 ; prévention des TMS', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000035640828', 7),
  ('accueil_stagiaire',        'Accueil de stagiaire',                               'on_change', true, 'Arrêté 27/09/1994 (art. 28) ; modèle de convention arrêté 27/02/2007', 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000029214223', 8)
) AS v(code, title, frequency, is_mandatory, reference_text, official_url, display_order)
WHERE c.code = 'employeur_rh'
ON CONFLICT (code) DO NOTHING;

-- ─────────────────────────────────────────────────────────────────────────
-- LOT I — Catégorie 12 Assurances, Ordre & Prescription (mixte, NEW)
-- ─────────────────────────────────────────────────────────────────────────
INSERT INTO cabinet_compliance_items (category_id, code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
SELECT id, v.code, v.title, v.frequency, v.is_mandatory, v.applies_when, v.reference_text, v.official_url, v.display_order
FROM cabinet_compliance_categories c, (VALUES
  ('assurance_rcp',          'Assurance RCP',                 'yearly',    true,  'always',           'CSP L.1142-2 ; assurance RC professionnelle obligatoire', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000025076559', 1),
  ('inscription_ordre_rpps', 'Inscription Ordre / RPPS',      'yearly',    true,  'always',           'CSP L.4112-1 à L.4112-6 ; RPPS arrêté 23/09/2022', 'https://www.legifrance.gouv.fr/codes/section_lc/LEGITEXT000006072665/LEGISCTA000021497801/', 2),
  ('multirisque_pro',        'Multirisque professionnelle',   'yearly',    false, 'always',           'Multirisque professionnelle (recommandée)', NULL::text, 3),
  ('ordonnance_securisee',   'Ordonnance sécurisée',          'on_change', true,  'prescriber',       'CSP R.5132-5 ; ordonnance sécurisée', 'https://www.ameli.fr/chirurgien-dentiste/exercice-liberal/prescription-prise-charge/regles-prescription-formalites/medicaments-dispositifs', 4),
  ('registre_stupefiants',   'Registre des stupéfiants',      'on_change', true,  'stupefiant_stock', 'CSP R.5132-36 ; déclencheur = détention d''un stock (provision soins urgents, max 10 unités) ; registre conservé 10 ans', 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000045117816', 5)
) AS v(code, title, frequency, is_mandatory, applies_when, reference_text, official_url, display_order)
WHERE c.code = 'assurances_ordre'
ON CONFLICT (code) DO NOTHING;
