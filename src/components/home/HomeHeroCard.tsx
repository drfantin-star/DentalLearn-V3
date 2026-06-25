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
  /**
   * Image optionnelle affichee a DROITE de la carte (object-contain, non crognee).
   * Quand present : layout flex-row (texte gauche | image droite), icone decorative masquee.
   * Les cartes hero sans ce prop restent strictement inchangees.
   */
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
 * Sans backgroundImage : 3 zones flex-col (eyebrow | titre | CTA) + icone filigrane.
 * Avec backgroundImage : layout flex-row (texte gauche | image droite contenue).
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
  const minH = compact ? 'min-h-[120px]' : 'min-h-[200px]'
  const baseStyle = isNeutral
    ? { background: '#1C1C1E', border: '0.5px solid rgba(255,255,255,0.08)' }
    : { background: gradient }

  // ── Layout avec image a droite (Quiz / Journal quand backgroundImage est fourni) ──
  if (backgroundImage) {
    return (
      <div
        className={`relative flex flex-row min-w-0 rounded-2xl shadow-md overflow-hidden h-full ${minH}`}
        style={baseStyle}
      >
        {/* Bouton info optionnel — haut-droite absolu */}
        {infoAction && (
          <button
            type="button"
            onClick={infoAction.onClick}
            aria-label={infoAction.ariaLabel}
            className={cn(
              'absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full transition-colors z-10',
              isNeutral ? 'text-neutral-300 hover:bg-white/5' : 'text-white hover:bg-white/30'
            )}
            style={{ background: isNeutral ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.2)' }}
          >
            <Info size={15} />
          </button>
        )}

        {/* Gauche : eyebrow + titre + CTA */}
        <div className="relative z-[1] flex flex-col p-4" style={{ flex: '1 1 58%', minWidth: 0 }}>
          <p
            className={cn(
              'text-xs font-bold uppercase tracking-widest',
              isNeutral ? 'text-neutral-400' : 'text-white/70'
            )}
          >
            {eyebrow}
          </p>
          <div className="flex flex-1 items-center">
            <h3
              className={cn(
                compact ? 'text-lg' : 'text-2xl',
                'font-semibold leading-tight',
                isNeutral ? 'text-neutral-100' : 'text-white'
              )}
            >
              {title}
            </h3>
          </div>
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

        {/* Droite : objet flottant + halo pulse */}
        <div
          style={{
            flex: '0 0 42%',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '8px 8px 8px 0',
          }}
        >
          {/* Halo radial derive de la couleur de fond de la carte */}
          <div
            aria-hidden
            className="home-card-glow"
            style={{
              position: 'absolute',
              inset: 0,
              background: `radial-gradient(ellipse at center, ${gradient}55 0%, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={backgroundImage}
            alt=""
            aria-hidden
            loading="lazy"
            className="home-card-float"
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              objectPosition: 'center',
            }}
          />
        </div>
      </div>
    )
  }

  // ── Layout par defaut (STRICTEMENT INCHANGE pour les cartes sans backgroundImage) ──
  return (
    <div
      className={`relative flex flex-col min-w-0 rounded-2xl p-4 shadow-md overflow-hidden h-full ${minH}`}
      style={baseStyle}
    >
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

      {/* Contenu textuel — z-[1] pour s'afficher au-dessus des elements absolus */}
      <div className="relative z-[1] flex flex-col flex-1">
        <p
          className={cn(
            'text-xs font-bold uppercase tracking-widest',
            isNeutral ? 'text-neutral-400' : 'text-white/70'
          )}
        >
          {eyebrow}
        </p>
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
