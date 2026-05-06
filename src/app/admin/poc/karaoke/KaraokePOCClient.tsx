'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { KaraokeTranscript } from '@/components/audio-enriched/KaraokeTranscript'
import { useEnrichedTimeline } from '@/hooks/useEnrichedTimeline'
import { flattenTranscript } from '@/lib/timeline/findCurrentWord'

/**
 * Page client du POC karaoké. Utilise un <audio> HTML natif (PAS
 * AudioContext) — l'intégration avec le tracking DPC viendra en T7.
 *
 * Le seek libre sur les mots est attendu sur cette page de test admin.
 */

interface KaraokePOCClientProps {
  sequenceTitle: string
  timelineUrl: string | null
  audioUrl: string
}

export function KaraokePOCClient({
  sequenceTitle,
  timelineUrl,
  audioUrl,
}: KaraokePOCClientProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [currentTime, setCurrentTime] = useState<number>(0)

  const {
    timeline,
    isLoading,
    error,
  } = useEnrichedTimeline(timelineUrl)

  // Listener `timeupdate` natif sur l'élément audio.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
    }
  }, [])

  const flatWords = useMemo(
    () => flattenTranscript(timeline?.transcript),
    [timeline?.transcript]
  )

  const wordsTotal = flatWords.length
  // Position approximative du mot en cours pour le compteur "X / Y" : on
  // refait un binary search côté composant via dichotomie inline pour éviter
  // d'extraire useCurrentWord ici aussi (le KaraokeTranscript a son propre
  // throttling — ce compteur peut se permettre d'être un poil moins précis).
  const wordCurrent = useMemo(() => {
    if (!flatWords.length) return 0
    let lo = 0
    let hi = flatWords.length - 1
    let candidate = -1
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1
      if (flatWords[mid].start_sec <= currentTime) {
        candidate = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return candidate + 1 // 1-indexed pour l'affichage
  }, [flatWords, currentTime])

  // useCallback pour stabiliser la référence : `KaraokeWord` est mémoïsé sur
  // `onSeek === prev.onSeek`. Sans cela, chaque render parent invaliderait la
  // mémoïsation de TOUS les mots et le handler attaché au DOM serait stale.
  //
  // Une seule source de vérité : on touche UNIQUEMENT à `audio.currentTime`.
  // Le state React `currentTime` est synchronisé EXCLUSIVEMENT par le listener
  // `timeupdate` (cf. useEffect ci-dessus). Le navigateur émet un `timeupdate`
  // immédiatement après tout seek, donc le state se met à jour spontanément.
  //
  // ⚠️ Ne PAS faire `setCurrentTime(sec)` ici : la double écriture
  // (audio.currentTime + state) crée une race avec un `timeupdate` portant
  // potentiellement l'ancienne valeur "en vol" pendant le buffering du seek,
  // ce qui se manifeste comme un re-seek perçu (mini-silence + 2-3 syllabes
  // rejouées + reprise depuis l'ancienne position).
  const handleSeek = useCallback((sec: number) => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = sec
  }, [])

  return (
    <main className="mx-auto max-w-4xl p-6">
      <header className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
          POC Karaoké · Admin
        </p>
        <h1 className="text-2xl font-bold text-white">{sequenceTitle}</h1>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[color:var(--color-text-muted)]">
          <span>
            Audio :{' '}
            <code className="break-all">{audioUrl}</code>
          </span>
          {timelineUrl && (
            <span>
              Timeline :{' '}
              <code className="break-all">{timelineUrl}</code>
            </span>
          )}
        </div>
      </header>

      <section className="mb-6">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio
          ref={audioRef}
          controls
          src={audioUrl}
          className="w-full"
          preload="metadata"
        />
      </section>

      <section className="mb-6 flex items-center gap-4 text-xs text-[color:var(--color-text-muted)]">
        <span>
          Mot {wordCurrent} / {wordsTotal}
        </span>
        <span>·</span>
        <span>
          {currentTime.toFixed(1)}s
          {timeline?.duration_sec
            ? ` / ${timeline.duration_sec.toFixed(1)}s`
            : ''}
        </span>
      </section>

      <section>
        {!timelineUrl && (
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Aucun timeline_url enregistré pour cette séquence.
          </p>
        )}
        {timelineUrl && isLoading && (
          <p className="text-sm text-[color:var(--color-text-muted)]">
            Chargement du timeline…
          </p>
        )}
        {timelineUrl && error && (
          <p className="text-sm text-red-400">
            Erreur de chargement : {error.message}
          </p>
        )}
        {timeline && (
          <KaraokeTranscript
            transcript={timeline.transcript}
            currentTime={currentTime}
            onSeek={handleSeek}
          />
        )}
      </section>
    </main>
  )
}
