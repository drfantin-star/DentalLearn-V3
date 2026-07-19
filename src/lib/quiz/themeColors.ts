// Palette d'ambiance par theme (specialite) du Quiz par theme.
// Derivee de getCategoryStyle (src/lib/design/categoryStyle.ts), source
// unique conforme a docs/PALETTE_COULEURS_CERTILY.md §2 — plus de hex tape
// ici depuis le chantier unification (18/07/2026).
import { getCategoryStyle, NEUTRAL_STYLE, NEWS_SPECIALITE_SLUGS } from '@/lib/design/categoryStyle'

export const THEME_QUIZ_COLORS: Record<string, { dark: string; light: string }> = Object.fromEntries(
  NEWS_SPECIALITE_SLUGS.map((slug) => {
    const style = getCategoryStyle(slug)
    return [slug, { dark: style.from, light: style.to }]
  })
)

// Fallback (theme inconnu) : neutre systeme, jamais les anciennes couleurs interdites.
export const THEME_QUIZ_FALLBACK = { dark: NEUTRAL_STYLE.from, light: NEUTRAL_STYLE.to }
