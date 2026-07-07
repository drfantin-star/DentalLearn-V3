'use client'

import { motion } from 'framer-motion'

import type { CardContent } from '@/lib/timeline/schema'

import { cardStateClass, isCardAccented } from './dynamic-highlight'

/**
 * Template "comparison" : 2 colonnes côte à côte (titre + cards), avec
 * divider central sur desktop. Cf. spec POC §5.2.
 *
 * Schéma T3 : `{ left: { title, cards }, right: { title, cards } }`. Plus
 * riche que la spec POC v1.0 (qui décrit `left: CardContent` simple) — on
 * rend le schéma T3 fidèlement.
 *
 * Animation : les 2 colonnes apparaissent simultanément (300ms), puis cards
 * staggerées (80ms) à l'intérieur de chaque colonne.
 */

interface ComparisonColumn {
  title: string
  cards: CardContent[]
}

interface ComparisonProps {
  left: ComparisonColumn
  right: ComparisonColumn
  /**
   * Déclencheur de surbrillance actif de la scène (relais 7B). L'ordre du
   * relais est GLOBAL à la scène (gauche + droite confondues) : la
   * résolution vit dans `StructuredWhiteboard`, les colonnes ne font que
   * comparer.
   */
  activeHighlightAt?: number | null
  className?: string
}

const NEUTRAL_CARD_CLASS =
  'bg-[color:var(--color-bg-card)] border-white/10 text-[color:var(--color-text-primary)]'

const BASE_CARD_CLASS =
  'border rounded-lg p-3 shadow-sm flex flex-col gap-1 transition-colors duration-300'

const COLUMN_DURATION = 0.3
const CARD_DURATION = 0.25
const CARD_STAGGER = 0.08
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

export function Comparison({
  left,
  right,
  activeHighlightAt,
  className,
}: ComparisonProps) {
  return (
    <div
      className={`relative grid grid-cols-1 md:grid-cols-2 gap-4 ${className ?? ''}`}
    >
      <Column column={left} side="left" activeHighlightAt={activeHighlightAt} />
      <Column column={right} side="right" activeHighlightAt={activeHighlightAt} />
      {/* Divider central, desktop only */}
      <div
        aria-hidden="true"
        className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-white/10"
      />
    </div>
  )
}

function Column({
  column,
  side,
  activeHighlightAt,
}: {
  column: ComparisonColumn
  side: 'left' | 'right'
  activeHighlightAt?: number | null
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: COLUMN_DURATION, ease: EASE }}
      className="flex flex-col"
      data-side={side}
    >
      <h4 className="text-[color:var(--color-text-primary)] text-[11px] uppercase tracking-wide font-semibold mb-2 text-center">
        {column.title}
      </h4>
      <div className="flex flex-col gap-2">
        {column.cards.map((card, index) => {
          const stateClass = cardStateClass(
            card,
            activeHighlightAt,
            NEUTRAL_CARD_CLASS
          )
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: CARD_DURATION,
                delay: index * CARD_STAGGER,
                ease: EASE,
              }}
              className={`${BASE_CARD_CLASS} ${stateClass}`}
            >
              <p className="text-sm font-medium leading-tight">{card.text}</p>
              {card.subtitle && (
                <p
                  className={
                    isCardAccented(card, activeHighlightAt)
                      ? 'text-xs opacity-80'
                      : 'text-xs text-white/75'
                  }
                >
                  {card.subtitle}
                </p>
              )}
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}
