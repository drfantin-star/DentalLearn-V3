'use client'

import { motion } from 'framer-motion'

/**
 * Template "figures" : 1 à N chiffres clés en ligne avec label dessous.
 * Cf. spec POC §5.2. Stagger d'apparition 150ms entre items, le flag
 * `emphasis` ajoute couleur turquoise + pulse subtil infini.
 *
 * Le composant supporte N items via `flex-wrap`, mais la spec prévoit
 * 3 items maximum côté générateur LLM.
 */

export interface FigureItem {
  value: string
  label: string
  emphasis?: boolean
}

interface FiguresProps {
  figures: FigureItem[]
  className?: string
}

export function Figures({ figures, className }: FiguresProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 justify-center items-stretch sm:items-center ${className ?? ''}`}
    >
      {figures.map((item, index) => {
        const isEmphasis = !!item.emphasis
        const cardClass = isEmphasis
          ? 'bg-ds-turquoise/10 border-ds-turquoise/40'
          : 'bg-[color:var(--color-bg-card)] border-white/10'
        const valueClass = isEmphasis
          ? 'text-ds-turquoise'
          : 'text-[color:var(--color-text-primary)]'

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 4 }}
            animate={
              isEmphasis
                ? { opacity: 1, y: 0, scale: [1, 1.04, 1] }
                : { opacity: 1, y: 0 }
            }
            transition={
              isEmphasis
                ? {
                    opacity: {
                      duration: 0.25,
                      delay: index * 0.15,
                      ease: [0.4, 0, 0.2, 1],
                    },
                    y: {
                      duration: 0.25,
                      delay: index * 0.15,
                      ease: [0.4, 0, 0.2, 1],
                    },
                    scale: {
                      duration: 2.5,
                      delay: 0.4 + index * 0.15,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    },
                  }
                : {
                    duration: 0.25,
                    delay: index * 0.15,
                    ease: [0.4, 0, 0.2, 1],
                  }
            }
            className={`border rounded-lg p-4 min-w-[120px] text-center flex flex-col items-center justify-center ${cardClass}`}
          >
            <span
              className={`text-3xl md:text-4xl font-bold leading-none ${valueClass}`}
            >
              {item.value}
            </span>
            <span className="text-xs text-white/75 mt-1">
              {item.label}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
