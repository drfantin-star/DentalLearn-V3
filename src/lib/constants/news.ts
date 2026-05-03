// Spécialités de la taxonomy news (12 valeurs alignées avec
// news_taxonomy seed du Ticket 4 / spec §6.3).
export const NEWS_SPECIALITES = [
  { value: 'actu-pro', label: 'Actualité professionnelle' },
  { value: 'chir-orale', label: 'Chirurgie orale' },
  { value: 'dent-resto', label: 'Dentisterie restauratrice' },
  { value: 'endo', label: 'Endodontie' },
  { value: 'gero', label: 'Gérodontologie' },
  { value: 'implanto', label: 'Implantologie' },
  { value: 'occluso', label: 'Occlusodontie' },
  { value: 'odf', label: 'Orthodontie' },
  { value: 'paro', label: 'Parodontologie' },
  { value: 'pedo', label: 'Pédodontie' },
  { value: 'proth', label: 'Prothèse' },
  { value: 'sante-pub', label: 'Santé publique' },
] as const

export type NewsSpecialiteSlug = typeof NEWS_SPECIALITES[number]['value']

export const NEWS_SPECIALITES_SET: Set<string> = new Set(
  NEWS_SPECIALITES.map((s) => s.value)
)

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

// Regroupement des slugs par axe pour les <optgroup> du sélecteur d'édition.
export const FORMATION_CATEGORY_GROUPS: Array<{
  axisLabel: string
  slugs: FormationCategorySlug[]
}> = [
  {
    axisLabel: 'Axe 1 — Connaissances cliniques',
    slugs: [
      'esthetique', 'restauratrice', 'chirurgie', 'implant',
      'prothese', 'parodontologie', 'endodontie', 'radiologie',
      'numerique',
    ],
  },
  {
    axisLabel: 'Axe 3 — Relation patient',
    slugs: [
      'communication', 'consentement', 'conflits',
      'decision-partagee', 'annonce-diagnostic',
      'education-therapeutique', 'ethique-deontologie',
      'numerique-relation', 'relation-patient',
    ],
  },
  {
    axisLabel: 'Axe 4 — Santé praticien',
    slugs: [
      'ergonomie', 'stress-burnout', 'risques-pro', 'violences',
      'pratique-reflexive', 'sante-praticien',
    ],
  },
  {
    axisLabel: 'Hors CP (bonus)',
    slugs: ['management', 'organisation', 'soft-skills'],
  },
]

// Niveaux de preuve (alignés avec news_taxonomy WHERE type='niveau_preuve' AND active=true,
// seed migration news v1.3). Tenir les deux sources synchronisées.
export const NEWS_NIVEAU_PREUVE = [
  { value: 'meta-analyse', label: 'Méta-analyse' },
  { value: 'revue-systematique', label: 'Revue systématique' },
  { value: 'rct', label: 'Essai contrôlé randomisé' },
  { value: 'cohorte', label: 'Étude de cohorte' },
  { value: 'cas-temoin', label: 'Étude cas-témoins' },
  { value: 'transversal', label: 'Étude transversale' },
  { value: 'cas-clinique', label: 'Cas clinique ou série de cas' },
  { value: 'reco-officielle', label: 'Recommandation officielle' },
  { value: 'consensus', label: 'Consensus professionnel' },
  { value: 'opinion-expert', label: "Opinion d'expert" },
] as const

export type NewsNiveauPreuveSlug = typeof NEWS_NIVEAU_PREUVE[number]['value']

export const NEWS_NIVEAU_PREUVE_SET: Set<string> = new Set(
  NEWS_NIVEAU_PREUVE.map((n) => n.value)
)

// Catégories éditoriales news (utilisées par /admin/news/manual mode "enriched"
// pour le champ news_syntheses.category_editorial).
export const NEWS_CATEGORIES_EDITORIALES = [
  { value: 'scientifique', label: 'Scientifique' },
  { value: 'pratique', label: 'Pratique' },
  { value: 'reglementaire', label: 'Réglementaire' },
  { value: 'humour', label: 'Humour' },
] as const

export type NewsCategorieEditorialeSlug =
  typeof NEWS_CATEGORIES_EDITORIALES[number]['value']

export const NEWS_CATEGORIES_EDITORIALES_SET: Set<string> = new Set(
  NEWS_CATEGORIES_EDITORIALES.map((c) => c.value)
)

export const NEWS_SPECIALITE_LABELS: Record<string, string> = {
  'dent-resto': 'Dentisterie restauratrice',
  'paro': 'Parodontologie',
  'implanto': 'Implantologie',
  'chir-orale': 'Chirurgie orale',
  'odf': 'Orthodontie',
  'endo': 'Endodontie',
  'occluso': 'Occlusodontologie',
  'proth': 'Prothèse',
  'sante-pub': 'Santé publique',
  'pedo': 'Pédodontie',
  'gero': 'Gérodontologie',
  'actu-pro': 'Actualité professionnelle',
}
