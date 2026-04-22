// Types communs pour la génération d'attestations

export type AttestationType = 'formation_online' | 'epp'

export interface FormationAttestationData {
  participant: {
    nom_complet: string      // "Dr LENFANT Benoit"
    rpps: string              // "10101396553"
    profession: string        // "Chirurgien-dentiste"
  }
  formation: {
    id: string
    title: string
    axe_cp: number | null
    type_cnp: string          // 'A' | 'B' | 'C' | 'D'
    formateur: string
    slug: string
  }
  parcours: {
    started_at: string | Date
    completed_at: string | Date
    duree_heures: number      // Forfaitaire 6h
    nb_sequences: number
    nb_sequences_total: number
    taux_reussite_quiz: number
    taux_completion: number
  }
  verification_code: string   // "DL-XXXXXX-XXXX"
}

export interface EppAttestationData {
  participant: {
    nom_complet: string
    rpps: string
    profession: string
  }
  audit: {
    id: string
    title: string
    theme_slug: string
    slug: string
  }
  tours: {
    t1_completed_at: string | Date
    t1_nb_dossiers: number
    t1_score: number
    t2_completed_at: string | Date
    t2_nb_dossiers: number
    t2_score: number
    delta_score: number
  }
  verification_code: string
}

export const ORGANISME = {
  nom_court: 'EROJU SAS — DENTALSCHOOL FORMATIONS',
  adresse: '76 BD MEUSNIER DE QUERLON, 44000 NANTES',
  tel: '07.84.56.01.06',
  email: 'info@dentalschool.fr',
  site: 'www.dentalschool.fr',
  siret: '95271921900018',
  ape: '8559A',
  capital: 'SASU au capital social de 1000€',
  ndpc: '9AGA',
  qualiopi: 'QUA006589',
  responsable: 'Dr Julie Fantin',
  ville: 'Nantes',
  comite_scientifique: 'Dr J. Fantin, Dr L. Elbeze, Dr A. Gaudin, Dr P. Bargman',
}

export const AXE_LABELS: Record<number, string> = {
  1: 'Axe 1 — Actualiser les connaissances et compétences',
  2: 'Axe 2 — Renforcer la qualité des pratiques',
  3: 'Axe 3 — Améliorer la relation avec les patients',
  4: 'Axe 4 — Mieux prendre en compte sa santé personnelle',
}

export const TYPE_CNP_BY_AXE: Record<number, string> = {
  1: 'D',  // Serious game
  2: 'B',  // EPP
  3: 'A',  // Formation labellisée
  4: 'A',
}
