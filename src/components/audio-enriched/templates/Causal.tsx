'use client'

import { motion } from 'framer-motion'
import { Fragment } from 'react'

import type { CardContent, CardVariant } from '@/lib/timeline/schema'

/**
 * Template "causal" : graphe physiopathologique. Cf. spec POC §5.2.
 *
 * Comportement dual selon le payload (cf. `CausalTemplateSchema` dans
 * `src/lib/timeline/schema.ts`) :
 *  - Mode `nodes + edges` (T4.3, préféré si présent) : graphe orienté avec
 *    layout déterministe selon `nodes.length` (2 = ligne, 3 = triangle,
 *    4 = losange, 5 = pentagone), edges SVG étiquetées.
 *  - Mode `cause + effects` (T3 legacy) : 1 cause → N effets, étoile simple.
 *  - Sinon : render `null`.
 *
 * Responsive (T4.3 §6) :
 *  - Desktop (≥md) en mode graphe : container `aspect-[4/3]`, cards
 *    positionnées en absolute, edges SVG superposées.
 *  - Mobile (<md) en mode graphe : chaîne verticale empilée — l'ordre suit
 *    `nodes[]` (simplification POC). Si une edge relie deux nodes
 *    consécutifs, son label éventuel est affiché entre les deux cards.
 *  - Mode étoile : desktop = cause au-dessus + effets en grille flex ;
 *    mobile = chaîne verticale.
 *
 * Animation graphe : nodes en cascade (stagger 200ms), puis tracé des edges
 * (`pathLength` SVG, 600ms easing), puis labels d'edges en fondu.
 */

interface CausalProps {
  // Mode legacy "cause+effects"
  cause?: CardContent
  effects?: CardContent[]
  // Mode "nodes+edges" (préféré si présent)
  nodes?: Array<CardContent & { id?: string }>
  edges?: Array<{ from: string; to: string; label?: string }>
  className?: string
}

// ─── Tokens design partagés (alignés sur Grid/Flowchart/Comparison) ─────────

const VARIANT_CLASS: Record<CardVariant, string> = {
  highlight: 'bg-ds-turquoise/15 border-ds-turquoise/40 text-ds-turquoise',
  warning: 'bg-axe3/15 border-axe3/40 text-axe3',
  success: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300',
}

const NEUTRAL_CARD_CLASS =
  'bg-[color:var(--color-bg-card)] border-white/10 text-[color:var(--color-text-primary)]'

const BASE_CARD_CLASS =
  'border rounded-lg p-3 shadow-sm flex flex-col gap-1'

const EDGE_COLOR = '#888780'

const EASE: [number, number, number, number] = [0.4, 0, 0.2, 1]

// Phasing (mode graphe) :
//  Phase 1 : nodes en cascade (NODE_STAGGER entre chaque, NODE_DURATION par node)
//  Phase 2 : edges après le dernier node (EDGE_DURATION × pathLength)
//  Phase 3 : labels après le tracé de leur edge
const NODE_DURATION = 0.3
const NODE_STAGGER = 0.2
const EDGE_DURATION = 0.6
const EDGE_LABEL_DURATION = 0.25

// ─── Layouts déterministes (positions en % du container 0-100) ──────────────
//
// `x` = 0 (gauche) → 100 (droite). `y` = 0 (haut) → 100 (bas). Le container
// a `aspect-[4/3]` côté CSS — la SVG superposée utilise viewBox 0 0 100 75
// donc on convertit `y * 0.75` pour les coords SVG (cf. `toSvgY`).
type Position = { x: number; y: number }

function getNodePosition(index: number, total: number): Position {
  if (total === 2) {
    return [
      { x: 18, y: 50 },
      { x: 82, y: 50 },
    ][index]
  }
  if (total === 3) {
    return [
      { x: 50, y: 18 },
      { x: 22, y: 82 },
      { x: 78, y: 82 },
    ][index]
  }
  if (total === 4) {
    return [
      { x: 22, y: 22 },
      { x: 78, y: 22 },
      { x: 22, y: 78 },
      { x: 78, y: 78 },
    ][index]
  }
  // total === 5 : pentagone (ordre horaire depuis le sommet)
  return [
    { x: 50, y: 12 },
    { x: 90, y: 42 },
    { x: 76, y: 86 },
    { x: 24, y: 86 },
    { x: 10, y: 42 },
  ][index]
}

const SVG_HEIGHT_RATIO = 0.75 // viewBox 0 0 100 75
function toSvgY(yPct: number): number {
  return yPct * SVG_HEIGHT_RATIO
}

// ─── Entrée du composant ────────────────────────────────────────────────────

export function Causal({
  cause,
  effects,
  nodes,
  edges,
  className,
}: CausalProps) {
  // Mode graphe préféré si présent et valide (≥ 2 nodes)
  if (nodes && nodes.length >= 2) {
    return <GraphMode nodes={nodes} edges={edges ?? []} className={className} />
  }
  // Sinon mode étoile legacy
  if (cause && effects && effects.length > 0) {
    return (
      <StarMode cause={cause} effects={effects} className={className} />
    )
  }
  return null
}

// ─── Mode graphe (nodes + edges) ────────────────────────────────────────────

function GraphMode({
  nodes,
  edges,
  className,
}: {
  nodes: Array<CardContent & { id?: string }>
  edges: Array<{ from: string; to: string; label?: string }>
  className?: string
}) {
  return (
    <div className={className}>
      <div className="hidden md:block">
        <GraphDesktop nodes={nodes} edges={edges} />
      </div>
      <div className="md:hidden">
        <GraphMobile nodes={nodes} edges={edges} />
      </div>
    </div>
  )
}

function GraphDesktop({
  nodes,
  edges,
}: {
  nodes: Array<CardContent & { id?: string }>
  edges: Array<{ from: string; to: string; label?: string }>
}) {
  const total = nodes.length
  const positions = nodes.map((_, i) => getNodePosition(i, total))
  const idToIndex = new Map<string, number>()
  nodes.forEach((n, i) => {
    if (n.id) idToIndex.set(n.id, i)
  })

  // Délais : tous les nodes apparaissent d'abord, puis les edges, puis labels
  const nodesEndDelay = (total - 1) * NODE_STAGGER + NODE_DURATION
  const edgesEndDelay = nodesEndDelay + EDGE_DURATION

  return (
    <div className="relative w-full min-h-[320px] aspect-[4/3]">
      {/* Couche SVG des edges (en dessous des cards visuellement) */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        viewBox="0 0 100 75"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <marker
            id="causal-arrow-h"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={EDGE_COLOR} />
          </marker>
        </defs>
        {edges.map((edge, i) => {
          const fromIdx = idToIndex.get(edge.from)
          const toIdx = idToIndex.get(edge.to)
          if (fromIdx === undefined || toIdx === undefined) return null
          const a = positions[fromIdx]
          const b = positions[toIdx]
          const x1 = a.x
          const y1 = toSvgY(a.y)
          const x2 = b.x
          const y2 = toSvgY(b.y)
          const midX = (x1 + x2) / 2
          const midY = (y1 + y2) / 2

          return (
            <Fragment key={i}>
              <motion.line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={EDGE_COLOR}
                strokeWidth="0.5"
                vectorEffect="non-scaling-stroke"
                markerEnd="url(#causal-arrow-h)"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{
                  pathLength: {
                    duration: EDGE_DURATION,
                    delay: nodesEndDelay,
                    ease: EASE,
                  },
                  opacity: {
                    duration: 0.001,
                    delay: nodesEndDelay,
                  },
                }}
              />
              {edge.label && (
                <EdgeLabel
                  midX={midX}
                  midY={midY}
                  label={edge.label}
                  delay={edgesEndDelay}
                />
              )}
            </Fragment>
          )
        })}
      </svg>

      {/* Couche cards positionnées en absolute */}
      {nodes.map((node, i) => {
        const pos = positions[i]
        const variantClass = node.variant
          ? VARIANT_CLASS[node.variant]
          : NEUTRAL_CARD_CLASS
        return (
          <motion.div
            key={node.id ?? i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              duration: NODE_DURATION,
              delay: i * NODE_STAGGER,
              ease: EASE,
            }}
            className={`absolute ${BASE_CARD_CLASS} ${variantClass} min-w-[120px] max-w-[160px] text-center`}
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <p className="text-sm font-medium leading-tight">{node.text}</p>
            {node.subtitle && (
              <p
                className={
                  node.variant
                    ? 'text-xs opacity-80'
                    : 'text-xs text-[color:var(--color-text-secondary)]'
                }
              >
                {node.subtitle}
              </p>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

function EdgeLabel({
  midX,
  midY,
  label,
  delay,
}: {
  midX: number
  midY: number
  label: string
  delay: number
}) {
  // Largeur estimée du rect pour le fond — ~1.6 unité viewBox par caractère
  // à font-size 3.5. Tronqué/centré.
  const charW = 1.6
  const padX = 1.2
  const w = Math.min(label.length * charW + padX * 2, 50)
  const h = 5
  return (
    <motion.g
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: EDGE_LABEL_DURATION, delay, ease: EASE }}
    >
      <rect
        x={midX - w / 2}
        y={midY - h / 2}
        width={w}
        height={h}
        rx="1"
        fill="rgb(28 28 28)"
        opacity="0.85"
      />
      <text
        x={midX}
        y={midY + 1.2}
        fontSize="3.5"
        fill="#a8a59f"
        fontStyle="italic"
        textAnchor="middle"
        style={{ paintOrder: 'stroke' }}
      >
        {label}
      </text>
    </motion.g>
  )
}

function GraphMobile({
  nodes,
  edges,
}: {
  nodes: Array<CardContent & { id?: string }>
  edges: Array<{ from: string; to: string; label?: string }>
}) {
  return (
    <div className="flex flex-col items-stretch gap-0">
      {nodes.map((node, i) => {
        const variantClass = node.variant
          ? VARIANT_CLASS[node.variant]
          : NEUTRAL_CARD_CLASS
        const isLast = i === nodes.length - 1
        // Edge entre nodes[i] et nodes[i+1] dans l'ordre du tableau
        const linkingEdge = !isLast
          ? edges.find(
              (e) =>
                e.from === node.id && e.to === nodes[i + 1]?.id
            )
          : undefined

        return (
          <Fragment key={node.id ?? i}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{
                duration: NODE_DURATION,
                delay: i * NODE_STAGGER,
                ease: EASE,
              }}
              className={`${BASE_CARD_CLASS} ${variantClass} text-center self-center min-w-[180px] max-w-[260px]`}
            >
              <p className="text-sm font-medium leading-tight">{node.text}</p>
              {node.subtitle && (
                <p
                  className={
                    node.variant
                      ? 'text-xs opacity-80'
                      : 'text-xs text-[color:var(--color-text-secondary)]'
                  }
                >
                  {node.subtitle}
                </p>
              )}
            </motion.div>
            {!isLast && (
              <div
                className="self-center flex flex-col items-center py-1"
                aria-hidden="true"
              >
                <div className="bg-white/20 w-px h-3" />
                {linkingEdge?.label && (
                  <span className="text-[color:var(--color-text-secondary)] text-xs italic px-2">
                    {linkingEdge.label}
                  </span>
                )}
                <div className="bg-white/20 w-px h-3" />
                <ChainArrow />
              </div>
            )}
          </Fragment>
        )
      })}
    </div>
  )
}

function ChainArrow() {
  return (
    <svg
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 0 0 L 5 6 L 10 0 z"
        fill={EDGE_COLOR}
      />
    </svg>
  )
}

// ─── Mode étoile (legacy cause + effects) ───────────────────────────────────

function StarMode({
  cause,
  effects,
  className,
}: {
  cause: CardContent
  effects: CardContent[]
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ''}`}>
      <CardBlock card={cause} delay={0} />
      <div
        aria-hidden="true"
        className="bg-white/20 w-px h-4"
      />
      <div className="flex flex-col items-stretch gap-2 w-full md:flex-row md:flex-wrap md:justify-center">
        {effects.map((effect, i) => (
          <CardBlock
            key={i}
            card={effect}
            delay={(i + 1) * NODE_STAGGER}
          />
        ))}
      </div>
    </div>
  )
}

function CardBlock({ card, delay }: { card: CardContent; delay: number }) {
  const variantClass = card.variant
    ? VARIANT_CLASS[card.variant]
    : NEUTRAL_CARD_CLASS
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: NODE_DURATION, delay, ease: EASE }}
      className={`${BASE_CARD_CLASS} ${variantClass} text-center min-w-[140px] max-w-[200px] self-center`}
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
}
