'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useMemo } from 'react'

import { getActiveScene } from '@/lib/timeline/getActiveScene'
import type { Scene, SceneTemplate } from '@/lib/timeline/schema'

import { Figures } from './templates/Figures'
import { Grid } from './templates/Grid'

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
 * Templates livrés en T4.1 : `grid`, `figures`. Les autres (`flowchart`,
 * `comparison`, `causal`, `timeline`) rendent un placeholder explicite
 * pour permettre la validation de `getActiveScene` sur l'ensemble de la
 * timeline mockée. Ces placeholders seront remplacés en T4.2 / T4.3.
 */

interface StructuredWhiteboardProps {
  scenes: Scene[]
  currentTime: number
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
  className,
}: StructuredWhiteboardProps) {
  // Throttle 2 Hz : la scène active ne se recalcule pas à chaque frame.
  const activeScene = useMemo(
    () => getActiveScene(currentTime, scenes),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [Math.floor(currentTime * 2), scenes]
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
              <h3 className="mb-4 text-[11px] uppercase tracking-wide text-[color:var(--color-text-muted)]">
                {activeScene.title}
              </h3>
            )}
            <SceneRenderer template={activeScene.template} />
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
 * Sélecteur de template. Pour T4.1 on ne render que `grid` et `figures` ; les
 * autres `kind` reçoivent un placeholder pointant vers le ticket de livraison.
 */
function SceneRenderer({ template }: { template: SceneTemplate }) {
  switch (template.kind) {
    case 'grid': {
      const columns = clampColumns(template.columns)
      return <Grid cards={template.cards} columns={columns} />
    }
    case 'figures':
      return <Figures figures={template.figures} />
    case 'flowchart':
    case 'comparison':
    case 'causal':
    case 'timeline':
      return <NotYetImplemented kind={template.kind} />
  }
}

function NotYetImplemented({
  kind,
}: {
  kind: 'flowchart' | 'comparison' | 'causal' | 'timeline'
}) {
  // Mapping ticket de livraison cf. spec §10.
  const ticket: Record<typeof kind, string> = {
    flowchart: 'T4.2',
    comparison: 'T4.2',
    causal: 'T4.3',
    timeline: 'T4.2',
  }
  return (
    <div className="bg-[color:var(--color-bg-card)] border border-dashed border-white/20 rounded-lg p-6 text-center text-[color:var(--color-text-muted)]">
      Template <code className="text-ds-turquoise">{kind}</code> — à livrer
      dans {ticket[kind]}
    </div>
  )
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
