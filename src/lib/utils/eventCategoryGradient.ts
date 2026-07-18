import type { CSSProperties } from 'react'
import { getCategoryConfig } from '@/lib/supabase/types'

// Dégradé de carte événement selon sa thématique — même mapping que les
// cartes formation (getCategoryConfig). Sans catégorie : undefined, pour
// laisser le composant appelant garder son rendu neutre actuel (pas de
// dégradé gris par défaut).
export function eventCategoryGradientStyle(category: string | null | undefined): CSSProperties | undefined {
  if (!category) return undefined
  const config = getCategoryConfig(category)
  return { background: `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})` }
}
