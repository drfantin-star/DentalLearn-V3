// Forme normalisée d'une carte du feed « Pour vous » (cf. RECAP audit Phase 0-bis).
// Une seule carte visuelle générique (`ForYouCard`) est pilotée par `type`.
export type ForYouType =
  | 'formation'
  | 'epp'
  | 'autoeval'
  | 'fiche'
  | 'news'
  | 'conformite'

export interface ForYouItem {
  id: string
  type: ForYouType
  title: string
  href: string
  axe: 1 | 2 | 3 | 4 | null
  category: string | null
  cover?: string | null
  estMinutes?: number | null
  publishedAt?: string | null
  // Microcopy UX « Parce que… ». null = pas de raison affichée.
  matchReason?: string | null
}
