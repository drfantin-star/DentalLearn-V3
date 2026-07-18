export type EppTourStatus =
  | 'not_started'
  | 't1_in_progress'
  | 't1_done_waiting_t2'
  | 't2_in_progress'
  | 'completed'

interface EppSessionLike {
  tour: number
  completed_at: string | null
}

/**
 * Source unique de dérivation du statut d'un audit EPP à partir de ses
 * sessions T1/T2. Ne gère pas le verrou de délai T2 (spécifique au flux
 * `epp/page.tsx`, cf. `getT2Status` local à cet écran).
 */
export function getEppTourStatus(sessions: EppSessionLike[]): EppTourStatus {
  const t1 = sessions.find(s => s.tour === 1)
  const t2 = sessions.find(s => s.tour === 2)

  if (t2?.completed_at) return 'completed'
  if (t2) return 't2_in_progress'
  if (t1?.completed_at) return 't1_done_waiting_t2'
  if (t1) return 't1_in_progress'
  return 'not_started'
}

export function getEppCtaLabel(status: EppTourStatus): string {
  switch (status) {
    case 'not_started':
      return "Commencer l'audit"
    case 't1_in_progress':
      return "Continuer l'audit"
    case 't1_done_waiting_t2':
      return 'Voir mon audit'
    case 't2_in_progress':
      return "Continuer l'audit"
    case 'completed':
      return 'Voir la comparaison'
  }
}

export function getEppStatusBadgeLabel(status: EppTourStatus): string {
  switch (status) {
    case 'not_started':
      return 'À commencer'
    case 't1_in_progress':
      return 'Tour 1 en cours'
    case 't1_done_waiting_t2':
      return 'Tour 1 terminé · Tour 2 en attente'
    case 't2_in_progress':
      return 'Tour 2 en cours'
    case 'completed':
      return 'Validée'
  }
}
