// Palette d'ambiance par theme (specialite) du Quiz par theme.
// SOURCE UNIQUE de ces hex : les composants lisent cette map, jamais de hex de
// couleur de theme ecrit en dur ailleurs. Paires { dark, light } alignees sur
// la palette Certily (PALETTE_COULEURS_CERTILY.md), validee le 07/07/2026.
export const THEME_QUIZ_COLORS: Record<string, { dark: string; light: string }> = {
  'dent-resto': { dark: '#F59E0B', light: '#FBBF24' },
  paro:         { dark: '#EC4899', light: '#F472B6' },
  'chir-orale': { dark: '#EF4444', light: '#F87171' },
  'sante-pub':  { dark: '#155E75', light: '#67E8F9' },
  implanto:     { dark: '#10B981', light: '#34D399' },
  proth:        { dark: '#F97316', light: '#FB923C' },
  odf:          { dark: '#8B5CF6', light: '#A78BFA' },
  pedo:         { dark: '#1E2A9A', light: '#3B4FD6' },
  gero:         { dark: '#A78BFA', light: '#C4B5FD' },
  'actu-pro':   { dark: '#0F7B6C', light: '#2DD4BF' },
  endo:         { dark: '#6366F1', light: '#818CF8' },
  occluso:      { dark: '#0F7B6C', light: '#2DD4BF' },
}

// Fallback (theme inconnu) : violet/teal Certily.
export const THEME_QUIZ_FALLBACK = { dark: '#2D1B96', light: '#00D1C1' }
