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
 *
 * 🔧 [POC-T3-fix3] Mode diagnostic actif :
 *  - Logs invasifs `[POC-T3-DEBUG]` sur le seek (avant/après) et sur les
 *    events `seeked` / `error`.
 *  - handleSeek "force-reload" via pause → currentTime = sec → load() →
 *    currentTime = sec → play si nécessaire. Si avec ce pattern le seek
 *    devient audible, on aura confirmé que le bug vient du seek silencieux
 *    du navigateur sur le MP3 ElevenLabs (probable header Xing/LAME absent
 *    → seek par offset estimé non fiable).
 *  À retirer une fois le diagnostic posé.
 */

interface KaraokePOCClientProps {
  sequenceTitle: string
  timelineUrl: string | null
  audioUrl: string
}

// Helpers debug — extrait `audio.buffered` en tableau JSON-serializable.
function snapshotBuffered(audio: HTMLAudioElement): Array<[number, number]> {
  const out: Array<[number, number]> = []
  for (let i = 0; i < audio.buffered.length; i++) {
    out.push([audio.buffered.start(i), audio.buffered.end(i)])
  }
  return out
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

  // Listener `timeupdate` natif sur l'élément audio + listeners debug
  // (`seeked`, `error`) ajoutés en parallèle, pas de remplacement.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // [POC-T3-DEBUG] Snapshot initial au mount.
    // eslint-disable-next-line no-console
    console.log('[POC-T3-DEBUG] mount audio:', {
      src: audio.src,
      preload: audio.preload,
      crossOrigin: audio.crossOrigin,
      readyState: audio.readyState,
      networkState: audio.networkState,
    })

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleSeeked = () => {
      // eslint-disable-next-line no-console
      console.log('[POC-T3-DEBUG] seeked event:', {
        currentTime: audio.currentTime,
        buffered: snapshotBuffered(audio),
        paused: audio.paused,
        readyState: audio.readyState,
      })
    }
    const handleError = () => {
      // eslint-disable-next-line no-console
      console.error('[POC-T3-DEBUG] error event:', {
        code: audio.error?.code,
        message: audio.error?.message,
      })
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('seeked', handleSeeked)
    audio.addEventListener('error', handleError)
    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('seeked', handleSeeked)
      audio.removeEventListener('error', handleError)
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
  // [POC-T3-fix3] Variante "force-reload" : pause → currentTime = sec →
  // load() (force une nouvelle range request HTTP) → currentTime = sec →
  // play si nécessaire. Le double `currentTime = sec` encadre `load()` car
  // ce dernier reset l'état interne et oublierait sinon la cible.
  const handleSeek = useCallback((sec: number) => {
    const audio = audioRef.current
    if (!audio) return
    const wasPaused = audio.paused

    // eslint-disable-next-line no-console
    console.log('[POC-T3-DEBUG] before seek:', {
      requested: sec,
      currentTime: audio.currentTime,
      paused: audio.paused,
      readyState: audio.readyState,
      networkState: audio.networkState,
      buffered: snapshotBuffered(audio),
    })

    audio.pause()
    audio.currentTime = sec
    audio.load()
    audio.currentTime = sec
    if (!wasPaused) {
      audio.play().catch((e) => {
        // eslint-disable-next-line no-console
        console.error('[POC-T3-DEBUG] play failed:', e)
      })
    }

    // eslint-disable-next-line no-console
    console.log('[POC-T3-DEBUG] after seek:', {
      requested: sec,
      currentTime: audio.currentTime,
      paused: audio.paused,
      readyState: audio.readyState,
      networkState: audio.networkState,
      buffered: snapshotBuffered(audio),
    })
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
