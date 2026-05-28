import Link from 'next/link'
import { Library, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import {
  AXE_GRADIENTS,
  BIBLIOTHEQUE_DEFAULT_SUBTITLES,
} from '@/lib/constants/bibliotheque'

interface BibliothequeBannerProps {
  axe: 1 | 3 | 4 // détermine couleur d'accent + sous-titre par défaut
  title?: string // défaut : "Bibliothèque de ressources"
  subtitle?: string // défaut adapté à l'axe
  href: string // route de la page bibliothèque cible
  count?: number // optionnel : nb de ressources, affiché en pastille
  className?: string
}

/**
 * Bandeau cliquable « Bibliothèque de ressources », placé en haut de page,
 * au-dessus de la grille des thèmes/spécialités. Accent couleur dérivé de
 * l'axe (aligné sur le dégradé du header de page). Purement présentiel :
 * aucun state, aucun localStorage.
 */
export default function BibliothequeBanner({
  axe,
  title = 'Bibliothèque de ressources',
  subtitle,
  href,
  count,
  className,
}: BibliothequeBannerProps) {
  const gradient = AXE_GRADIENTS[axe]
  const resolvedSubtitle = subtitle ?? BIBLIOTHEQUE_DEFAULT_SUBTITLES[axe]

  return (
    <Link
      href={href}
      aria-label={`${title} — ${resolvedSubtitle}`}
      className={cn(
        'group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-white shadow-lg transition-transform',
        'hover:scale-[1.01] active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F0F]',
        className,
      )}
      style={{
        background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})`,
      }}
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Library size={22} className="text-white" aria-hidden="true" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h2 className="truncate text-base font-black leading-tight">{title}</h2>
          {typeof count === 'number' && count > 0 && (
            <span className="flex-shrink-0 rounded-full bg-white/25 px-2 py-0.5 text-[11px] font-bold">
              {count}
            </span>
          )}
        </div>
        <p className="mt-0.5 truncate text-xs font-semibold text-white/80">
          {resolvedSubtitle}
        </p>
      </div>

      <ChevronRight
        size={20}
        aria-hidden="true"
        className="flex-shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
      />
    </Link>
  )
}
