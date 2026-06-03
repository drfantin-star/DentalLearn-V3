'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface HomeHeroCardProps {
  icon: ReactNode
  eyebrow: string
  title: string
  subtitle: string
  surface: 'gradient' | 'neutral'
  /** Valeur CSS du gradient (ex. "linear-gradient(160deg,#2D1B96,#8B5CF6)"), surface 'gradient' uniquement. */
  gradient?: string
  /**
   * Échelle typographique. `md` (défaut) = rendu standard (Journal, Événements).
   * `lg` = texte d'un cran au-dessus + pastille icône plus grande, pour une
   * carte qui occupe plus de place (ex. Quiz du jour en pleine largeur mobile).
   */
  size?: 'md' | 'lg'
  cta: {
    label: string
    icon: ReactNode
    onClick: () => void
    /** État verrouillé/terminé : CTA non cliquable (ex. quiz du jour déjà fait). */
    disabled?: boolean
  }
  /** Bouton ℹ️ secondaire en haut à droite (ex. détails du Journal). Distinct du CTA. */
  infoAction?: {
    onClick: () => void
    ariaLabel: string
  }
}

/**
 * Carte générique de la 1ʳᵉ ligne de l'accueil (Quiz / Journal / Événements).
 * Anatomie commune : pastille icône 52px → surtitre → titre → sous-titre →
 * spacer → CTA pleine largeur collé en bas. Hauteur égale via `flex-1` +
 * spacer (le parent doit utiliser `items-stretch`, comportement flex par défaut).
 *
 * La carte n'est PAS cliquable globalement : seule l'action passe par le bouton CTA.
 */
export function HomeHeroCard({
  icon,
  eyebrow,
  title,
  subtitle,
  surface,
  gradient,
  size = 'md',
  cta,
  infoAction,
}: HomeHeroCardProps) {
  const isNeutral = surface === 'neutral'
  const lg = size === 'lg'
  const iconBox = lg ? '60px' : '52px'

  return (
    <div
      className="flex flex-1 flex-col min-w-0 min-h-[180px] rounded-2xl p-4 shadow-md"
      style={
        isNeutral
          ? { background: '#1C1C1E', border: '0.5px solid rgba(255,255,255,0.08)' }
          : { background: gradient }
      }
    >
      {/* Ligne du haut : pastille icône 52px + bouton ℹ️ optionnel à droite */}
      <div className="flex items-start justify-between">
        <div
          className={cn(
            'flex items-center justify-center rounded-2xl',
            isNeutral ? 'text-neutral-200' : 'text-white'
          )}
          style={{
            width: iconBox,
            height: iconBox,
            background: isNeutral ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.2)',
          }}
        >
          {icon}
        </div>

        {infoAction && (
          <button
            type="button"
            onClick={infoAction.onClick}
            aria-label={infoAction.ariaLabel}
            className={cn(
              'flex items-center justify-center w-8 h-8 rounded-full transition-colors',
              isNeutral
                ? 'text-neutral-300 hover:bg-white/5'
                : 'text-white hover:bg-white/30'
            )}
            style={{ background: isNeutral ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.2)' }}
          >
            <Info size={15} />
          </button>
        )}
      </div>

      <p
        className={cn(
          'mt-3 font-bold uppercase tracking-wide',
          lg ? 'text-xs' : 'text-[11px]',
          isNeutral ? 'text-neutral-400' : 'text-white/80'
        )}
      >
        {eyebrow}
      </p>
      <h3
        className={cn(
          'mt-1 font-bold leading-tight line-clamp-2',
          lg ? 'text-lg' : 'text-base',
          isNeutral ? 'text-neutral-100' : 'text-white'
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          'mt-0.5 line-clamp-1',
          lg ? 'text-sm' : 'text-xs',
          isNeutral ? 'text-neutral-400' : 'text-white/80'
        )}
      >
        {subtitle}
      </p>

      {/* Spacer : pousse le CTA en bas → hauteur égale entre cartes */}
      <div className="flex-1" />

      <button
        type="button"
        onClick={cta.onClick}
        disabled={cta.disabled}
        className={cn(
          'mt-3 w-full rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors',
          lg ? 'py-3 text-base' : 'py-2.5 text-sm',
          isNeutral
            ? 'border border-white/15 text-neutral-100 hover:bg-white/5 active:bg-white/10'
            : 'bg-white/20 text-white hover:bg-white/30 active:bg-white/40',
          cta.disabled && 'opacity-60 cursor-not-allowed hover:bg-white/20 active:bg-white/20'
        )}
      >
        {cta.icon}
        {cta.label}
      </button>
    </div>
  )
}

export default HomeHeroCard
