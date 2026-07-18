import { getCategoryConfig } from '@/lib/supabase/types'
import { eventCategoryGradientStyle } from '@/lib/utils/eventCategoryGradient'

interface CategoryBadgeProps {
  category: string | null | undefined
}

// Pastille thématique — même dégradé que les cartes formation (axe 1) ou
// que le dégradé partagé de l'axe (axe 3 / axe 4), en badge compact pour
// les listes formateur/admin (denses en badges/boutons : un dégradé plein
// sur toute la carte nuirait à la lisibilité des contrôles).
export default function CategoryBadge({ category }: CategoryBadgeProps) {
  if (!category) return null
  const config = getCategoryConfig(category)
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full text-white"
      style={eventCategoryGradientStyle(category)}
    >
      {config.emoji} {config.shortName}
    </span>
  )
}
