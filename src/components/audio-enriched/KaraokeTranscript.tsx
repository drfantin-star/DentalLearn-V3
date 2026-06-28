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
 * Composant karaoke : affiche un transcript avec mot actif surlignes, switch
 * Sophie/Martin via badge, et auto-scroll vers le segment courant.
 *
 * Controle par les props : `currentTime` est pilote par le parent (element
 * `<audio>` HTML natif), `onSeek` est appele lors d'un click sur un mot.
 * Le composant ne fait JAMAIS de seek lui-meme -- il est purement presentation.
 *
 * Memorisation : `<KaraokeWord>` est deja memorise sur `(text, isActive, isPast)`
 * -- donc meme si la fonction parent re-run son `map`, seuls les 1-2 mots dont
 * l'etat change declenchent un vrai re-render. C'est suffisant pour les ~1600
 * mots du pilote sans introduire un memo de segment supplementaire.
 *
 * variant='single' : affiche uniquement la phrase en cours, centree, avec
 * surlignage teal des termes-cles de la timeline. Pas de badge locuteur.
 */

interface KaraokeTranscriptProps {
  transcript: Timeline['transcript']
  currentTime: number
  onSeek?: (sec: number) => void
  autoScroll?: boolean
  className?: string
  variant?: 'full' | 'single'
  concepts?: Timeline['concepts']
}

const MANUAL_SCROLL_PAUSE_MS = 5000

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .trim()
}

export function KaraokeTranscript({
  transcript,
  currentTime,
  onSeek,
  autoScroll = true,
  className,
  variant = 'full',
  concepts = [],
}: KaraokeTranscriptProps) {
  // Aplatissement memorise : ne change que si la reference du transcript change.
  const flatWords = useMemo(() => flattenTranscript(transcript), [transcript])

  // Mot actif throttle a 4 Hz par useCurrentWord.
  const activeWord = useCurrentWord(flatWords, currentTime)

  // Refs par segment pour scrollIntoView.
  const segmentRefs = useRef<Array<HTMLDivElement | null>>([])
  const containerRef = useRef<HTMLDivElement | null>(null)

  // Timestamp du dernier scroll manuel pour suspendre l'auto-scroll
  // pendant MANUAL_SCROLL_PAUSE_MS.
  const manualScrollAtRef = useRef<number>(0)

  // Tracking du dernier segment auto-scrolle pour ne declencher que sur
  // changement de segment actif (pas a chaque tick de currentTime).
  const lastScrolledSegmentRef = useRef<number>(-1)

  // Dernier segment affiche en mode single pour eviter le clignotement
  // pendant les silences entre segments.
  const lastShownSegmentRef = useRef<number>(0)

  const handleManualScroll = useCallback(() => {
    manualScrollAtRef.current = Date.now()
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.addEventListener('wheel', handleManualScroll, { passive: true })
    el.addEventListener('touchmove', handleManualScroll, { passive: true })
    return () => {
      el.removeEventListener('wheel', handleManualScroll)
      el.removeEventListener('touchmove', handleManualScroll)
    }
  }, [handleManualScroll])

  const activeSegmentIndex = activeWord?.segmentIndex ?? -1
  const activeWordIndex = activeWord?.wordIndex ?? -1

  // POC-T7.4a-G (D7-11) -- Detection du mode "fenetre Spotify" : actif quand le
  // container a un overflow effectif (mobile, `max-h-[180px] overflow-y-auto`),
  // inactif sur desktop ou `md:max-h-none md:overflow-visible` laisse le wrapper
  // parent (Variante A T7.2 internal-scroll grid) gerer le scroll.
  const isWindowedMode = (el: HTMLElement | null): boolean =>
    !!el && el.scrollHeight > el.clientHeight + 1

  // Auto-scroll segment-level (desktop).
  useEffect(() => {
    if (variant === 'single') return
    if (!autoScroll) return
    if (activeSegmentIndex < 0) return
    if (activeSegmentIndex === lastScrolledSegmentRef.current) return

    const sinceManualScroll = Date.now() - manualScrollAtRef.current
    if (sinceManualScroll < MANUAL_SCROLL_PAUSE_MS) return

    const containerEl = containerRef.current
    if (isWindowedMode(containerEl)) {
      lastScrolledSegmentRef.current = activeSegmentIndex
      return
    }

    const targetEl = segmentRefs.current[activeSegmentIndex]
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      lastScrolledSegmentRef.current = activeSegmentIndex
    }
  }, [autoScroll, activeSegmentIndex, variant])

  // Auto-scroll mot-level (mobile uniquement, mode fenetre).
  useEffect(() => {
    if (variant === 'single') return
    if (!autoScroll) return
    if (activeSegmentIndex < 0 || activeWordIndex < 0) return

    const sinceManualScroll = Date.now() - manualScrollAtRef.current
    if (sinceManualScroll < MANUAL_SCROLL_PAUSE_MS) return

    const containerEl = containerRef.current
    if (!isWindowedMode(containerEl)) return
    if (!containerEl) return

    const wordEl = containerEl.querySelector<HTMLElement>(
      `[data-word-key="${activeSegmentIndex}-${activeWordIndex}"]`
    )
    if (!wordEl) return

    const containerRect = containerEl.getBoundingClientRect()
    const wordRect = wordEl.getBoundingClientRect()
    const wordTopInContainer = wordRect.top - containerRect.top
    const wordBottomInContainer = wordRect.bottom - containerRect.top

    if (
      wordTopInContainer >= 0 &&
      wordBottomInContainer <= containerEl.clientHeight
    ) {
      return
    }

    const targetScrollTop =
      containerEl.scrollTop +
      wordTopInContainer -
      containerEl.clientHeight / 2 +
      wordRect.height / 2
    containerEl.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  }, [autoScroll, activeSegmentIndex, activeWordIndex, variant])

  // Sequences de tokens pour chaque terme-cle (recalcule uniquement si concepts change).
  const conceptTokenSequences = useMemo(() => {
    if (!concepts || concepts.length === 0) return []
    return concepts
      .filter(
        (c) =>
          typeof c.term === 'string' &&
          c.term.trim() !== '' &&
          c.hidden !== true
      )
      .map((c) =>
        normalize(c.term)
          .split(' ')
          .filter((t) => t !== '')
      )
      .filter((seq) => seq.length > 0)
  }, [concepts])

  // --- Mode single ---
  if (variant === 'single') {
    if (activeSegmentIndex >= 0) {
      lastShownSegmentRef.current = activeSegmentIndex
    }
    const indexToShow = lastShownSegmentRef.current

    if (!transcript || !transcript.segments.length) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-lg md:text-xl leading-relaxed text-white/40">
          ...
        </div>
      )
    }

    const segment = transcript.segments[indexToShow]
    if (!segment) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-6 text-center text-lg md:text-xl leading-relaxed text-white/40">
          ...
        </div>
      )
    }

    const words = segment.words
    const rendered: React.ReactNode[] = []
    let i = 0
    while (i < words.length) {
      let matched = false

      for (const seq of conceptTokenSequences) {
        if (i + seq.length > words.length) continue
        const allMatch = seq.every((token, offset) => {
          const w = words[i + offset]
          return w !== undefined && normalize(w.text) === token
        })
        if (allMatch) {
          const matchedText = words
            .slice(i, i + seq.length)
            .map((w) => w.text)
            .join(' ')
          rendered.push(
            <span key={`kw-${i}`} className="text-accent font-semibold">
              {matchedText}
            </span>
          )
          i += seq.length
          if (i < words.length) rendered.push(' ')
          matched = true
          break
        }
      }

      if (!matched) {
        rendered.push(
          <span key={`kw-${i}`} className="text-white">
            {words[i].text}
          </span>
        )
        i++
        if (i < words.length) rendered.push(' ')
      }
    }

    return (
      <div className="mx-auto max-w-3xl px-4 py-6 text-center text-lg md:text-xl leading-relaxed">
        {rendered}
      </div>
    )
  }

  // --- Mode full (defaut) ---

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
      className={`mx-auto max-w-3xl space-y-6 py-4 max-h-[180px] overflow-y-auto md:max-h-none md:overflow-visible ${className ?? ''}`}
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
                  <span
                    key={wordIndex}
                    data-word-key={`${segmentIndex}-${wordIndex}`}
                  >
                    <KaraokeWord
                      text={word.text}
                      isActive={isActive}
                      isPast={isPast}
                      startSec={word.start_sec}
                      onSeek={onSeek}
                    />
                  </span>
                )
              })}
            </p>
          </div>
        )
      })}
    </div>
  )
}
