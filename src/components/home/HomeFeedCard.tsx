'use client'

import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

type AccentVariant = 'teal' | 'violet' | 'amber'

const ACCENT: Record<AccentVariant, { halo: string; ringClass: string; eyebrowClass: string }> = {
  teal:   { halo: 'rgba(0,209,193,0.38)',   ringClass: 'ring-accent',      eyebrowClass: 'text-accent' },
  violet: { halo: 'rgba(124,58,237,0.38)',  ringClass: 'ring-quiz-accent', eyebrowClass: 'text-quiz-accent' },
  amber:  { halo: 'rgba(245,158,11,0.38)',  ringClass: 'ring-axe3',        eyebrowClass: 'text-axe3' },
}

interface HomeFeedCardProps {
  eyebrow: string
  title: string
  accent: AccentVariant
  icon: ReactNode
  onClick: () => void
  ariaLabel: string
  infoAction?: { onClick: () => void; ariaLabel: string }
  disabled?: boolean
}

export function HomeFeedCard({
  eyebrow,
  title,
  accent,
  icon,
  onClick,
  ariaLabel,
  infoAction,
  disabled = false,
}: HomeFeedCardProps) {
  const { halo, ringClass, eyebrowClass } = ACCENT[accent]

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (!disabled) onClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'relative flex flex-row items-center gap-4 min-w-0 rounded-2xl p-4 shadow-md overflow-hidden',
        'min-h-[112px] h-full select-none',
        'transition-transform duration-150 active:scale-[0.985]',
        disabled ? 'cursor-default opacity-60' : 'cursor-pointer'
      )}
      style={{
        background: '#1C1C1E',
        border: '0.5px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
      }}
    >
      {/* Bouton info secondaire — haut-droite */}
      {infoAction && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); infoAction.onClick() }}
          aria-label={infoAction.ariaLabel}
          className="absolute top-3 right-3 flex items-center justify-center w-8 h-8 rounded-full text-neutral-300 hover:bg-white/5 z-10"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          <Info size={15} />
        </button>
      )}

      {/* Gauche : eyebrow + titre */}
      <div className="flex flex-col gap-1 flex-1 min-w-0 pr-2">
        <p className={cn('text-xs font-bold uppercase tracking-widest', eyebrowClass)}>
          {eyebrow}
        </p>
        <h3 className="text-xl font-bold leading-tight text-white">
          {title}
        </h3>
      </div>

      {/* Droite : icone ronde 104px avec halo + anneau accent */}
      <div className="relative flex-shrink-0" style={{ width: 104, height: 104 }}>
        {/* Halo diffus */}
        <div
          aria-hidden
          className="absolute inset-0 rounded-full blur-xl pointer-events-none"
          style={{ background: halo, transform: 'scale(1.15)' }}
        />
        {/* Conteneur icone : anneau + clip rond */}
        <div
          className={cn(
            'relative w-full h-full rounded-full overflow-hidden ring-2',
            ringClass
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  )
}
