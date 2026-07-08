'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useMemo } from 'react'

import { getActiveScene } from '@/lib/timeline/getActiveScene'
import type { Scene, SceneTemplate } from '@/lib/timeline/schema'

import { Causal } from './templates/Causal'
import { Comparison } from './templates/Comparison'
import { Figures } from './templates/Figures'
import { Flowchart } from './templates/Flowchart'
import { Grid } from './templates/Grid'
import { TimelineTemplate } from './templates/Timeline'

/**
 * Wrapper whiteboard structuré : sélectionne le sous-template selon
 * `scene.template.kind` et anime entrée/sortie via framer-motion.
 *
 * Architecture (spec POC §5.1) :
 *  - Ne consomme PAS `useAudio` ni `audio.currentTime` directement — le
 *    `currentTime` arrive en prop, ce qui isole les templates de
 *    l'AudioContext (DPC anti-skip).
 *  - Throttle implicite via la dépendance `Math.floor(currentTime * 2)` :
 *    on ne recalcule la scène active qu'à 2 Hz (les scènes durent 20-45s,
 *    inutile de recalculer à 60 Hz).
 *
 * Templates livrés en T4.1 : `grid`, `figures`. T4.2 ajoute `flowchart`,
 * `comparison`, `timeline`. T4.3 ajoute `causal`. Bibliothèque complète.
 *
 * Surbrillance dynamique (Lot 2, juillet 2026) : `highlightTime` est une
 * prop OPTIONNELLE et SEPAREE de `currentTime`. `currentTime` reste le
 * mécanisme de sélection de scène (les appelants type
 * `SceneWhiteboardWithConcepts` le figent volontairement à
 * `start_sec + 0.5` pour la continuité visuelle) ; `highlightTime` porte le
 * vrai temps audio (flux karaoké, lecture seule) et pilote uniquement
 * l'item allumé. Absente (preview admin, pages POC) => aucun highlight
 * dynamique, comportement strictement inchangé. Relais 7B : le déclencheur
 * actif est le dernier `highlight_at_sec` <= highlightTime de la scène
 * rendue, extinction après `end_sec` — résolu ici via
 * `getActiveHighlightAt`, throttlé à 4 Hz comme le karaoké.
 */

interface StructuredWhiteboardProps {
  scenes: Scene[]
  currentTime: number
  /** Temps audio réel pour la surbrillance d'items — cf. bloc doc ci-dessus. */
  highlightTime?: number
  className?: string
}

const ENTER_TRANSITION = {
  duration: 0.4,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
}
const EXIT_TRANSITION = {
  duration: 0.3,
  ease: [0.4, 0, 0.2, 1] as [number, number, number, number],
}

export function StructuredWhiteboard({
  scenes,
  currentTime,
  highlightTime,
  className,
}: StructuredWhiteboardProps) {
  // Throttle 2 Hz : la scène active ne se recalcule pas à chaque frame.
  const activeScene = useMemo(
    () => getActiveScene(currentTime, scenes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(currentTime * 2), scenes]
  )

  // Déclencheur de surbrillance actif de la scène rendue (relais 7B).
  // Throttle 4 Hz, aligné sur le karaoké (`useCurrentWord`).
  const activeHighlightAt = useMemo(
    () =>
      highlightTime !== undefined && activeScene
        ? getActiveHighlightAt(activeScene, highlightTime)
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor((highlightTime ?? -1) * 4), activeScene]
  )

  return (
    <div
      className={`bg-[color:var(--color-bg-card)]/30 rounded-xl p-6 ${className ?? ''}`}
    >
      <AnimatePresence mode="wait">
        {activeScene ? (
          <motion.div
            key={activeScene.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: EXIT_TRANSITION }}
            transition={ENTER_TRANSITION}
          >
            {activeScene.title && (
              <h3 className="mb-4 text-[11px] uppercase tracking-wide text-[color:var(--color-text-primary)]">
                {activeScene.title}
              </h3>
            )}
            <SceneRenderer
              template={activeScene.template}
              activeHighlightAt={activeHighlightAt}
            />
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={EXIT_TRANSITION}
            className="flex min-h-[160px] items-center justify-center"
          >
            <p className="text-sm italic text-[color:var(--color-text-muted)]">
              Visualisation suivante à venir…
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/**
 * Résout le déclencheur de surbrillance actif d'une scène (relais 7B) : le
 * plus grand `highlight_at_sec` <= highlightTime parmi les items du template,
 * ou `null` hors de la fenêtre de la scène (extinction en fin de scène).
 * Les bornes sont collectées par un parcours générique du payload template
 * (les items vivent à des chemins différents selon le kind : cards, left/
 * right.cards, nodes, figures, steps, events).
 */
function getActiveHighlightAt(scene: Scene, highlightTime: number): number | null {
  if (highlightTime < scene.start_sec || highlightTime > scene.end_sec) {
    return null
  }
  let best: number | null = null
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    if (node && typeof node === 'object') {
      const at = (node as Record<string, unknown>).highlight_at_sec
      if (
        typeof at === 'number' &&
        at <= highlightTime &&
        (best === null || at > best)
      ) {
        best = at
      }
      for (const value of Object.values(node)) walk(value)
    }
  }
  walk(scene.template)
  return best
}

/**
 * Sélecteur de template. Bibliothèque complète T4.3 : `grid`, `figures`,
 * `flowchart`, `comparison`, `timeline`, `causal`.
 */
function SceneRenderer({
  template,
  activeHighlightAt,
}: {
  template: SceneTemplate
  activeHighlightAt: number | null
}) {
  switch (template.kind) {
    case 'grid': {
      const columns = clampColumns(template.columns)
      return (
        <Grid
          cards={template.cards}
          columns={columns}
          activeHighlightAt={activeHighlightAt}
        />
      )
    }
    case 'figures':
      return (
        <Figures
          figures={template.figures}
          activeHighlightAt={activeHighlightAt}
        />
      )
    case 'flowchart':
      return (
        <Flowchart
          cards={template.cards}
          orientation={template.orientation}
          activeHighlightAt={activeHighlightAt}
        />
      )
    case 'comparison':
      return (
        <Comparison
          left={template.left}
          right={template.right}
          activeHighlightAt={activeHighlightAt}
        />
      )
    case 'timeline':
      return (
        <TimelineTemplate
          steps={template.steps}
          events={template.events}
          activeHighlightAt={activeHighlightAt}
        />
      )
    case 'causal':
      return (
        <Causal
          cause={template.cause}
          effects={template.effects}
          nodes={template.nodes}
          edges={template.edges}
          activeHighlightAt={activeHighlightAt}
        />
      )
  }
}

/**
 * Le schéma autorise n'importe quel entier positif pour `columns`, mais le
 * composant Grid contraint à 2/3/4 (purge Tailwind). On clamp en cas de
 * payload non conforme — un cas exotique mais on préfère render un truc
 * lisible plutôt que crasher.
 */
function clampColumns(n: number): 2 | 3 | 4 {
  if (n <= 2) return 2
  if (n >= 4) return 4
  return 3
}
