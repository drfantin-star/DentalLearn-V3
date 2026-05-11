'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'

import { Causal } from '@/components/audio-enriched/templates/Causal'
import { Comparison } from '@/components/audio-enriched/templates/Comparison'
import { Figures } from '@/components/audio-enriched/templates/Figures'
import { Flowchart } from '@/components/audio-enriched/templates/Flowchart'
import { Grid } from '@/components/audio-enriched/templates/Grid'
import { Recap } from '@/components/audio-enriched/templates/Recap'
import { TimelineTemplate } from '@/components/audio-enriched/templates/Timeline'
import type { Scene, SceneTemplate, Timeline } from '@/lib/timeline/schema'

/**
 * T8-D — `<NewsVisualSequence>` : panneau enrichi qui défile les scènes d'une
 * timeline news alignées sur la synthèse audio courante.
 *
 * Architecture (rappel décisions Q-T8-1=a, Q-T8-3=b) :
 *  - Autonome : ne consomme PAS `useAudio` (AudioContext formations DPC).
 *  - Lit `currentSynthesisIndex` + `isPlaying` passés en props (calculés par
 *    le parent via `useAudioPlayer().currentIndex` + `queue[currentIndex]
 *    .episodeId === episodeId`).
 *  - Pas de couplage `currentTime` global : un timer interne (250 ms tick)
 *    progresse l'index de scène locale au rythme des durées de scène
 *    (`scene.end_sec - scene.start_sec`) tant que `isPlaying === true`.
 *  - Sticky end : si le chapitre courant est consommé avant que la synthèse
 *    audio suivante prenne le relais, on reste sur la dernière scène (= scène
 *    recap, par convention de `buildNewsTimeline`).
 *
 * Dispatcher local interne `NewsSceneRenderer` : handle les 7 kinds (les 6
 * d'origine + `recap`). Volontairement dupliqué de `StructuredWhiteboard`
 * (interdit en modification T8) pour permettre l'ajout natif de `recap`
 * sans toucher au composant amont.
 */

const TICK_MS = 250

interface NewsVisualSequenceProps {
  timeline: Timeline
  currentSynthesisIndex: number
  isPlaying: boolean
  className?: string
}

export function NewsVisualSequence({
  timeline,
  currentSynthesisIndex,
  isPlaying,
  className,
}: NewsVisualSequenceProps) {
  const chapters = timeline.chapters
  const sceneCount = timeline.scenes.length

  // Garde-fou : si pas de chapitre ou de scène, on ne rend rien.
  if (chapters.length === 0 || sceneCount === 0) {
    return null
  }

  const clampedIndex = Math.max(
    0,
    Math.min(currentSynthesisIndex, chapters.length - 1),
  )
  const currentChapter = chapters[clampedIndex]

  const chapterScenes = timeline.scenes.filter(
    (s) =>
      s.start_sec >= currentChapter.start_sec &&
      s.end_sec <= currentChapter.end_sec + 0.001,
  )

  const [localSceneIndex, setLocalSceneIndex] = useState(0)
  // Temps écoulé depuis le début du chapitre courant, en secondes.
  const elapsedRef = useRef(0)

  // Reset quand la synthèse change (passage au chapitre suivant).
  useEffect(() => {
    setLocalSceneIndex(0)
    elapsedRef.current = 0
  }, [clampedIndex])

  // Timer interne : avance le compteur tant que isPlaying.
  useEffect(() => {
    if (!isPlaying) return
    if (chapterScenes.length === 0) return

    const interval = setInterval(() => {
      elapsedRef.current += TICK_MS / 1000

      // Cumul des durées des scènes jusqu'à l'index courant + 1.
      let cumulative = 0
      let nextIndex = 0
      for (let i = 0; i < chapterScenes.length; i++) {
        const sceneDur = chapterScenes[i].end_sec - chapterScenes[i].start_sec
        cumulative += sceneDur
        if (elapsedRef.current < cumulative) {
          nextIndex = i
          break
        }
        // Sticky end : si on dépasse la dernière scène, on y reste.
        nextIndex = chapterScenes.length - 1
      }

      setLocalSceneIndex((prev) => (prev !== nextIndex ? nextIndex : prev))
    }, TICK_MS)

    return () => clearInterval(interval)
  }, [isPlaying, chapterScenes])

  if (chapterScenes.length === 0) return null

  const activeScene = chapterScenes[Math.min(localSceneIndex, chapterScenes.length - 1)]

  return (
    <div
      className={`bg-[color:var(--color-bg-card)]/30 rounded-xl p-4 sm:p-5 ${className ?? ''}`}
    >
      {/* Progress dots — visibilité du nb de scènes dans le chapitre */}
      <div className="flex gap-1 mb-3 sm:mb-4" aria-hidden="true">
        {chapterScenes.map((_, i) => (
          <span
            key={i}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === localSceneIndex
                ? 'bg-ds-turquoise w-6'
                : i < localSceneIndex
                ? 'bg-ds-turquoise/40 w-3'
                : 'bg-white/10 w-3'
            }`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeScene.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: 0.25 } }}
          transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        >
          {activeScene.title && activeScene.template.kind !== 'recap' && (
            <h3 className="mb-3 text-[11px] uppercase tracking-wide text-[color:var(--color-text-muted)]">
              {activeScene.title}
            </h3>
          )}
          <NewsSceneRenderer template={activeScene.template} />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

/**
 * Dispatcher local — gère les 7 kinds (6 historiques + recap T8). Dupliqué
 * volontairement de `StructuredWhiteboard` qui est interdit en modification.
 */
function NewsSceneRenderer({ template }: { template: SceneTemplate }) {
  switch (template.kind) {
    case 'grid': {
      const columns = clampGridColumns(template.columns)
      return <Grid cards={template.cards} columns={columns} />
    }
    case 'figures':
      return <Figures figures={template.figures} />
    case 'flowchart':
      return (
        <Flowchart cards={template.cards} orientation={template.orientation} />
      )
    case 'comparison':
      return <Comparison left={template.left} right={template.right} />
    case 'timeline':
      return (
        <TimelineTemplate steps={template.steps} events={template.events} />
      )
    case 'causal':
      return (
        <Causal
          cause={template.cause}
          effects={template.effects}
          nodes={template.nodes}
          edges={template.edges}
        />
      )
    case 'recap':
      return (
        <Recap
          title={template.title}
          figures={template.figures}
          impact={template.impact}
          caveats={template.caveats}
        />
      )
  }
}

function clampGridColumns(n: number): 2 | 3 | 4 {
  if (n <= 2) return 2
  if (n >= 4) return 4
  return 3
}

// Garantit la non-utilisation de Scene en runtime (juste pour typage potentiel).
export type { Scene }
