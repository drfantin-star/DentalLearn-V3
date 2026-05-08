'use client'

import { useEffect, useRef } from 'react'

import { StructuredWhiteboard } from '@/components/audio-enriched/StructuredWhiteboard'
import type { Scene } from '@/lib/timeline/schema'

/**
 * Centre éditeur — audio HTML natif + whiteboard (POC-T6 patches B+C).
 *
 * Architecture (CONTRAINTE T3) :
 *  - On NE TOUCHE PAS à `AudioContext`. Player audio = `<audio>` HTML natif
 *    isolé.
 *
 * Comportement UX simplifié (Patch C — décision Dr Fantin option β) :
 *  - Pas de toggle "Figer / Suivre". Le parent contrôle quelle scène
 *    afficher via la prop `sceneToRender` (calculée à partir de l'état
 *    `isPlaying` + `currentTime` + `selectedSceneId`).
 *  - Listeners audio : `play` / `pause` (→ onPlayingChange),
 *    `timeupdate` (→ onTimeUpdate), `loadedmetadata` (→ onDurationDetected).
 *
 * Contrat preview (Patch B) : `<StructuredWhiteboard>` reçoit un tableau
 * d'1 seule scène (la scène à rendre) + un `currentTime` synthétique
 * placé à `start_sec + 0.5s` pour garantir que `getActiveScene` la
 * retourne. Plus de conflit entre `currentTime` audio et sélection
 * sidebar.
 */

interface Props {
  audioUrl: string
  sceneToRender: Scene | null
  onTimeUpdate: (currentTime: number) => void
  onPlayingChange: (isPlaying: boolean) => void
  onDurationDetected?: (duration: number) => void
  /** Forwarded depuis le parent pour permettre les seek programmatiques
   *  (ex : à la sélection d'une scène en sidebar). */
  audioRef: React.MutableRefObject<HTMLAudioElement | null>
}

export function TimelinePreviewPanel({
  audioUrl,
  sceneToRender,
  onTimeUpdate,
  onPlayingChange,
  onDurationDetected,
  audioRef,
}: Props) {
  // Listeners attachés via useEffect pour garantir cleanup et accès
  // au DOM réel (pas via React onTimeUpdate qui throttle).
  const localRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const el = localRef.current
    if (!el) return
    audioRef.current = el

    const handleTimeUpdate = () => onTimeUpdate(el.currentTime)
    const handlePlay = () => onPlayingChange(true)
    const handlePause = () => onPlayingChange(false)
    const handleLoadedMetadata = () => {
      if (
        !Number.isNaN(el.duration) &&
        Number.isFinite(el.duration) &&
        el.duration > 0
      ) {
        onDurationDetected?.(el.duration)
      }
    }

    el.addEventListener('timeupdate', handleTimeUpdate)
    el.addEventListener('play', handlePlay)
    el.addEventListener('pause', handlePause)
    el.addEventListener('loadedmetadata', handleLoadedMetadata)

    // Si les métadonnées sont déjà chargées (cache HTTP), trigger manuel.
    if (el.readyState >= 1) handleLoadedMetadata()

    return () => {
      el.removeEventListener('timeupdate', handleTimeUpdate)
      el.removeEventListener('play', handlePlay)
      el.removeEventListener('pause', handlePause)
      el.removeEventListener('loadedmetadata', handleLoadedMetadata)
      if (audioRef.current === el) audioRef.current = null
    }
  }, [audioRef, onTimeUpdate, onPlayingChange, onDurationDetected])

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-[color:var(--color-bg-card)]/40 p-4">
        <audio
          ref={localRef}
          src={audioUrl}
          controls
          preload="metadata"
          className="w-full"
        />
      </div>

      {sceneToRender ? (
        <StructuredWhiteboard
          scenes={[sceneToRender]}
          currentTime={sceneToRender.start_sec + 0.5}
        />
      ) : (
        <div className="rounded-xl bg-[color:var(--color-bg-card)]/30 p-8 text-center text-sm italic text-[color:var(--color-text-muted)]">
          Sélectionne une scène à gauche pour voir l&apos;aperçu.
        </div>
      )}
    </div>
  )
}
