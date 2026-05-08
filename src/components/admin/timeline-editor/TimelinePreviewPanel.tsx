'use client'

import { useEffect, useRef } from 'react'

import { StructuredWhiteboard } from '@/components/audio-enriched/StructuredWhiteboard'
import type { Scene } from '@/lib/timeline/schema'

/**
 * Centre éditeur — audio HTML natif + whiteboard (POC-T6.1.c).
 *
 * Architecture (CONTRAINTE T3) :
 *  - On NE TOUCHE PAS à `AudioContext`. Player audio = `<audio>` HTML natif
 *    isolé. Listener `timeupdate` → setCurrentTime.
 *  - Toggle radio "fixed" / "sync" :
 *      * fixed : on positionne le seek de la scène sélectionnée + on lit
 *        la timeline whiteboard en stagnant à `start_sec + 0.5s` (pour que
 *        `getActiveScene` rende la scène).
 *      * sync : currentTime suit l'audio en lecture libre.
 */

interface Props {
  audioUrl: string
  scenes: Scene[]
  currentTime: number
  onTimeUpdate: (t: number) => void
  selectedScene: Scene | null
  audioMode: 'fixed' | 'sync'
  onAudioModeChange: (m: 'fixed' | 'sync') => void
}

export function TimelinePreviewPanel({
  audioUrl,
  scenes,
  currentTime,
  onTimeUpdate,
  selectedScene,
  audioMode,
  onAudioModeChange,
}: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Mode fixed : si l'utilisateur clique une autre scène, on saute le
  // currentTime au début de la scène (start_sec + 0.5s, marge de sécurité
  // pour que getActiveScene rende la scène et pas null).
  useEffect(() => {
    if (audioMode !== 'fixed') return
    if (!selectedScene) return
    const target = selectedScene.start_sec + 0.5
    onTimeUpdate(target)
    if (audioRef.current && Math.abs(audioRef.current.currentTime - target) > 0.5) {
      try {
        audioRef.current.currentTime = target
      } catch {
        // ignore — peut throw si l'audio n'est pas encore chargé
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScene?.id, audioMode])

  function handleTimeUpdate(e: React.SyntheticEvent<HTMLAudioElement>) {
    if (audioMode !== 'sync') return
    onTimeUpdate(e.currentTarget.currentTime)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl bg-[color:var(--color-bg-card)]/40 p-4">
        <audio
          ref={audioRef}
          src={audioUrl}
          controls
          preload="metadata"
          className="w-full"
          onTimeUpdate={handleTimeUpdate}
        />
        <div className="mt-3 flex items-center gap-4 text-xs">
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="audio-mode"
              value="fixed"
              checked={audioMode === 'fixed'}
              onChange={() => onAudioModeChange('fixed')}
              className="accent-ds-turquoise"
            />
            <span className="text-[color:var(--color-text-secondary)]">
              Figer sur la scène sélectionnée
            </span>
          </label>
          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="audio-mode"
              value="sync"
              checked={audioMode === 'sync'}
              onChange={() => onAudioModeChange('sync')}
              className="accent-ds-turquoise"
            />
            <span className="text-[color:var(--color-text-secondary)]">
              Suivre l&apos;audio
            </span>
          </label>
          <span className="ml-auto text-[10px] text-[color:var(--color-text-muted)]">
            t = {currentTime.toFixed(1)}s
          </span>
        </div>
      </div>

      {scenes.length > 0 ? (
        <StructuredWhiteboard scenes={scenes} currentTime={currentTime} />
      ) : (
        <div className="rounded-xl bg-[color:var(--color-bg-card)]/30 p-8 text-center text-sm italic text-[color:var(--color-text-muted)]">
          Sélectionne une scène à gauche pour voir l&apos;aperçu.
        </div>
      )}
    </div>
  )
}
