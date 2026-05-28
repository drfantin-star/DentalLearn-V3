// Bibliothèque de ressources documentaires rattachée aux axes de la
// certification périodique. Données statiques : liens sortants vers les
// sources officielles (ADF, SFCO, HAS, INRS…) + quelques documents internes
// DentalLearn. Les contenus externes ne sont JAMAIS hébergés par l'app —
// on renvoie toujours vers la source officielle.

export interface RessourceBibliotheque {
  id: string
  titre: string
  source: string // ex. "ADF", "SFCO", "HAS", "INRS", "DentalLearn"
  description?: string // 1 ligne max
  type: 'external' | 'internal'
  url: string // external : URL officielle ; internal : route/PDF interne
  categorie?: string // pour regrouper (ex. "Consentements", "Conseils post-op")
}

// Dégradés d'accent par axe — alignés sur les <header> des pages d'axe
// (cf. /formation, /patient, /sante) pour une cohérence visuelle directe.
export const AXE_GRADIENTS: Record<1 | 3 | 4, { from: string; to: string }> = {
  1: { from: '#1E40AF', to: '#3B82F6' }, // Pratiques cliniques (bleu)
  3: { from: '#F97316', to: '#FBBF24' }, // Relation patient (orange)
  4: { from: '#EC4899', to: '#A78BFA' }, // Santé praticien (rose)
}

// Axe 1 — Pratiques cliniques : à remplir ultérieurement.
export const BIBLIOTHEQUE_FORMATION: RessourceBibliotheque[] = [
  // Placeholder — aucune ressource pour le moment.
]

// Axe 3 — Relation patient.
export const BIBLIOTHEQUE_PATIENT: RessourceBibliotheque[] = [
  {
    id: 'droits-patient',
    titre: 'Vos droits en tant que patient',
    source: 'DentalLearn',
    description: "Fiche d'information à remettre systématiquement au patient.",
    type: 'internal',
    url: '/patient/bibliotheque/droits-patient',
    categorie: 'Information patient',
  },
  {
    id: 'consentements-adf',
    titre: 'Formulaires de consentement éclairé (6 disciplines)',
    source: 'ADF',
    description:
      'Chirurgie orale, parodontale, pédiatrie, prothèse, implanto, endo. Téléchargement libre en bas de page.',
    type: 'external',
    url: 'https://adf.asso.fr/articles/consentement-eclaire-du-patient-vos-formulaires-pour-le-recueillir/',
    categorie: 'Consentements',
  },
  {
    id: 'sfco-consentements',
    titre: 'Consentements et informations médicales par acte',
    source: 'SFCO',
    description:
      'Avulsions, dents de sagesse, implants, greffes, biopsies, comblements sinusiens…',
    type: 'external',
    url: 'https://societechirorale.com/consentements/',
    categorie: 'Consentements',
  },
  {
    id: 'sfco-fiches-patient',
    titre: "Fiches d'information à destination des patients",
    source: 'SFCO',
    description:
      'Médecine orale et chirurgie orale : conseils post-opératoires, questionnaire médical…',
    type: 'external',
    url: 'https://societechirorale.com/fiches-informations-a-destination-des-patients/',
    categorie: 'Conseils post-opératoires',
  },
  {
    id: 'has-information',
    titre: "Délivrance de l'information à la personne sur son état de santé",
    source: 'HAS',
    description: 'Recommandation de bonne pratique (mai 2012) — cadre de référence.',
    type: 'external',
    url: 'https://www.has-sante.fr/jcms/c_1261551/fr/delivrance-de-l-information-a-la-personne-sur-son-etat-de-sante',
    categorie: 'Référence',
  },
]

// Axe 4 — Santé praticien : à remplir ultérieurement.
export const BIBLIOTHEQUE_SANTE: RessourceBibliotheque[] = [
  // Placeholder — aucune ressource pour le moment.
]

// Sous-titres par défaut du bandeau, selon l'axe.
export const BIBLIOTHEQUE_DEFAULT_SUBTITLES: Record<1 | 3 | 4, string> = {
  1: 'Documents et références pour vos pratiques cliniques',
  3: "Documents d'information et consentements à remettre à vos patients",
  4: 'Ressources pour votre santé et votre bien-être au travail',
}
