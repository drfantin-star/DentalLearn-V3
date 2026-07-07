'use client'

import { motion } from 'framer-motion'
import { Fragment } from 'react'

import type { CardContent } from '@/lib/timeline/schema'

import { cardStateClass, isCardAccented } from './dynamic-highlight'

/**
 * Template "flowchart" : suite ordonnée de cards reliées par des flèches
 * (horizontal par défaut, vertical en option). Cf. spec POC §5.2.
 *
 * Responsive (T4.2 §6.3) : en mobile (< md), même quand `orientation` est
 * 'horizontal', on bascule automatiquement en layout vertical (flèches
 * verticales) — la frise horizontale est illisible sur 375-430px côté
 * T7/T8 user-side. `orientation: 'vertical'` reste toujours vertical.
 *
 * Animation : cascade card → flèche → card → flèche, stagger 100ms.
 * Tokens design alignés sur Grid (T4.1) — état des cards partagé via
 * `dynamic-highlight.ts` (2A : variant statique `highlight` plus rendu,
 * surbrillance dynamique via `activeHighlightAt`).
 */

interface FlowchartProps {
  cards: CardContent[]
  /** Direction du flowchart. Défaut 'horizontal'. */
  orientation?: 'horizontal' | 'vertical'
  /** Déclencheur de surbrillance actif de la scène (null = rien d'allumé). */
  activeHighlightAt?: number | null
  className?: string
}

const NEUTRAL_CARD_CLASS =
  'bg-[color:var(--color-bg-card)] border-white/10 text-[color:var(--color-text-primary)]'

const BASE_CARD_CLASS =
  'border rounded-lg p-3 shadow-sm flex flex-col gap-1 min-w-[140px] max-w-[200px] transition-colors duration-300'

const STEP_DELAY = 0.1
const CARD_DURATION = 0.25
const ARROW_DURATION = 0.2
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

const ARROW_COLOR = '#888780'

export function Flowchart({
  cards,
  orientation = 'horizontal',
  activeHighlightAt,
  className,
}: FlowchartProps) {
  const isForcedVertical = orientation === 'vertical'

  // 'vertical' : toujours vertical (mobile + desktop).
  // 'horizontal' : vertical en mobile, horizontal en md+.
  const containerClass = isForcedVertical
    ? 'flex flex-col items-center gap-3'
    : 'flex flex-col items-center gap-3 md:flex-row md:items-stretch md:flex-wrap md:justify-center'

  return (
    <div className={`${containerClass} ${className ?? ''}`}>
      {cards.map((card, index) => {
        const cardStepIndex = index * 2
        const arrowStepIndex = cardStepIndex + 1
        const stateClass = cardStateClass(
          card,
          activeHighlightAt,
          NEUTRAL_CARD_CLASS
        )

        return (
          <Fragment key={index}>
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: CARD_DURATION,
                delay: cardStepIndex * STEP_DELAY,
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

            {index < cards.length - 1 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: ARROW_DURATION,
                  delay: arrowStepIndex * STEP_DELAY,
                  ease: EASE,
                }}
                className="flex items-center justify-center"
                aria-hidden="true"
              >
                {isForcedVertical ? (
                  <FlowchartArrow vertical />
                ) : (
                  <>
                    {/* Mobile : flèche verticale ; md+ : flèche horizontale */}
                    <span className="md:hidden">
                      <FlowchartArrow vertical />
                    </span>
                    <span className="hidden md:inline-flex">
                      <FlowchartArrow vertical={false} />
                    </span>
                  </>
                )}
              </motion.div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function FlowchartArrow({ vertical }: { vertical: boolean }) {
  if (vertical) {
    return (
      <svg
        width="24"
        height="32"
        viewBox="0 0 24 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker
            id="flowchart-arrow-v"
            viewBox="0 0 10 10"
            refX="5"
            refY="9"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 5 10 L 10 0 z" fill={ARROW_COLOR} />
          </marker>
        </defs>
        <line
          x1="12"
          y1="2"
          x2="12"
          y2="26"
          stroke={ARROW_COLOR}
          strokeWidth="1.5"
          markerEnd="url(#flowchart-arrow-v)"
        />
      </svg>
    )
  }
  return (
    <svg
      width="32"
      height="24"
      viewBox="0 0 32 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <marker
          id="flowchart-arrow-h"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={ARROW_COLOR} />
        </marker>
      </defs>
      <line
        x1="2"
        y1="12"
        x2="26"
        y2="12"
        stroke={ARROW_COLOR}
        strokeWidth="1.5"
        markerEnd="url(#flowchart-arrow-h)"
      />
    </svg>
  )
}
