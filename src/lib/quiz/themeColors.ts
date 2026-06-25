// Palette d'ambiance par theme (specialite) du Quiz par theme.
// SOURCE UNIQUE de ces hex : les composants lisent cette map, jamais de hex de
// couleur de theme ecrit en dur ailleurs. Paire { dark, light } validee Julie (25/06).
export const THEME_QUIZ_COLORS: Record<string, { dark: string; light: string }> = {
  'dent-resto': { dark: '#0F766E', light: '#2DD4BF' },
  paro:         { dark: '#7C3AED', light: '#A78BFA' },
  'chir-orale': { dark: '#1D4ED8', light: '#60A5FA' },
  'sante-pub':  { dark: '#0E7490', light: '#22D3EE' },
  implanto:     { dark: '#065F46', light: '#10B981' },
  proth:        { dark: '#0E7490', light: '#22D3EE' },
  odf:          { dark: '#0E7490', light: '#22D3EE' },
  pedo:         { dark: '#0E7490', light: '#22D3EE' },
  gero:         { dark: '#0E7490', light: '#22D3EE' },
  'actu-pro':   { dark: '#F59E0B', light: '#FCD34D' },
  endo:         { dark: '#134E4A', light: '#14B8A6' },
  occluso:      { dark: '#8B5CF6', light: '#A78BFA' },
}

// Fallback (theme inconnu) : violet/teal Certily.
export const THEME_QUIZ_FALLBACK = { dark: '#2D1B96', light: '#00D1C1' }
