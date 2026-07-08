'use client'

import { motion } from 'framer-motion'

import { isItemLit } from './dynamic-highlight'

/**
 * Template "figures" : 1 à N chiffres clés en ligne avec label dessous.
 * Cf. spec POC §5.2. Stagger d'apparition 150ms entre items.
 *
 * Décisions 4A + 8B (Lot 2 + correctif, juillet 2026) :
 *  - Lecteur formation (défaut, `staticVariantsEnabled` absent) : le flag
 *    statique `emphasis` n'est PLUS rendu (champ conservé dans les données)
 *    et le pulse infini disparaît avec lui. La mise en avant est dynamique,
 *    calée sur l'audio : l'item dont `highlight_at_sec` est le déclencheur
 *    actif de la scène passe en teal token, transition douce, aucun pulse.
 *  - Chemin news (`staticVariantsEnabled: true`, timelines non enrichies) :
 *    rendu statique historique conservé — `emphasis` = turquoise + pulse
 *    subtil infini, à l'identique du comportement pré-Lot 2.
 *
 * Le composant supporte N items via `flex-wrap`, mais la spec prévoit
 * 3 items maximum côté générateur LLM.
 */

export interface FigureItem {
  value: string
  label: string
  /** Rendu uniquement quand `staticVariantsEnabled` (8B, news). */
  emphasis?: boolean
  highlight_at_sec?: number
  highlight_end_sec?: number
}

interface FiguresProps {
  figures: FigureItem[]
  /** Déclencheur de surbrillance actif de la scène (null = rien d'allumé). */
  activeHighlightAt?: number | null
  /** 8B : rendu statique legacy (emphasis + pulse) — chemin news uniquement. */
  staticVariantsEnabled?: boolean
  className?: string
}

export function Figures({
  figures,
  activeHighlightAt,
  staticVariantsEnabled,
  className,
}: FiguresProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 justify-center items-stretch sm:items-center ${className ?? ''}`}
    >
      {figures.map((item, index) => {
        const lit = isItemLit(item, activeHighlightAt)
        const staticEmphasis = !!staticVariantsEnabled && !!item.emphasis
        const accented = lit || staticEmphasis
        const cardClass = accented
          ? 'bg-ds-turquoise/10 border-ds-turquoise/40'
          : 'bg-[color:var(--color-bg-card)] border-white/10'
        const valueClass = accented
          ? 'text-ds-turquoise'
          : 'text-[color:var(--color-text-primary)]'

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 4 }}
            animate={
              staticEmphasis
                ? { opacity: 1, y: 0, scale: [1, 1.04, 1] }
                : { opacity: 1, y: 0 }
            }
            transition={
              staticEmphasis
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
            className={`border rounded-lg p-4 min-w-[120px] text-center flex flex-col items-center justify-center transition-colors duration-300 ${cardClass}`}
          >
            <span
              className={`text-3xl md:text-4xl font-bold leading-none transition-colors duration-300 ${valueClass}`}
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
