import { CATEGORY_CONFIG } from '@/lib/supabase/types'

// Sous-ensemble de formations.category pertinent pour un événement/masterclass,
// groupé par axe (PALETTE_COULEURS_CERTILY.md section 1-4). `radiologie`
// exclue : dégradé marqué "à définir" (section 1 + point de vigilance 7.3).
// Doit rester synchronisé avec la CHECK constraint de la migration
// 20260718g_events_category_axe3_axe4.sql.

const AXE1_VALUES = [
  'esthetique',
  'restauratrice',
  'chirurgie',
  'implant',
  'prothese',
  'parodontologie',
  'endodontie',
  'numerique',
] as const

// Axe 3 : toutes les catégories partagent le MÊME dégradé orange (charte
// section 3 — "un seul dégradé par axe", pas un dégradé par catégorie comme
// pour l'axe 1). Pareil pour l'axe 4 (rose/violet).
const AXE3_VALUES = [
  'communication',
  'consentement',
  'conflits',
  'decision-partagee',
  'annonce-diagnostic',
  'education-therapeutique',
  'ethique-deontologie',
  'numerique-relation',
] as const
const AXE4_VALUES = ['ergonomie', 'stress-burnout', 'risques-pro', 'violences', 'pratique-reflexive'] as const
const TRANSVERSE_VALUES = ['soft-skills'] as const

export const EVENT_CATEGORY_VALUES = [
  ...AXE1_VALUES,
  ...AXE3_VALUES,
  ...AXE4_VALUES,
  ...TRANSVERSE_VALUES,
] as const

export type EventCategory = (typeof EVENT_CATEGORY_VALUES)[number]

// Dégradés partagés par axe (charte section 3), via constantes nommées
// plutôt que du hex éparpillé dans les composants.
export const AXE3_GRADIENT = { from: '#F97316', to: '#FBBF24' }
export const AXE4_GRADIENT = { from: '#EC4899', to: '#A78BFA' }

export function isAxe3Category(category: string): boolean {
  return (AXE3_VALUES as readonly string[]).includes(category)
}

export function isAxe4Category(category: string): boolean {
  return (AXE4_VALUES as readonly string[]).includes(category)
}

function toOption(value: EventCategory) {
  return { value, label: CATEGORY_CONFIG[value].name }
}

// Groupes pour les sélecteurs (<optgroup>), libellés imposés par le ticket.
export const EVENT_CATEGORY_GROUPS: { label: string; options: { value: EventCategory; label: string }[] }[] = [
  { label: 'Axe 1 — Clinique', options: AXE1_VALUES.map(toOption) },
  { label: 'Axe 3 — Relation patient', options: AXE3_VALUES.map(toOption) },
  { label: 'Axe 4 — Santé praticien', options: AXE4_VALUES.map(toOption) },
  { label: 'Transverse', options: TRANSVERSE_VALUES.map(toOption) },
]

export const EVENT_CATEGORY_OPTIONS = EVENT_CATEGORY_VALUES.map(toOption)

const EVENT_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EVENT_CATEGORY_OPTIONS.map((opt) => [opt.value, opt.label])
)

// Libellé FR pour une valeur du référentiel ; renvoie la valeur brute si
// absente (ex : ancien tag formateur en saisie libre, pré-référentiel).
export function getEventCategoryLabel(value: string): string {
  return EVENT_CATEGORY_LABELS[value] ?? value
}
