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

  // Listener `timeupdate` natif : seule source qui pousse `audio.currentTime`
  // vers le state React. Aucune écriture dans l'autre sens.
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
  // Workaround MP3 sans header Xing/LAME (POC-T3-D4) : double-set via
  // `currentTime = 0` pour forcer le décodeur audio à se reset proprement
  // entre deux positions. Sans ce workaround, `audio.currentTime` est mis
  // à jour côté JS mais le flux audio diffusé reste sur la position
  // d'origine — le décodeur a besoin d'un index Xing/LAME pour seek par
  // offset, et le pipeline ElevenLabs concatène les chunks sans en
  // produire. Le délai ~50 ms laisse au navigateur le temps de prendre
  // en compte le reset à 0 avant le seek vers la cible.
  // Le state React `currentTime` se met à jour via le listener timeupdate
  // natif déclenché par le navigateur après le seek effectif (pas de
  // setCurrentTime manuel ici, cf. fix2).
  // À terme, intégrer un header Xing dans le pipeline Python T2 v2.
  const handleSeek = useCallback((sec: number) => {
    const audio = audioRef.current
    if (!audio) return
    const wasPaused = audio.paused
    audio.currentTime = 0
    setTimeout(() => {
      audio.currentTime = sec
      if (!wasPaused) {
        audio.play().catch((err) => {
          // eslint-disable-next-line no-console
          console.error('Audio play failed after seek:', err)
        })
      }
    }, 50)
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
