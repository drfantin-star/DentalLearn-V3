'use client'

import { memo } from 'react'

/**
 * Mot atomique du karaoké. Mémoïsé avec comparaison custom pour ne re-render
 * que si l'état (`isActive` / `isPast`) ou la cible de seek change. Le parent
 * rend ~1600 instances sur le pilote → la mémoïsation est critique.
 *
 * Le mot reçoit `startSec` + `onSeek` plutôt qu'un `onClick` pré-construit.
 * Cela permet au parent de stabiliser `onSeek` une seule fois (useCallback)
 * et au composant memo de comparer des valeurs stables, garantissant que le
 * handler effectivement attaché au DOM reste à jour.
 *
 * Surlignage du mot actif : `bg-ds-turquoise/20` directement sur le span,
 * sans overlay absolu ni `layoutId` framer-motion. La transition entre mots
 * se fait via `transition-colors` (fade des couleurs). Cette approche est
 * plus robuste que l'overlay `-z-10` qui pouvait s'échapper du stacking
 * context du parent et passer sous le fond de la page.
 */

interface KaraokeWordProps {
  text: string
  isActive: boolean
  isPast: boolean
  startSec: number
  onSeek?: (sec: number) => void
}

function KaraokeWordBase({
  text,
  isActive,
  isPast,
  startSec,
  onSeek,
}: KaraokeWordProps) {
  const interactive = typeof onSeek === 'function'

  // Ordre d'évaluation : actif > passé > futur. Un mot ne peut pas être actif
  // ET passé simultanément ; en cas d'incohérence on privilégie l'actif.
  const stateClasses = isActive
    ? 'bg-ds-turquoise/20 font-bold text-white'
    : isPast
      ? 'text-[color:var(--color-text-primary)] opacity-100'
      : 'text-[color:var(--color-text-muted)] opacity-60'

  const baseClasses = `inline-block rounded px-0.5 transition-colors ${interactive ? 'cursor-pointer' : ''} ${stateClasses}`

  const handleClick = interactive ? () => onSeek!(startSec) : undefined

  return (
    <>
      <span
        className={baseClasses}
        onClick={handleClick}
        role={interactive ? 'button' : undefined}
        tabIndex={interactive ? 0 : undefined}
        onKeyDown={
          interactive
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onSeek!(startSec)
                }
              }
            : undefined
        }
      >
        {text}
      </span>{' '}
    </>
  )
}

function areEqual(prev: KaraokeWordProps, next: KaraokeWordProps) {
  return (
    prev.text === next.text &&
    prev.isActive === next.isActive &&
    prev.isPast === next.isPast &&
    prev.startSec === next.startSec &&
    prev.onSeek === next.onSeek
  )
}

export const KaraokeWord = memo(KaraokeWordBase, areEqual)
KaraokeWord.displayName = 'KaraokeWord'
