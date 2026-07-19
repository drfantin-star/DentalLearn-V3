import type { CSSProperties } from 'react'
import { getCategoryConfig } from '@/lib/supabase/types'

// Dégradé de carte événement selon sa thématique — même dégradé par
// catégorie que les cartes formation (getCategoryConfig, source unique
// getCategoryStyle). Doctrine "couleur = thème partout" (charte §0,
// décision 2'B) : plus d'override par axe pour Axe 3 / Axe 4 depuis le
// 18/07/2026 — l'ancienne règle "un seul dégradé par axe" est abrogée.
// Sans catégorie : undefined, pour laisser le composant appelant garder son
// rendu neutre actuel (pas de dégradé gris par défaut).
export function eventCategoryGradientStyle(category: string | null | undefined): CSSProperties | undefined {
  if (!category) return undefined

  const config = getCategoryConfig(category)
  return { background: `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})` }
}
