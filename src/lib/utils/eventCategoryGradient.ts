import type { CSSProperties } from 'react'
import { getCategoryConfig } from '@/lib/supabase/types'
import { AXE3_GRADIENT, AXE4_GRADIENT, isAxe3Category, isAxe4Category } from '@/lib/constants/eventCategories'

// Dégradé de carte événement selon sa thématique.
// - Axe 1 (clinique) : même dégradé par catégorie que les cartes formation
//   (getCategoryConfig, src/lib/supabase/types.ts).
// - Axe 3 / Axe 4 : un seul dégradé PARTAGÉ par axe (charte section 3),
//   pas un dégradé par catégorie — override volontaire de getCategoryConfig.
// Sans catégorie : undefined, pour laisser le composant appelant garder son
// rendu neutre actuel (pas de dégradé gris par défaut).
export function eventCategoryGradientStyle(category: string | null | undefined): CSSProperties | undefined {
  if (!category) return undefined

  if (isAxe3Category(category)) {
    return { background: `linear-gradient(135deg, ${AXE3_GRADIENT.from}, ${AXE3_GRADIENT.to})` }
  }
  if (isAxe4Category(category)) {
    return { background: `linear-gradient(135deg, ${AXE4_GRADIENT.from}, ${AXE4_GRADIENT.to})` }
  }

  const config = getCategoryConfig(category)
  return { background: `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})` }
}
