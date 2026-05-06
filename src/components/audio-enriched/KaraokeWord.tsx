'use client'

import { motion } from 'framer-motion'
import { memo } from 'react'

/**
 * Mot atomique du karaoké. Mémoïsé avec comparaison custom pour ne re-render
 * que si l'état (`isActive` / `isPast`) change. Le parent rend ~1600 instances
 * sur le pilote → la mémoïsation est critique.
 *
 * Le mot actif partage un `layoutId` framer-motion commun, ce qui produit une
 * transition fluide du surlignage d'un mot à l'autre (effet "highlight qui
 * glisse"). Coût : un seul `motion.span` actif à la fois dans tout l'arbre.
 */

interface KaraokeWordProps {
  text: string
  isActive: boolean
  isPast: boolean
  onClick?: () => void
}

function KaraokeWordBase({ text, isActive, isPast, onClick }: KaraokeWordProps) {
  const interactive = typeof onClick === 'function'

  // Ordre d'évaluation : actif > passé > futur. Un mot ne peut pas être actif
  // ET passé simultanément ; en cas d'incohérence on privilégie l'actif.
  const stateClasses = isActive
    ? 'font-bold text-white'
    : isPast
      ? 'text-[color:var(--color-text-primary)] opacity-100'
      : 'text-[color:var(--color-text-muted)] opacity-60'

  const baseClasses = `relative inline-block transition-colors ${interactive ? 'cursor-pointer' : ''} ${stateClasses}`

  return (
    <span
      className={baseClasses}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onClick?.()
              }
            }
          : undefined
      }
    >
      {isActive && (
        <motion.span
          layoutId="active-karaoke-word"
          className="absolute inset-0 -z-10 rounded bg-ds-turquoise/20"
          transition={{ type: 'spring', stiffness: 500, damping: 40 }}
        />
      )}
      <span className="relative px-0.5">{text}</span>{' '}
    </span>
  )
}

function areEqual(prev: KaraokeWordProps, next: KaraokeWordProps) {
  // `text` ne change jamais après le premier render (le mot est figé) ; on
  // pourrait l'omettre, mais on le check par sécurité. `onClick` change à
  // chaque render parent : on l'ignore pour ne pas casser la mémoïsation.
  return (
    prev.text === next.text &&
    prev.isActive === next.isActive &&
    prev.isPast === next.isPast
  )
}

export const KaraokeWord = memo(KaraokeWordBase, areEqual)
KaraokeWord.displayName = 'KaraokeWord'
