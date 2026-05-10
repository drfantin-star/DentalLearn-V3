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

  // POC-T7.4a-G (D7-11) — Détection du mode "fenêtre Spotify" : actif quand le
  // container a un overflow effectif (mobile, `max-h-[180px] overflow-y-auto`),
  // inactif sur desktop où `md:max-h-none md:overflow-visible` laisse le wrapper
  // parent (Variante A T7.2 internal-scroll grid) gérer le scroll. Le check
  // `scrollHeight > clientHeight + 1` est plus simple et stable que matchMedia
  // (suit l'élément réel, pas la viewport CSS) et évite un re-render React.
  const isWindowedMode = (el: HTMLElement | null): boolean =>
    !!el && el.scrollHeight > el.clientHeight + 1

  // Auto-scroll segment-level (desktop) : déclenché quand le segment actif change,
  // sauf si l'utilisateur a scrollé manuellement il y a moins de 5 s. Sur mobile
  // (mode fenêtre) on neutralise pour laisser le mot-level prendre la main.
  useEffect(() => {
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
  }, [autoScroll, activeSegmentIndex])

  // POC-T7.4a-G (D7-11) — Auto-scroll mot-level (mobile uniquement, mode fenêtre).
  // Garde-fou impératif : on ne scrolle QUE si le mot actif est hors fenêtre
  // visible du container (test getBoundingClientRect). Pas de scroll à chaque
  // tick 4Hz, sinon "scroll permanent" gênant. `containerEl.scrollTo` ne scrolle
  // que le container interne (pas la chaîne d'ancêtres comme ferait scrollIntoView).
  useEffect(() => {
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

    // Mot dans la fenêtre visible → ne rien faire.
    if (
      wordTopInContainer >= 0 &&
      wordBottomInContainer <= containerEl.clientHeight
    ) {
      return
    }

    // Mot hors fenêtre → scroll interne pour le centrer.
    const targetScrollTop =
      containerEl.scrollTop +
      wordTopInContainer -
      containerEl.clientHeight / 2 +
      wordRect.height / 2
    containerEl.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  }, [autoScroll, activeSegmentIndex, activeWordIndex])

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
    // POC-T7.4a-G (D7-11) — `max-h-[180px] overflow-y-auto` sur mobile crée la
    // "fenêtre Spotify" (~3 lignes visibles, scroll interne au mot actif piloté
    // par useEffect mot-level ci-dessus). `md:max-h-none md:overflow-visible`
    // restaure le comportement Variante A T7.2 sur desktop : le container interne
    // s'étire à la hauteur du contenu et c'est le wrapper grid parent
    // (`md:overflow-y-auto md:min-h-0` dans EnrichedAudioPlayer) qui scrolle, ce
    // qui préserve le auto-scroll segment-level desktop tel quel.
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
                // POC-T7.4a-G (D7-11) — wrapper inline porteur de
                // `data-word-key` consommé par le sélecteur CSS du useEffect
                // mot-level ci-dessus. `<KaraokeWord>` est interdit à modifier
                // (composant audio-enriched/), donc on l'enveloppe sans le
                // toucher. Le wrap est `display: inline` par défaut → aucun
                // impact sur le line-wrap du `<p>` parent.
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
