import { CATEGORY_CONFIG } from '@/lib/supabase/types'

// Sous-ensemble de formations.category pertinent pour un événement/masterclass.
// `radiologie` exclue : dégradé marqué "à définir" dans PALETTE_COULEURS_CERTILY.md
// (section 1 + point de vigilance 7.3). Doit rester synchronisé avec la CHECK
// constraint de la migration 20260718d_events_category.sql.
export const EVENT_CATEGORY_VALUES = [
  'esthetique',
  'restauratrice',
  'chirurgie',
  'implant',
  'prothese',
  'parodontologie',
  'endodontie',
  'numerique',
  'communication',
  'consentement',
  'soft-skills',
] as const

export type EventCategory = (typeof EVENT_CATEGORY_VALUES)[number]

export const EVENT_CATEGORY_OPTIONS = EVENT_CATEGORY_VALUES.map((value) => ({
  value,
  label: CATEGORY_CONFIG[value].name,
}))
