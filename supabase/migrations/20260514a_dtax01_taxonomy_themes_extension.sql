-- D-TAX-01 Chantier A : Extension taxonomy themes
-- 19 nouveaux slugs type='theme' pour couvrir les sujets dentaires majeurs
-- et éliminer le fallback systémique vers 'ids'
-- Contrainte UNIQUE (type, slug) garantit l'idempotence si re-exécuté

INSERT INTO news_taxonomy (id, type, slug, label, description, active)
VALUES
  -- dent-resto (5 slugs)
  (gen_random_uuid(), 'theme', 'adhesif-collage',
   'Adhésifs et collage',
   'Systèmes adhésifs, agents de collage, protocoles d''adhésion dentinaire et amélaire',
   true),
  (gen_random_uuid(), 'theme', 'composite-materiau',
   'Composites et matériaux de restauration',
   'Résines composites directes et indirectes, CAD/CAM, résines 3D, matériaux hybrides',
   true),
  (gen_random_uuid(), 'theme', 'carie-prevention',
   'Carie et prévention',
   'Détection carieuse, prévention, reminéralisation, épidémiologie, IA détection',
   true),
  (gen_random_uuid(), 'theme', 'biomateriau-pulpaire',
   'Biomatériaux pulpaires',
   'Biodentine, MTA, recouvrement pulpaire direct/indirect, biocéramiques',
   true),
  (gen_random_uuid(), 'theme', 'protocole-restaurateur',
   'Protocoles restaurateurs',
   'Dents fissurées, hyperesthésie dentinaire, restaurations directes/indirectes, survie clinique',
   true),

  -- paro (3 slugs)
  (gen_random_uuid(), 'theme', 'detartrage-surfacage',
   'Détartrage et surfaçage radiculaire',
   'DSR, débridement sous-gingival, maintenance parodontale, instrumentations',
   true),
  (gen_random_uuid(), 'theme', 'antibio-paro',
   'Antibiothérapie en parodontologie',
   'Antibiotiques locaux et systémiques, bains de bouche, antiseptiques parodontaux',
   true),
  (gen_random_uuid(), 'theme', 'recession-gingivale',
   'Récessions gingivales',
   'Greffes conjonctives, tunnelisation, couverture radiculaire, classification',
   true),

  -- implanto (3 slugs)
  (gen_random_uuid(), 'theme', 'all-on-x',
   'Prothèses implanto-portées complètes',
   'All-on-4, All-on-6, réhabilitations complètes implanto-portées, charge immédiate',
   true),
  (gen_random_uuid(), 'theme', 'tissus-mous-implant',
   'Tissus mous péri-implantaires',
   'Contour transmuqueux, profil d''émergence, mucosite, gestion des tissus mous',
   true),
  (gen_random_uuid(), 'theme', 'greffe-osseuse',
   'Greffes osseuses et augmentation',
   'Sinus lift, sticky bone, ROG, greffes d''apposition, substituts osseux',
   true),

  -- chir-orale (2 slugs)
  (gen_random_uuid(), 'theme', 'cancer-oral',
   'Cancer oral et lésions muqueuses',
   'Carcinomes oraux, leucoplasies, dépistage précoce, chirurgie oncologique',
   true),
  (gen_random_uuid(), 'theme', 'chirurgie-dento-alveolaire',
   'Chirurgie dento-alvéolaire',
   'Extractions complexes, germectomies, dents incluses, chirurgie orthognathique',
   true),

  -- proth (2 slugs)
  (gen_random_uuid(), 'theme', 'ceramique-prothese',
   'Céramiques et prothèses fixes',
   'Zircone 4Y/5Y, couronnes monolithiques, bridges tout-céramique, e.max',
   true),
  (gen_random_uuid(), 'theme', 'prothese-amovible',
   'Prothèse amovible',
   'PAC, PAP, prothèses implanto-retenues, gestion prothétique gériatrique',
   true),

  -- odf + pedo (1 slug transversal)
  (gen_random_uuid(), 'theme', 'orthodontie-interceptive',
   'Orthodontie interceptive et pédiatrique',
   'Interception précoce, expansion maxillaire, traitement classe II/III, pédiatrie ODF',
   true),

  -- sante-pub + actu-pro + dent-resto (2 slugs transversaux)
  (gen_random_uuid(), 'theme', 'ia-diagnostic',
   'IA et diagnostic dentaire',
   'Intelligence artificielle appliquée au diagnostic, radiologie assistée, détection automatisée',
   true),
  (gen_random_uuid(), 'theme', 'reglementation-exercice',
   'Réglementation et exercice professionnel',
   'Cadre juridique, DPC/CP, référentiels HAS, responsabilité, éclairage réglementaire',
   true),

  -- sante-pub (1 slug)
  (gen_random_uuid(), 'theme', 'sante-publique-dentaire',
   'Santé publique bucco-dentaire',
   'Épidémiologie bucco-dentaire, comportements de santé, politiques publiques, hygiénistes',
   true)

ON CONFLICT (type, slug) DO NOTHING;
