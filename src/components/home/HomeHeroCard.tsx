'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface HomeHeroCardProps {
  icon: ReactNode
  eyebrow: string
  title: string
  /** @deprecated ignoré — sous-titre supprimé du nouveau modèle visuel */
  subtitle?: string
  surface: 'gradient' | 'neutral'
  /** Valeur CSS du gradient (ex. "linear-gradient(160deg,#5B21B6,#8B5CF6)"), surface 'gradient' uniquement. */
  gradient?: string
  /** @deprecated ignoré — le CTA est uniformisé sur toutes les tuiles */
  size?: 'md' | 'lg'
  cta: {
    label: string
    icon: ReactNode
    onClick: () => void
    /** État verrouillé/terminé : CTA non cliquable (ex. quiz du jour déjà fait). */
    disabled?: boolean
  }
  /** Bouton ℹ️ secondaire (ex. détails du Journal). */
  infoAction?: {
    onClick: () => void
    ariaLabel: string
  }
}

/**
 * Carte générique de la 1ʳᵉ ligne de l'accueil (Quiz / Classement / Journal / Événements).
 * Modèle unifié : grande icône décorative en filigrane bas-droite → eyebrow majuscule →
 * titre pleine largeur → spacer → CTA pleine largeur collé en bas.
 * Toutes les tuiles atteignent la même hauteur via grid-auto-rows:1fr sur la grille parent.
 */
export function HomeHeroCard({
  icon,
  eyebrow,
  title,
  surface,
  gradient,
  cta,
  infoAction,
}: HomeHeroCardProps) {
  const isNeutral = surface === 'neutral'

  return (
    <div
      className="relative flex flex-col min-w-0 min-h-[200px] rounded-2xl p-4 shadow-md overflow-hidden h-full"
      style={
        isNeutral
          ? { background: '#1C1C1E', border: '0.5px solid rgba(255,255,255,0.08)' }
          : { background: gradient }
      }
    >
      {/* Icône décorative de fond — filigrane bas-droite */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-4px',
          right: '-4px',
          opacity: 0.13,
          transform: 'scale(3.8)',
          transformOrigin: 'bottom right',
        }}
      >
        {icon}
      </div>

      {/* Bouton ℹ️ optionnel — haut-droite absolu */}
      {infoAction && (
        <button
          type="button"
          onClick={infoAction.onClick}
          aria-label={infoAction.ariaLabel}
          className={cn(
            'absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full transition-colors z-10',
            isNeutral
              ? 'text-neutral-300 hover:bg-white/5'
              : 'text-white hover:bg-white/30'
          )}
          style={{ background: isNeutral ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.2)' }}
        >
          <Info size={15} />
        </button>
      )}

      <p
        className={cn(
          'mt-2 font-bold uppercase tracking-wide text-[11px]',
          isNeutral ? 'text-neutral-400' : 'text-white/80'
        )}
      >
        {eyebrow}
      </p>
      <h3
        className={cn(
          'mt-1 font-bold leading-tight text-base',
          isNeutral ? 'text-neutral-100' : 'text-white'
        )}
      >
        {title}
      </h3>

      {/* Spacer : pousse le CTA en bas */}
      <div className="flex-1" />

      <button
        type="button"
        onClick={cta.onClick}
        disabled={cta.disabled}
        className={cn(
          'mt-3 w-full rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors py-3 text-sm',
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
