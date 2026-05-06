'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

import { KaraokeTranscript } from '@/components/audio-enriched/KaraokeTranscript'
import { useEnrichedTimeline } from '@/hooks/useEnrichedTimeline'
import { flattenTranscript } from '@/lib/timeline/findCurrentWord'

/**
 * Page client du POC karaoké. Utilise un <audio> HTML natif (PAS
 * AudioContext) — l'intégration avec le tracking DPC viendra en T7.
 *
 * Le seek libre sur les mots est attendu sur cette page de test admin.
 */

// Note POC-T3-D5 : seek-by-click sur les mots du transcript désactivé
// sur cette page POC.
//
// Symptôme observé : un seek JS (audio.currentTime = sec depuis un handler
// React) sur ce MP3 met à jour currentTime côté navigateur (events seeking,
// seeked, timeupdate firent normalement à la nouvelle position) mais le flux
// audio diffusé reste sur la position d'origine.
//
// Workarounds tentés sans succès :
//   - audio.load() avant set currentTime (aggrave le bug)
//   - double-set via currentTime = 0 puis setTimeout currentTime = sec
//
// Confirmation par test utilisateur : le seek natif via barre HTML5 est lui
// aussi partiellement cassé sur ce MP3 (drag arrière atterrit au mauvais
// endroit). Cause probable : pipeline Python ElevenLabs concatène les chunks
// sans réindexer un header Xing/LAME, ce qui prive le navigateur d'une table
// de mapping temps→byte fiable.
//
// Tracking : POC-T3-D4 — à corriger en T2-v2 par post-traitement Python
// (mutagen.mp3 ou ffmpeg) injectant un header Xing valide. Une fois corrigé,
// ré-activer simplement le passage de onSeek à KaraokeTranscript pour
// restaurer le seek-by-click.

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
          />
        )}
      </section>
    </main>
  )
}
