import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

export function formatDate(iso: string): string {
  try {
    return format(new Date(iso), 'dd MMM yyyy', { locale: fr })
  } catch {
    return new Date(iso).toLocaleDateString('fr-FR')
  }
}

const RECENT_DAYS_THRESHOLD = 30

// Décrit la date à afficher pour une synthèse :
// - published_at non NULL  → "Publié en {mois yyyy}" si >30j, sinon "Publié le {DD MMM YYYY}"
// - published_at NULL      → fallback created_at, label "Synthèse du {DD MMM YYYY}"
export function describeCardDate(
  publishedAt: string | null,
  createdAt: string
): { label: string; fromPublication: boolean } {
  if (publishedAt) {
    const date = new Date(publishedAt)
    if (Number.isNaN(date.getTime())) {
      return { label: `Publié le ${formatDate(publishedAt)}`, fromPublication: true }
    }
    const ageDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)
    if (ageDays > RECENT_DAYS_THRESHOLD) {
      try {
        return {
          label: `Publié en ${format(date, 'MMMM yyyy', { locale: fr })}`,
          fromPublication: true,
        }
      } catch {
        return { label: `Publié en ${formatDate(publishedAt)}`, fromPublication: true }
      }
    }
    return { label: `Publié le ${formatDate(publishedAt)}`, fromPublication: true }
  }
  return { label: `Synthèse du ${formatDate(createdAt)}`, fromPublication: false }
}
