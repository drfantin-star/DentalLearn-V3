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
