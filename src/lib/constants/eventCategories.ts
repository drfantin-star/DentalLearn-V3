import { CATEGORY_CONFIG } from '@/lib/supabase/types'

// Sous-ensemble de formations.category pertinent pour un événement/masterclass,
// groupé par axe (docs/PALETTE_COULEURS_CERTILY.md sections 2-5) — ce
// groupement sert uniquement les <optgroup> du sélecteur admin, plus la
// couleur (voir eventCategoryGradient.ts : couleur = thème partout, y
// compris Axe 3/4, depuis le 18/07/2026). `radiologie` exclue : dégradé
// marqué "à définir" jusqu'au 18/07/2026, désormais défini mais pas encore
// ouvert aux événements. Doit rester synchronisé avec la CHECK constraint
// de la migration 20260718i_events_category_axe3_complete.sql.

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
