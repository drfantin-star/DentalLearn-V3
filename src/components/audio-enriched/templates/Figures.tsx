'use client'

import { motion } from 'framer-motion'

import { isItemLit } from './dynamic-highlight'

/**
 * Template "figures" : 1 à N chiffres clés en ligne avec label dessous.
 * Cf. spec POC §5.2. Stagger d'apparition 150ms entre items.
 *
 * Décision 4A (Lot 2, juillet 2026) : le flag statique `emphasis` n'est PLUS
 * rendu (champ conservé dans les données, ignoré au rendu — même sort que le
 * variant `highlight`, et le pulse infini disparaît avec lui). La mise en
 * avant est désormais dynamique, calée sur l'audio : l'item dont
 * `highlight_at_sec` est le déclencheur actif de la scène passe en teal
 * token, transition douce, aucun pulse.
 *
 * Le composant supporte N items via `flex-wrap`, mais la spec prévoit
 * 3 items maximum côté générateur LLM.
 */

export interface FigureItem {
  value: string
  label: string
  /** Conservé dans les payloads, ignoré au rendu depuis 4A. */
  emphasis?: boolean
  highlight_at_sec?: number
  highlight_end_sec?: number
}

interface FiguresProps {
  figures: FigureItem[]
  /** Déclencheur de surbrillance actif de la scène (null = rien d'allumé). */
  activeHighlightAt?: number | null
  className?: string
}

export function Figures({ figures, activeHighlightAt, className }: FiguresProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:flex-wrap gap-3 sm:gap-4 justify-center items-stretch sm:items-center ${className ?? ''}`}
    >
      {figures.map((item, index) => {
        const lit = isItemLit(item, activeHighlightAt)
        const cardClass = lit
          ? 'bg-ds-turquoise/10 border-ds-turquoise/40'
          : 'bg-[color:var(--color-bg-card)] border-white/10'
        const valueClass = lit
          ? 'text-ds-turquoise'
          : 'text-[color:var(--color-text-primary)]'

        return (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.25,
              delay: index * 0.15,
              ease: [0.4, 0, 0.2, 1],
            }}
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
