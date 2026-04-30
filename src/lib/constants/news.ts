// Slugs autorisés pour formation_category_match sur news_syntheses.
// Doit rester aligné avec le CHECK formations.category (27 valeurs).
export const ALLOWED_FORMATION_CATEGORIES = [
  // Axe 1 — clinique
  'esthetique', 'restauratrice', 'chirurgie', 'implant', 'prothese',
  'parodontologie', 'endodontie', 'radiologie', 'numerique',
  // Axe 3 — relation patient
  'communication', 'consentement', 'conflits', 'decision-partagee',
  'annonce-diagnostic', 'education-therapeutique',
  'ethique-deontologie', 'numerique-relation', 'relation-patient',
  // Axe 4 — santé praticien
  'ergonomie', 'stress-burnout', 'risques-pro', 'violences',
  'pratique-reflexive', 'sante-praticien',
  // Hors CP
  'management', 'organisation', 'soft-skills',
] as const

export type FormationCategorySlug =
  typeof ALLOWED_FORMATION_CATEGORIES[number]

export const FORMATION_CATEGORY_LABELS: Record<FormationCategorySlug, string> = {
  esthetique: 'Esthétique',
  restauratrice: 'Dentisterie restauratrice',
  chirurgie: 'Chirurgie orale',
  implant: 'Implantologie',
  prothese: 'Prothèse',
  parodontologie: 'Parodontologie',
  endodontie: 'Endodontie',
  radiologie: 'Radiologie',
  numerique: 'Numérique / IA',
  communication: 'Communication',
  consentement: 'Consentement éclairé',
  conflits: 'Gestion des conflits',
  'decision-partagee': 'Décision médicale partagée',
  'annonce-diagnostic': 'Annonce de diagnostic',
  'education-therapeutique': 'Éducation thérapeutique',
  'ethique-deontologie': 'Éthique & déontologie',
  'numerique-relation': 'Numérique & relation patient',
  'relation-patient': 'Relation patient (générique)',
  ergonomie: 'Ergonomie',
  'stress-burnout': 'Stress / Burn-out',
  'risques-pro': 'Risques professionnels',
  violences: 'Violences en milieu de soin',
  'pratique-reflexive': 'Pratique réflexive',
  'sante-praticien': 'Santé praticien (générique)',
  management: 'Management',
  organisation: 'Organisation',
  'soft-skills': 'Soft skills',
}
