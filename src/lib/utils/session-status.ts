export type SessionStatus = 'scheduled' | 'live' | 'ended' | 'cancelled'

interface SessionForStatus {
  starts_at: string
  duration_min: number
  status: string
}

export function computeSessionStatus(session: SessionForStatus): SessionStatus {
  if (session.status === 'cancelled') return 'cancelled'
  const now = Date.now()
  const start = new Date(session.starts_at).getTime()
  const end = start + session.duration_min * 60_000
  if (now < start) return 'scheduled'
  if (now < end) return 'live'
  return 'ended'
}

export function computeSessionStatusLabel(session: SessionForStatus): string {
  const s = computeSessionStatus(session)
  switch (s) {
    case 'scheduled': return 'À venir'
    case 'live': return 'En cours 🔴'
    case 'ended': return 'Terminée'
    case 'cancelled': return 'Annulée'
  }
}

// Retourne true dans la fenêtre [starts_at - 15min, starts_at + duration_min[
// quand l'user est inscrit et la session n'est pas annulée.
// Note : peut être true avec status='scheduled' (les 15 dernières minutes avant le début).
// Ce comportement est voulu : badge "À venir" + bouton "Rejoindre" peuvent coexister.
export function computeCanJoin(
  session: SessionForStatus,
  userIsRegistered: boolean
): boolean {
  if (!userIsRegistered || session.status === 'cancelled') return false
  const now = Date.now()
  const start = new Date(session.starts_at).getTime()
  const end = start + session.duration_min * 60_000
  return now >= start - 15 * 60_000 && now < end
}
