'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'

import { useCurrentWord } from '@/hooks/useCurrentWord'
import { flattenTranscript } from '@/lib/timeline/findCurrentWord'
import type { Timeline } from '@/lib/timeline/schema'

import { KaraokeWord } from './KaraokeWord'
import { SpeakerBadge } from './SpeakerBadge'

/**
 * Composant karaoké : affiche un transcript avec mot actif surligné, switch
 * Sophie/Martin via badge, et auto-scroll vers le segment courant.
 *
 * Contrôlé par les props : `currentTime` est piloté par le parent (élément
 * `<audio>` HTML natif), `onSeek` est appelé lors d'un click sur un mot.
 * Le composant ne fait JAMAIS de seek lui-même — il est purement présentation.
 *
 * Mémoïsation : `<KaraokeWord>` est déjà mémoïsé sur `(text, isActive, isPast)`
 * — donc même si la fonction parent re-run son `map`, seuls les 1-2 mots dont
 * l'état change déclenchent un vrai re-render. C'est suffisant pour les ~1600
 * mots du pilote sans introduire un memo de segment supplémentaire.
 */

interface KaraokeTranscriptProps {
  transcript: Timeline['transcript']
  currentTime: number
  onSeek?: (sec: number) => void
  autoScroll?: boolean
  className?: string
}

const MANUAL_SCROLL_PAUSE_MS = 5000

export function KaraokeTranscript({
  transcript,
  currentTime,
  onSeek,
  autoScroll = true,
  className,
}: KaraokeTranscriptProps) {
  // Aplatissement mémoïsé : ne change que si la référence du transcript change.
  const flatWords = useMemo(() => flattenTranscript(transcript), [transcript])

  // Mot actif throttlé à 4 Hz par useCurrentWord.
  const activeWord = useCurrentWord(flatWords, currentTime)

  // Refs par segment pour scrollIntoView.
  const segmentRefs = useRef<Array<HTMLDivElement | null>>([])
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Timestamp du dernier scroll manuel pour suspendre l'auto-scroll
  // pendant MANUAL_SCROLL_PAUSE_MS.
  const manualScrollAtRef = useRef<number>(0)

  // Tracking du dernier segment auto-scrollé pour ne déclencher que sur
  // changement de segment actif (pas à chaque tick de currentTime).
  const lastScrolledSegmentRef = useRef<number>(-1)

  const handleManualScroll = useCallback(() => {
    manualScrollAtRef.current = Date.now()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    // Wheel + touchmove couvrent desktop souris/trackpad et mobile.
    el.addEventListener('wheel', handleManualScroll, { passive: true })
    el.addEventListener('touchmove', handleManualScroll, { passive: true })
    return () => {
      el.removeEventListener('wheel', handleManualScroll)
      el.removeEventListener('touchmove', handleManualScroll)
    }
  }, [handleManualScroll])

  const activeSegmentIndex = activeWord?.segmentIndex ?? -1
  const activeWordIndex = activeWord?.wordIndex ?? -1

  // Auto-scroll : déclenché quand le segment actif change, sauf si l'utilisateur
  // a scrollé manuellement il y a moins de 5 s.
  useEffect(() => {
    if (!autoScroll) return
    if (activeSegmentIndex < 0) return
    if (activeSegmentIndex === lastScrolledSegmentRef.current) return

    const sinceManualScroll = Date.now() - manualScrollAtRef.current
    if (sinceManualScroll < MANUAL_SCROLL_PAUSE_MS) return

    const targetEl = segmentRefs.current[activeSegmentIndex]
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      lastScrolledSegmentRef.current = activeSegmentIndex
    }
  }, [autoScroll, activeSegmentIndex])

  // Cas vide : transcript absent ou aucun segment.
  if (!transcript || !transcript.segments.length) {
    return (
      <div
        className={`mx-auto max-w-3xl py-8 text-center text-sm text-[color:var(--color-text-muted)] ${className ?? ''}`}
      >
        Pas de transcript disponible.
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className={`mx-auto max-w-3xl space-y-6 py-4 ${className ?? ''}`}
    >
      {transcript.segments.map((segment, segmentIndex) => {
        const isPastSegment =
          activeSegmentIndex >= 0 && segmentIndex < activeSegmentIndex
        const isCurrentSegment = segmentIndex === activeSegmentIndex

        return (
          <div
            key={segmentIndex}
            ref={(el) => {
              segmentRefs.current[segmentIndex] = el
            }}
            className="rounded-lg bg-[color:var(--color-bg-card)]/30 p-4"
          >
            <div className="mb-2">
              <SpeakerBadge speaker={segment.speaker} />
            </div>
            <p className="text-base leading-relaxed">
              {segment.words.map((word, wordIndex) => {
                const isActive =
                  isCurrentSegment && wordIndex === activeWordIndex
                const isPast =
                  isPastSegment ||
                  (isCurrentSegment && wordIndex < activeWordIndex)
                return (
                  <KaraokeWord
                    key={wordIndex}
                    text={word.text}
                    isActive={isActive}
                    isPast={isPast}
                    startSec={word.start_sec}
                    onSeek={onSeek}
                  />
                )
              })}
            </p>
          </div>
        )
      })}
    </div>
  )
}
