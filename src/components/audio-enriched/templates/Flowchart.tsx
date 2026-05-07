'use client'

import { motion } from 'framer-motion'
import { Fragment } from 'react'

import type { CardContent, CardVariant } from '@/lib/timeline/schema'

/**
 * Template "flowchart" : suite ordonnée de cards reliées par des flèches
 * (horizontal par défaut, vertical en option). Cf. spec POC §5.2.
 *
 * Animation : cascade card → flèche → card → flèche, stagger 100ms.
 * Tokens design alignés sur Grid (T4.1) — variants partagés.
 */

interface FlowchartProps {
  cards: CardContent[]
  /** Direction du flowchart. Défaut 'horizontal'. */
  orientation?: 'horizontal' | 'vertical'
  className?: string
}

const VARIANT_CLASS: Record<CardVariant, string> = {
  highlight: 'bg-ds-turquoise/15 border-ds-turquoise/40 text-ds-turquoise',
  warning: 'bg-axe3/15 border-axe3/40 text-axe3',
  success: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
}

const NEUTRAL_CARD_CLASS =
  'bg-[color:var(--color-bg-card)] border-white/10 text-[color:var(--color-text-primary)]'

const BASE_CARD_CLASS =
  'border rounded-lg p-3 shadow-sm flex flex-col gap-1 min-w-[140px] max-w-[200px]'

const STEP_DELAY = 0.1
const CARD_DURATION = 0.25
const ARROW_DURATION = 0.2
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

const ARROW_COLOR = '#888780'

export function Flowchart({
  cards,
  orientation = 'horizontal',
  className,
}: FlowchartProps) {
  const isVertical = orientation === 'vertical'

  const containerClass = isVertical
    ? 'flex flex-col items-center gap-3'
    : 'flex flex-row items-stretch gap-3 flex-wrap justify-center'

  return (
    <div className={`${containerClass} ${className ?? ''}`}>
      {cards.map((card, index) => {
        const cardStepIndex = index * 2
        const arrowStepIndex = cardStepIndex + 1
        const variantClass = card.variant
          ? VARIANT_CLASS[card.variant]
          : NEUTRAL_CARD_CLASS

        return (
          <Fragment key={index}>
            <motion.div
              initial={
                isVertical
                  ? { opacity: 0, x: 4 }
                  : { opacity: 0, y: 4 }
              }
              animate={
                isVertical ? { opacity: 1, x: 0 } : { opacity: 1, y: 0 }
              }
              transition={{
                duration: CARD_DURATION,
                delay: cardStepIndex * STEP_DELAY,
                ease: EASE,
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
                <FlowchartArrow vertical={isVertical} />
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
