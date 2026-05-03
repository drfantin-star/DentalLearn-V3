'use client'

import React, { useEffect, useRef } from 'react'
import { useAudioPlayer } from '@/context/AudioPlayerContext'

// AudioQueuePlayer (T11) : monté une seule fois dans (app)/layout.tsx,
// il consomme l'AudioPlayerContext (URL-based, voir context/AudioPlayerContext.tsx)
// au lieu de recevoir une queue en props. Le composant ne fait plus de fetch :
// toutes les pistes lui parviennent déjà résolues (url, title, duration_s).
//
// Comportement UI strictement identique à la version T10 (icône, position,
// boutons prev/play/pause/next/close). Pas de contrôle de vitesse.

export default function AudioQueuePlayer() {
  const {
    queue,
    currentIndex,
    isPlaying,
    next,
    prev,
    setIsPlaying,
    clearQueue,
  } = useAudioPlayer()

  const audioRef = useRef<HTMLAudioElement>(null)
  const currentTrack = queue[currentIndex]
  const audioUrl = currentTrack?.url ?? null

  // Synchronise l'élément <audio> avec l'état isPlaying du Context.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    if (!audioUrl) {
      audio.pause()
      return
    }
    if (isPlaying) {
      audio.play().catch(() => setIsPlaying(false))
    } else {
      audio.pause()
    }
  }, [isPlaying, audioUrl, setIsPlaying])

  // Quand la piste change, repart au début et relance la lecture.
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    audio.currentTime = 0
    audio.play().catch(() => setIsPlaying(false))
  }, [audioUrl, setIsPlaying])

  if (queue.length === 0 || !currentTrack) return null

  const isLast = currentIndex >= queue.length - 1
  const isFirst = currentIndex <= 0
  const isJournal = currentTrack.type === 'journal'

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 mx-4">
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3
                   flex items-center gap-3 shadow-2xl"
      >
        <div
          className={`w-10 h-10 rounded-xl flex items-center
                     justify-center flex-shrink-0 ${
                       isJournal ? 'bg-teal-600' : 'bg-violet-600'
                     }`}
        >
          <span className="text-lg">{isJournal ? '🎙️' : '📰'}</span>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate">
            {currentTrack.title}
          </p>
          <p className="text-gray-500 text-xs mt-0.5">
            {currentIndex + 1} / {queue.length}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={prev}
            disabled={isFirst}
            className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition"
            aria-label="Précédent"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            disabled={!audioUrl}
            className={`w-9 h-9 rounded-full flex items-center justify-center
                       disabled:opacity-30 transition ${
                         isJournal
                           ? 'bg-teal-600 hover:bg-teal-500'
                           : 'bg-violet-600 hover:bg-violet-500'
                       }`}
            aria-label={isPlaying ? 'Pause' : 'Lecture'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            type="button"
            onClick={next}
            disabled={isLast}
            className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition"
            aria-label="Suivant"
          >
            ⏭
          </button>
          <button
            type="button"
            onClick={clearQueue}
            className="p-1.5 text-gray-500 hover:text-white transition ml-1"
            aria-label="Fermer le lecteur"
          >
            ✕
          </button>
        </div>

        <audio
          ref={audioRef}
          src={audioUrl ?? undefined}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            if (isLast) {
              clearQueue()
            } else {
              next()
            }
          }}
          className="hidden"
        />
      </div>
    </div>
  )
}
