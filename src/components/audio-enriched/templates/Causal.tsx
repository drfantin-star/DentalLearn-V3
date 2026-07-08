'use client'

import { motion } from 'framer-motion'
import { Fragment } from 'react'

import type { CardContent } from '@/lib/timeline/schema'

import { cardStateClass, isCardAccented } from './dynamic-highlight'

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
 *  - Desktop (≥md) en mode graphe : container à hauteur dérivée du viewport
 *    (`calc(100vh-37rem)`, bornée 240–400px) pour tenir dans une page sans
 *    scroll en modes Combiné et Whiteboard. Cards positionnées en absolute
 *    (% relatifs au conteneur), edges SVG superposées en `preserveAspectRatio
 *    ="none"` qui adapte lignes et labels au ratio réel du conteneur.
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
  /** Déclencheur de surbrillance actif de la scène (null = rien d'allumé). */
  activeHighlightAt?: number | null
  /** 8B : rendu statique legacy (variant highlight) — chemin news uniquement. */
  staticVariantsEnabled?: boolean
  className?: string
}

// ─── Tokens design partagés (alignés sur Grid/Flowchart/Comparison) ─────────
// État des cards via `dynamic-highlight.ts` (2A : variant statique
// `highlight` plus rendu, surbrillance dynamique via `activeHighlightAt`).

const NEUTRAL_CARD_CLASS =
  'bg-[color:var(--color-bg-card)] border-white/10 text-[color:var(--color-text-primary)]'

const BASE_CARD_CLASS =
  'border rounded-lg p-3 shadow-sm flex flex-col gap-1 transition-colors duration-300'

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
// `x` = 0 (gauche) → 100 (droite). `y` = 0 (haut) → 100 (bas). La SVG
// superposée utilise viewBox 0 0 100 75 (ratio 4:3 nominal) avec
// `preserveAspectRatio="none"` qui la stretche au ratio réel du conteneur.
// On convertit `y * 0.75` pour les coords SVG (cf. `toSvgY`).
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

// ─── Tokens label d'arête (partagés rendu + layout) ─────────────────────────
//
// Le calcul de bounding box doit être identique entre le composant qui rend
// le label (`EdgeLabel`) et l'algo d'évitement de collision (`GraphDesktop`).
// On les exporte ici pour éviter toute dérive.
const LABEL_CHAR_W = 1.6
const LABEL_PAD_X = 2.2
const LABEL_HEIGHT = 6
const LABEL_MAX_WIDTH = 50

function getLabelWidth(label: string): number {
  return Math.min(label.length * LABEL_CHAR_W + LABEL_PAD_X * 2, LABEL_MAX_WIDTH)
}

// Bounding box approximative d'une card-nœud, en unités viewBox (0..100 × 0..75).
// Les cards sont en HTML positionnées en % du container avec une largeur
// min 120px / max 160px et 1-2 lignes de texte ; sur un container de
// ~600-900px de large et 240-400px de haut, ça correspond à ~14-26 unités
// viewBox horizontales et ~10-14 verticales. On prend une estimation prudente,
// un peu généreuse, pour éviter que les labels flirtent avec les cards.
const NODE_BBOX_W = 28
const NODE_BBOX_H = 14

// Centre géométrique du graphe (viewBox) : sert à orienter le décalage des
// labels « vers l'extérieur », là où il y a de l'espace libre.
const GRAPH_CX = 50
const GRAPH_CY = toSvgY(50)

const VIEW_W = 100
const VIEW_H = 75

// Pénalités du fallback « moindre recouvrement » utilisé quand aucune position
// n'est totalement libre : éviter les nœuds prime sur éviter les autres labels,
// et l'amplitude du décalage perpendiculaire ne sert que de départage.
const NODE_PENALTY_W = 3
const LABEL_PENALTY_W = 1
const OFFSET_PENALTY_W = 0.05

type BBox = { x: number; y: number; w: number; h: number }

// Aire d'intersection de deux AABB (0 si disjointes).
function overlapArea(a: BBox, b: BBox): number {
  const dx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const dy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  return dx > 0 && dy > 0 ? dx * dy : 0
}

// Candidats de position le long d'une arête (paramètre t) : le milieu d'abord,
// puis on s'écarte par paliers symétriques. On reste dans [0.18, 0.82] pour ne
// pas coller aux nœuds (le marqueur de flèche occupe les ~10% finaux).
const LABEL_T_CANDIDATES = [0.5, 0.38, 0.62, 0.3, 0.7, 0.22, 0.78]

// Décalages perpendiculaires à l'arête (unités viewBox), appliqués le long de
// la perpendiculaire orientée vers l'extérieur du graphe (offset > 0). 0
// d'abord (label sur la ligne, aspect par défaut), puis on s'écarte par paliers
// en privilégiant l'extérieur, mais on autorise aussi l'intérieur (offset < 0) :
// sur l'arête basse d'un pentagone, l'extérieur est plafonné par le bord du
// viewBox alors que le cœur du graphe est vide.
const LABEL_PERP_OFFSETS = [
  0,
  LABEL_HEIGHT,
  -LABEL_HEIGHT,
  LABEL_HEIGHT * 1.8,
  -LABEL_HEIGHT * 1.8,
]

// ─── Entrée du composant ────────────────────────────────────────────────────

export function Causal({
  cause,
  effects,
  nodes,
  edges,
  activeHighlightAt,
  staticVariantsEnabled,
  className,
}: CausalProps) {
  // Mode graphe préféré si présent et valide (≥ 2 nodes)
  if (nodes && nodes.length >= 2) {
    return (
      <GraphMode
        nodes={nodes}
        edges={edges ?? []}
        activeHighlightAt={activeHighlightAt}
        staticVariantsEnabled={staticVariantsEnabled}
        className={className}
      />
    )
  }
  // Sinon mode étoile legacy
  if (cause && effects && effects.length > 0) {
    return (
      <StarMode
        cause={cause}
        effects={effects}
        activeHighlightAt={activeHighlightAt}
        staticVariantsEnabled={staticVariantsEnabled}
        className={className}
      />
    )
  }
  return null
}

// ─── Mode graphe (nodes + edges) ────────────────────────────────────────────

function GraphMode({
  nodes,
  edges,
  activeHighlightAt,
  staticVariantsEnabled,
  className,
}: {
  nodes: Array<CardContent & { id?: string }>
  edges: Array<{ from: string; to: string; label?: string }>
  activeHighlightAt?: number | null
  staticVariantsEnabled?: boolean
  className?: string
}) {
  return (
    <div className={className}>
      <div className="hidden md:block">
        <GraphDesktop
          nodes={nodes}
          edges={edges}
          activeHighlightAt={activeHighlightAt}
          staticVariantsEnabled={staticVariantsEnabled}
        />
      </div>
      <div className="md:hidden">
        <GraphMobile
          nodes={nodes}
          edges={edges}
          activeHighlightAt={activeHighlightAt}
          staticVariantsEnabled={staticVariantsEnabled}
        />
      </div>
    </div>
  )
}

function GraphDesktop({
  nodes,
  edges,
  activeHighlightAt,
  staticVariantsEnabled,
}: {
  nodes: Array<CardContent & { id?: string }>
  edges: Array<{ from: string; to: string; label?: string }>
  activeHighlightAt?: number | null
  staticVariantsEnabled?: boolean
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

  // ─ Évitement de collision des labels d'arêtes ────────────────────────────
  // Greedy : pour chaque edge avec label, on essaie un jeu de positions le long
  // de l'arête (paramètre t) ET décalées perpendiculairement vers l'extérieur
  // du graphe. On retient la première position totalement libre (aucun
  // recouvrement avec les nœuds ni les labels déjà placés). Si aucune ne l'est
  // — typiquement un label large coincé entre deux nœuds — on retient celle qui
  // minimise le recouvrement, en pénalisant d'abord les nœuds.
  const nodeBoxes: BBox[] = positions.map((p) => ({
    x: p.x - NODE_BBOX_W / 2,
    y: toSvgY(p.y) - NODE_BBOX_H / 2,
    w: NODE_BBOX_W,
    h: NODE_BBOX_H,
  }))
  const placedLabelBoxes: BBox[] = []
  const labelPositions: Array<{ x: number; y: number } | null> = edges.map(
    (edge) => {
      if (!edge.label) return null
      const fromIdx = idToIndex.get(edge.from)
      const toIdx = idToIndex.get(edge.to)
      if (fromIdx === undefined || toIdx === undefined) return null
      const a = positions[fromIdx]
      const b = positions[toIdx]
      const x1 = a.x
      const y1 = toSvgY(a.y)
      const x2 = b.x
      const y2 = toSvgY(b.y)
      const dx = x2 - x1
      const dy = y2 - y1
      const w = getLabelWidth(edge.label)
      const h = LABEL_HEIGHT

      // Perpendiculaire unitaire orientée vers l'extérieur du graphe : on
      // pousse les labels vers les marges (espace vide) plutôt que vers le
      // cœur où s'amassent les nœuds.
      const len = Math.hypot(dx, dy) || 1
      let px = -dy / len
      let py = dx / len
      const mx = (x1 + x2) / 2
      const my = (y1 + y2) / 2
      if (px * (mx - GRAPH_CX) + py * (my - GRAPH_CY) < 0) {
        px = -px
        py = -py
      }

      let best: { x: number; y: number; box: BBox } | null = null
      let bestPenalty = Infinity
      for (const t of LABEL_T_CANDIDATES) {
        const bx = x1 + dx * t
        const by = y1 + dy * t
        for (const off of LABEL_PERP_OFFSETS) {
          // Maintien dans le viewBox pour ne pas être rogné par les bords SVG.
          const cx = Math.min(Math.max(bx + px * off, w / 2), VIEW_W - w / 2)
          const cy = Math.min(Math.max(by + py * off, h / 2), VIEW_H - h / 2)
          const box: BBox = { x: cx - w / 2, y: cy - h / 2, w, h }
          const nodePen = nodeBoxes.reduce(
            (s, nb) => s + overlapArea(box, nb),
            0
          )
          const labelPen = placedLabelBoxes.reduce(
            (s, lb) => s + overlapArea(box, lb),
            0
          )
          if (nodePen === 0 && labelPen === 0) {
            best = { x: cx, y: cy, box }
            bestPenalty = 0
            break
          }
          const penalty =
            nodePen * NODE_PENALTY_W +
            labelPen * LABEL_PENALTY_W +
            Math.abs(off) * OFFSET_PENALTY_W
          if (penalty < bestPenalty) {
            bestPenalty = penalty
            best = { x: cx, y: cy, box }
          }
        }
        if (bestPenalty === 0) break
      }
      if (best) placedLabelBoxes.push(best.box)
      return best ? { x: best.x, y: best.y } : null
    }
  )

  return (
    <div className="relative w-full h-[calc(100vh-37rem)] min-h-[240px] max-h-[400px]">
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
          const labelPos = labelPositions[i]

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
              {edge.label && labelPos && (
                <EdgeLabel
                  midX={labelPos.x}
                  midY={labelPos.y}
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
        const stateClass = cardStateClass(
          node,
          activeHighlightAt,
          NEUTRAL_CARD_CLASS,
          staticVariantsEnabled
        )
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
            className={`absolute ${BASE_CARD_CLASS} ${stateClass} min-w-[120px] max-w-[160px] text-center`}
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
                  isCardAccented(node, activeHighlightAt, staticVariantsEnabled)
                    ? 'text-xs opacity-80'
                    : 'text-xs text-white/75'
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
  const w = getLabelWidth(label)
  const h = LABEL_HEIGHT
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
        rx="1.5"
        fill="rgb(28 28 28)"
        opacity="0.95"
      />
      <text
        x={midX}
        y={midY + 1.2}
        fontSize="3.5"
        fill="#a8a59f"
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
  activeHighlightAt,
  staticVariantsEnabled,
}: {
  nodes: Array<CardContent & { id?: string }>
  edges: Array<{ from: string; to: string; label?: string }>
  activeHighlightAt?: number | null
  staticVariantsEnabled?: boolean
}) {
  return (
    <div className="flex flex-col items-stretch gap-0">
      {nodes.map((node, i) => {
        const stateClass = cardStateClass(
          node,
          activeHighlightAt,
          NEUTRAL_CARD_CLASS,
          staticVariantsEnabled
        )
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
              className={`${BASE_CARD_CLASS} ${stateClass} text-center self-center min-w-[180px] max-w-[260px]`}
            >
              <p className="text-sm font-medium leading-tight">{node.text}</p>
              {node.subtitle && (
                <p
                  className={
                    isCardAccented(node, activeHighlightAt, staticVariantsEnabled)
                      ? 'text-xs opacity-80'
                      : 'text-xs text-white/75'
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
                  <span className="text-white/75 text-xs px-2">
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
  activeHighlightAt,
  staticVariantsEnabled,
  className,
}: {
  cause: CardContent
  effects: CardContent[]
  activeHighlightAt?: number | null
  staticVariantsEnabled?: boolean
  className?: string
}) {
  return (
    <div className={`flex flex-col items-center gap-3 ${className ?? ''}`}>
      <CardBlock
        card={cause}
        delay={0}
        activeHighlightAt={activeHighlightAt}
        staticVariantsEnabled={staticVariantsEnabled}
      />
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
            activeHighlightAt={activeHighlightAt}
            staticVariantsEnabled={staticVariantsEnabled}
          />
        ))}
      </div>
    </div>
  )
}

function CardBlock({
  card,
  delay,
  activeHighlightAt,
  staticVariantsEnabled,
}: {
  card: CardContent
  delay: number
  activeHighlightAt?: number | null
  staticVariantsEnabled?: boolean
}) {
  const stateClass = cardStateClass(
    card,
    activeHighlightAt,
    NEUTRAL_CARD_CLASS,
    staticVariantsEnabled
  )
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: NODE_DURATION, delay, ease: EASE }}
      className={`${BASE_CARD_CLASS} ${stateClass} text-center min-w-[140px] max-w-[200px] self-center`}
    >
      <p className="text-sm font-medium leading-tight">{card.text}</p>
      {card.subtitle && (
        <p
          className={
            isCardAccented(card, activeHighlightAt, staticVariantsEnabled)
              ? 'text-xs opacity-80'
              : 'text-xs text-white/75'
          }
        >
          {card.subtitle}
        </p>
      )}
    </motion.div>
  )
}
