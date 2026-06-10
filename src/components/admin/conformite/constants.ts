// Constantes partagées par l'admin Conformité (panneau + modales de formulaire).
// Les valeurs correspondent aux CHECK constraints de cabinet_compliance_items
// (frequency, applies_when) — voir migration 20260609a_compliance_v22_schema.sql.

import type { SelectOption } from '@/components/ui/Select'

export const FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
  quarterly: 'Trimestriel',
  yearly: 'Annuel',
  multi_year: 'Pluriannuel',
  on_change: 'À chaque changement',
  once: 'Une fois',
}

// Libellé pour l'admin (la page user masque 'always' ; ici on l'affiche en clair).
export const APPLIES_WHEN_LABELS: Record<string, string> = {
  always: 'Toujours',
  xray: 'Si appareil RX',
  employer: 'Si ≥1 salarié',
  hds: 'Si données chez un tiers',
  prescriber: 'Si prescription',
  stupefiant_stock: 'Si stock de stupéfiants',
  dae: 'Si DAE présent',
}

export const FREQUENCY_OPTIONS: SelectOption[] = Object.entries(FREQUENCY_LABELS).map(
  ([value, label]) => ({ value, label }),
)

export const APPLIES_WHEN_OPTIONS: SelectOption[] = Object.entries(APPLIES_WHEN_LABELS).map(
  ([value, label]) => ({ value, label }),
)

// Noms d'icônes lucide valides côté page user (cf. CATEGORY_ICONS dans
// src/app/(app)/conformite/page.tsx). Un nom hors de cette liste retombe sur
// ShieldCheck. Dupliqué ici volontairement pour ne pas exporter depuis la page.
export const VALID_ICON_NAMES = [
  'radio',
  'thermometer',
  'trash-2',
  'shield',
  'lock',
  'accessibility',
  'activity',
  'monitor-smartphone',
  'file-text',
  'receipt',
  'users',
  'briefcase',
] as const

// Couleurs interdites par le brand kit (cf. CLAUDE.md).
export const FORBIDDEN_COLORS = ['#2d1b96', '#231575', '#00d1c1']

// Bucket public réutilisé pour les fiches PDF (déjà doté de policies admin).
export const FICHE_BUCKET = 'bibliotheque-publique'
export const MAX_PDF_SIZE = 10 * 1024 * 1024 // 10 MB

// Slug ASCII safe pour le nom de fichier Storage (aligné sur RessourceFormModal).
export function slugify(input: string): string {
  const s = input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || 'item'
}
