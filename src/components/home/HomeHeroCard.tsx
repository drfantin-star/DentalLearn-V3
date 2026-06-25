'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface HomeHeroCardProps {
  icon: ReactNode
  eyebrow: string
  title: string
  /** @deprecated ignore — sous-titre supprime du modele visuel */
  subtitle?: string
  surface: 'gradient' | 'neutral'
  gradient?: string
  /** @deprecated ignore — CTA uniformise sur toutes les tuiles */
  size?: 'md' | 'lg'
  /** Mode compact : hauteur reduite (120px), titre plus petit. Defaut false. */
  compact?: boolean
  /** Image de fond optionnelle (webp). Rendue sous le contenu avec un scrim sombre. */
  backgroundImage?: string
  cta: {
    label: string
    icon: ReactNode
    onClick: () => void
    disabled?: boolean
  }
  infoAction?: {
    onClick: () => void
    ariaLabel: string
  }
}

/**
 * Carte generique hero (Quiz / Classement / Journal / Evenements).
 * 3 zones : eyebrow haut | titre centre (flex-1) | CTA bas.
 * Icone decorative filigrane bas-droite.
 */
export function HomeHeroCard({
  icon,
  eyebrow,
  title,
  surface,
  gradient,
  compact = false,
  backgroundImage,
  cta,
  infoAction,
}: HomeHeroCardProps) {
  const isNeutral = surface === 'neutral'

  return (
    <div
      className={`relative flex flex-col min-w-0 rounded-2xl p-4 shadow-md overflow-hidden h-full ${compact ? 'min-h-[120px]' : 'min-h-[200px]'}`}
      style={
        isNeutral
          ? { background: '#1C1C1E', border: '0.5px solid rgba(255,255,255,0.08)' }
          : { background: gradient }
      }
    >
      {/* Image de fond optionnelle + scrim sombre pour lisibilite */}
      {backgroundImage && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt=""
            aria-hidden
            loading="lazy"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(0,0,0,0.48)',
            }}
          />
        </>
      )}

      {/* Icone decorative filigrane bas-droite */}
      <div
        className="absolute pointer-events-none"
        style={{
          bottom: '-4px',
          right: '-4px',
          opacity: 0.13,
          transform: compact ? 'scale(2.8)' : 'scale(3.8)',
          transformOrigin: 'bottom right',
        }}
      >
        {icon}
      </div>

      {/* Bouton info optionnel — haut-droite absolu */}
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

      {/* Contenu textuel — z-[1] pour s'afficher au-dessus de backgroundImage + scrim */}
      <div className="relative z-[1] flex flex-col flex-1">
        {/* Zone 1 : eyebrow en haut */}
        <p
          className={cn(
            'text-xs font-bold uppercase tracking-widest',
            isNeutral ? 'text-neutral-400' : 'text-white/70'
          )}
        >
          {eyebrow}
        </p>

        {/* Zone 2 : titre centre verticalement dans l'espace disponible */}
        <div className="flex flex-1 items-center">
          <h3
            className={cn(
              compact ? 'text-xl' : 'text-2xl',
              'font-semibold leading-tight',
              isNeutral ? 'text-neutral-100' : 'text-white'
            )}
          >
            {title}
          </h3>
        </div>

        {/* Zone 3 : CTA colle en bas */}
        <button
          type="button"
          onClick={cta.onClick}
          disabled={cta.disabled}
          className={cn(
            'w-full rounded-xl flex items-center justify-center gap-1.5 font-bold transition-colors py-3 text-sm',
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
    </div>
  )
}

export default HomeHeroCard
