-- Nom du fichier : 20260423_news_taxonomy_seed.sql
-- Date de création : 2026-04-23
-- Ticket : feature/news-ticket-1
-- Description : Seed initial de news_taxonomy — 12 spécialités + 10 niveaux preuve + 8 thèmes
-- Rollback : supabase/migrations/20260423_news_schema_down.sql

-- ============================================================================
-- NOTE
-- ============================================================================
-- Idempotent via ON CONFLICT (type, slug) DO NOTHING, aligné sur la contrainte
-- news_taxonomy_type_slug_uniq du schema. Relancer ce seed est sans effet si
-- toutes les lignes existent déjà ; n'ajoute que les nouveautés sinon.
--
-- La colonne `active` est laissée à true pour toutes les entrées initiales.
-- Pour désactiver une valeur de taxonomy ultérieurement, utiliser UPDATE plutôt
-- que DELETE (préserve l'historique et évite les FK orphelines par slug).
-- ============================================================================

-- ============================================================================
-- SECTION 1. SPÉCIALITÉS (12)
-- ============================================================================
-- Couverture éditoriale de la section News (spec §2.1 et §8bis.2).
-- Vocabulaire fermé : ces 12 slugs sont le référentiel des tags de spécialité
-- utilisés par le LLM de synthèse (Ticket 5). Pas de création dynamique.
-- ============================================================================

INSERT INTO public.news_taxonomy (type, slug, label, description, active) VALUES
  ('specialite', 'endo',        'Endodontie',
   'Discipline traitant les affections de la pulpe dentaire et des tissus périapicaux (traitements canalaires, retraitements, chirurgie endodontique).', true),
  ('specialite', 'paro',        'Parodontologie',
   'Discipline dédiée aux tissus de soutien de la dent : gencive, os alvéolaire, ligament parodontal, cément.', true),
  ('specialite', 'chir-orale',  'Chirurgie orale',
   'Extractions, chirurgie pré-prothétique, chirurgie osseuse, traitement des pathologies des tissus mous et durs de la cavité buccale.', true),
  ('specialite', 'implanto',    'Implantologie',
   'Pose, ostéo-intégration et maintenance des implants dentaires et de leurs suprastructures prothétiques.', true),
  ('specialite', 'dent-resto',  'Dentisterie restauratrice et esthétique',
   'Restauration des tissus dentaires perdus par carie, traumatisme ou usure, incluant la dimension esthétique (collage, stratification, inlays/onlays).', true),
  ('specialite', 'proth',       'Prothèse dentaire',
   'Réhabilitation fonctionnelle et esthétique par prothèses fixées, amovibles ou supra-implantaires.', true),
  ('specialite', 'pedo',        'Pédodontie',
   'Odontologie pédiatrique : prise en charge des dents temporaires et de la denture mixte chez l''enfant et l''adolescent.', true),
  ('specialite', 'odf',         'Orthodontie dento-faciale',
   'Diagnostic et traitement des malocclusions et des anomalies dento-maxillo-faciales chez l''enfant et l''adulte.', true),
  ('specialite', 'occluso',     'Occlusodontie',
   'Étude de l''occlusion dentaire et prise en charge des désordres temporo-mandibulaires (ATM, dysfonctions).', true),
  ('specialite', 'gero',        'Gérodontologie',
   'Odontologie gériatrique : prise en charge adaptée au patient âgé, polypathologique ou dépendant.', true),
  ('specialite', 'sante-pub',   'Santé publique dentaire',
   'Épidémiologie bucco-dentaire, prévention, politiques de santé publique et programmes de dépistage.', true),
  ('specialite', 'actu-pro',    'Actualité professionnelle',
   'Exercice, syndicats, conventions, réglementation, DPC, cadre juridique et économique de la profession dentaire.', true)
ON CONFLICT (type, slug) DO NOTHING;

-- ============================================================================
-- SECTION 2. NIVEAUX DE PREUVE (10, hiérarchie Oxford CEBM)
-- ============================================================================
-- Vocabulaire fermé. Hiérarchie décroissante :
--   méta-analyse > revue systématique > RCT > cohorte > cas-témoin >
--   transversal > cas clinique > consensus > opinion d''expert.
-- La catégorie "reco-officielle" est transversale : son niveau de preuve
-- effectif dépend de la méthodologie d'élaboration de la recommandation.
-- ============================================================================

INSERT INTO public.news_taxonomy (type, slug, label, description, active) VALUES
  ('niveau_preuve', 'meta-analyse',       'Méta-analyse',
   'Synthèse statistique quantitative d''études primaires comparables ; niveau de preuve le plus élevé dans la hiérarchie Oxford CEBM.', true),
  ('niveau_preuve', 'revue-systematique', 'Revue systématique',
   'Synthèse méthodique et reproductible de la littérature selon des critères prédéfinis, sans pooling statistique obligatoire.', true),
  ('niveau_preuve', 'rct',                'Essai contrôlé randomisé',
   'Étude interventionnelle avec randomisation des sujets et groupe contrôle, standard de preuve pour évaluer une intervention clinique.', true),
  ('niveau_preuve', 'cohorte',            'Étude de cohorte',
   'Étude observationnelle prospective ou rétrospective suivant dans le temps un groupe exposé et un groupe non exposé à un facteur.', true),
  ('niveau_preuve', 'cas-temoin',         'Étude cas-témoins',
   'Étude observationnelle rétrospective comparant sujets atteints (cas) et non atteints (témoins) pour identifier des facteurs de risque.', true),
  ('niveau_preuve', 'transversal',        'Étude transversale',
   'Étude observationnelle à un instant donné, mesurant simultanément l''exposition et l''effet dans une population (études de prévalence).', true),
  ('niveau_preuve', 'cas-clinique',       'Cas clinique ou série de cas',
   'Description d''un ou plusieurs patients sans comparateur ; niveau de preuve faible, valeur essentiellement illustrative.', true),
  ('niveau_preuve', 'consensus',          'Consensus professionnel',
   'Accord formel entre experts réunis selon une méthodologie structurée (Delphi, conférence de consensus) en l''absence de preuves expérimentales suffisantes.', true),
  ('niveau_preuve', 'opinion-expert',     'Opinion d''expert',
   'Position individuelle d''un auteur reconnu ; niveau de preuve le plus faible de la hiérarchie Oxford CEBM.', true),
  ('niveau_preuve', 'reco-officielle',    'Recommandation officielle',
   'Texte émis par une autorité (HAS, ANSM, société savante, FDI) ; niveau de preuve transversal à la hiérarchie CEBM, dépendant de la méthodologie d''élaboration.', true)
ON CONFLICT (type, slug) DO NOTHING;

-- ============================================================================
-- SECTION 3. THÈMES CLINIQUES INITIAUX (8)
-- ============================================================================
-- Vocabulaire semi-ouvert : ces 8 thèmes sont les graines initiales (spec
-- §8bis.2). De nouveaux thèmes peuvent être ajoutés ultérieurement par
-- l''admin (UI Ticket 8). Le LLM de synthèse ne peut que PROPOSER un thème
-- déjà présent en base ; la création d''un nouveau thème est une action
-- explicite d''admin, pour éviter la prolifération de tags quasi-synonymes.
-- ============================================================================

INSERT INTO public.news_taxonomy (type, slug, label, description, active) VALUES
  ('theme', 'greffe-gencive',    'Greffe gingivale',
   'Technique chirurgicale de recouvrement radiculaire ou d''augmentation de tissu kératinisé (greffe épithélio-conjonctive, conjonctif enfoui, technique tunnelisée).', true),
  ('theme', 'ids',               'IDS (Immediate Dentin Sealing)',
   'Scellement dentinaire immédiat par adhésif et résine fluide après taille et avant empreinte, pour protéger la dentine exposée et optimiser le collage final.', true),
  ('theme', 'endocrown',         'Endocouronne',
   'Restauration monobloc céramique collée sur dent dépulpée, utilisant la chambre pulpaire comme rétention principale, sans tenon.', true),
  ('theme', 'aligneurs',         'Aligneurs transparents',
   'Gouttières orthodontiques amovibles thermoformées, alternative discrète aux brackets vestibulaires pour le traitement de nombreuses malocclusions.', true),
  ('theme', 'bruxisme',          'Bruxisme',
   'Activité parafonctionnelle de grincement ou serrement dentaire, diurne ou nocturne, impactant l''usure, l''occlusion et les articulations temporo-mandibulaires.', true),
  ('theme', 'apnee',             'Apnée obstructive du sommeil',
   'Pathologie du sommeil caractérisée par des obstructions répétées des voies aériennes supérieures, prise en charge possible par orthèse d''avancée mandibulaire.', true),
  ('theme', 'peri-implantite',   'Péri-implantite',
   'Pathologie infectieuse et inflammatoire des tissus péri-implantaires avec perte osseuse progressive autour d''un implant ostéo-intégré.', true),
  ('theme', 'retraitement-endo', 'Retraitement endodontique',
   'Reprise d''un traitement canalaire antérieur (dépose de l''obturation, désinfection, ré-obturation) lorsque l''échec du traitement initial est avéré ou suspecté.', true)
ON CONFLICT (type, slug) DO NOTHING;
