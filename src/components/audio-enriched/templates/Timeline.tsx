'use client'

import { motion } from 'framer-motion'

import type { CardContent, CardVariant } from '@/lib/timeline/schema'

/**
 * Template "timeline" : frise chronologique. Cf. spec POC §5.2.
 *
 * ⚠️ Naming : exporté sous `TimelineTemplate` pour éviter toute collision
 * avec le type `Timeline` racine du schéma JSON (`@/lib/timeline/schema`).
 *
 * Comportement dual selon le payload :
 *  - `events[]` (mode T4.2 préféré, conforme spec) : frise chronologique
 *    avec labels temporels (`J0`, `J7`, `6 mois`…). Desktop = frise
 *    horizontale avec markers + textes alternés au-dessus/en-dessous.
 *    Mobile = liste verticale type "fil d'événements".
 *  - `steps[]` (mode T3 legacy) : frise simple sans dates, suite de cards
 *    séparées par un trait fin. Desktop = horizontal, mobile = vertical.
 *  - sinon : render `null` (le wrapper s'occupe du placeholder).
 *
 * Si `events` ET `steps` sont fournis, `events` prime (mode préféré).
 */

interface TimelineEvent {
  at_label: string
  text: string
}

interface TimelineTemplateProps {
  steps?: CardContent[]
  events?: TimelineEvent[]
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

const STEP_DELAY = 0.2
const MARKER_DURATION = 0.25
const LABEL_DURATION = 0.25
const LABEL_OFFSET_DELAY = 0.1
const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

export function TimelineTemplate({
  steps,
  events,
  className,
}: TimelineTemplateProps) {
  if (events && events.length > 0) {
    return <EventsMode events={events} className={className} />
  }
  if (steps && steps.length > 0) {
    return <StepsMode steps={steps} className={className} />
  }
  return null
}

// ─── Mode events (préféré, spec §5.2) ────────────────────────────────────────

function EventsMode({
  events,
  className,
}: {
  events: TimelineEvent[]
  className?: string
}) {
  return (
    <div className={className}>
      {/* Desktop : frise horizontale ≥ md */}
      <div className="hidden md:block">
        <EventsHorizontal events={events} />
      </div>
      {/* Mobile : liste verticale < md */}
      <div className="md:hidden">
        <EventsVertical events={events} />
      </div>
    </div>
  )
}

function EventsHorizontal({ events }: { events: TimelineEvent[] }) {
  const total = events.length
  return (
    <div className="relative w-full py-12 px-4 min-h-[200px]">
      {/* Axe horizontal */}
      <div
        aria-hidden="true"
        className="absolute left-4 right-4 top-1/2 h-px bg-white/20"
      />
      {events.map((event, index) => {
        // Position : événement seul → centré ; sinon distribués sur 0..100%
        const leftPct = total === 1 ? 50 : (index / (total - 1)) * 100
        const isAbove = index % 2 === 0
        const markerDelay = index * STEP_DELAY
        const labelDelay = markerDelay + LABEL_OFFSET_DELAY

        return (
          <div
            key={index}
            className="absolute top-1/2"
            style={{ left: `${leftPct}%` }}
          >
            {/* Marker dot sur l'axe */}
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{
                duration: MARKER_DURATION,
                delay: markerDelay,
                ease: EASE,
              }}
              className="absolute w-3 h-3 rounded-full bg-ds-turquoise -translate-x-1/2 -translate-y-1/2"
            />
            {/* Connecteur fin marker → bloc texte */}
            <div
              aria-hidden="true"
              className={`absolute w-px h-4 bg-white/20 -translate-x-1/2 ${
                isAbove ? '-translate-y-full -top-1' : 'top-1'
              }`}
            />
            {/* Bloc texte alterné */}
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: LABEL_DURATION,
                delay: labelDelay,
                ease: EASE,
              }}
              className={`absolute w-32 -translate-x-1/2 text-center ${
                isAbove ? 'bottom-6' : 'top-6'
              }`}
            >
              <p className="text-ds-turquoise text-xs font-bold uppercase tracking-wide">
                {event.at_label}
              </p>
              <p className="text-[color:var(--color-text-primary)] text-sm mt-1 leading-tight">
                {event.text}
              </p>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}

function EventsVertical({ events }: { events: TimelineEvent[] }) {
  return (
    <div className="flex flex-col">
      {events.map((event, index) => {
        const isLast = index === events.length - 1
        const markerDelay = index * STEP_DELAY
        const labelDelay = markerDelay + LABEL_OFFSET_DELAY

        return (
          <div key={index} className="relative flex gap-3 pb-6 last:pb-0">
            {/* Colonne gauche : dot + barre verticale */}
            <div className="relative flex flex-col items-center flex-shrink-0">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{
                  duration: MARKER_DURATION,
                  delay: markerDelay,
                  ease: EASE,
                }}
                className="w-3 h-3 rounded-full bg-ds-turquoise mt-1"
              />
              {!isLast && (
                <div
                  aria-hidden="true"
                  className="absolute top-4 bottom-0 w-px bg-white/20"
                />
              )}
            </div>
            {/* Colonne droite : label + texte */}
            <motion.div
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: LABEL_DURATION,
                delay: labelDelay,
                ease: EASE,
              }}
              className="flex flex-col"
            >
              <p className="text-ds-turquoise text-xs font-bold uppercase tracking-wide">
                {event.at_label}
              </p>
              <p className="text-[color:var(--color-text-primary)] text-sm mt-1 leading-tight">
                {event.text}
              </p>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Mode steps (legacy T3) ──────────────────────────────────────────────────

function StepsMode({
  steps,
  className,
}: {
  steps: CardContent[]
  className?: string
}) {
  return (
    <div
      className={`flex flex-col items-stretch gap-2 md:flex-row md:items-center md:gap-2 md:flex-wrap md:justify-center ${className ?? ''}`}
    >
      {steps.map((card, index) => {
        const variantClass = card.variant
          ? VARIANT_CLASS[card.variant]
          : NEUTRAL_CARD_CLASS
        const isLast = index === steps.length - 1
        return (
          <StepFragment
            key={index}
            card={card}
            variantClass={variantClass}
            index={index}
            isLast={isLast}
          />
        )
      })}
    </div>
  )
}

function StepFragment({
  card,
  variantClass,
  index,
  isLast,
}: {
  card: CardContent
  variantClass: string
  index: number
  isLast: boolean
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: 0.25,
          delay: index * STEP_DELAY,
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
                : 'text-xs text-white/75'
            }
          >
            {card.subtitle}
          </p>
        )}
      </motion.div>
      {!isLast && (
        <div
          aria-hidden="true"
          className="self-center h-px w-6 bg-white/20 md:h-px md:w-6"
        />
      )}
    </>
  )
}
