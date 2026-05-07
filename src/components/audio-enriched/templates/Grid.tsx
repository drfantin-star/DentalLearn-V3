'use client'

import { motion } from 'framer-motion'

import type { CardContent, CardVariant } from '@/lib/timeline/schema'

/**
 * Template "grid" : N cards en grille (2/3/4 colonnes), stagger d'apparition
 * 100ms entre cards. Cf. spec POC §5.2.
 *
 * Tokens design : voir mapping projet (T4.1) — fond `--color-bg-card`, variant
 * highlight en `ds-turquoise`, warning en `axe3` (orange), success en emerald.
 */

interface GridProps {
  cards: CardContent[]
  /** Nombre de colonnes — limité à 2/3/4 cf. spec. */
  columns: 2 | 3 | 4
  className?: string
}

// Mapping explicite (pas d'interpolation `grid-cols-${n}`) pour que le purge
// JIT Tailwind détecte les classes statiquement.
//
// Responsive (T4.2 §6.1) : on stack/réduit en mobile pour rester lisible
// côté T7/T8 user-side.
const COLS_CLASS: Record<2 | 3 | 4, string> = {
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  highlight:
    'bg-ds-turquoise/15 border-ds-turquoise/40 text-ds-turquoise',
  warning:
    'bg-axe3/15 border-axe3/40 text-axe3',
  success:
    'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
}

const BASE_CARD_CLASS =
  'border rounded-lg p-3 shadow-sm flex flex-col gap-1'
const NEUTRAL_CARD_CLASS =
  'bg-[color:var(--color-bg-card)] border-white/10 text-[color:var(--color-text-primary)]'

export function Grid({ cards, columns, className }: GridProps) {
  return (
    <div className={`grid ${COLS_CLASS[columns]} gap-3 ${className ?? ''}`}>
      {cards.map((card, index) => {
        const variantClass = card.variant
          ? VARIANT_CLASS[card.variant]
          : NEUTRAL_CARD_CLASS

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.25,
              delay: index * 0.1,
              ease: [0.4, 0, 0.2, 1],
            }}
            className={`${BASE_CARD_CLASS} ${variantClass}`}
          >
            <p className="text-sm font-medium leading-tight">{card.text}</p>
            {card.subtitle && (
              <p
                className={
                  card.variant
                    ? 'text-xs opacity-80'
                    : 'text-xs text-[color:var(--color-text-secondary)]'
                }
              >
                {card.subtitle}
              </p>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
