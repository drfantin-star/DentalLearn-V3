'use client'

import React, { useEffect, useRef, useState } from 'react'

interface Props {
  queue: string[]
  initialIndex: number
  onClose: () => void
}

export default function AudioQueuePlayer({ queue, initialIndex, onClose }: Props) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [title, setTitle] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement>(null)

  const skipNext = () => {
    setCurrentIndex((i) => (i < queue.length - 1 ? i + 1 : i))
  }
  const skipPrev = () => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : i))
  }

  useEffect(() => {
    if (!queue[currentIndex]) return
    let cancelled = false
    setLoading(true)
    setAudioUrl(null)

    fetch(`/api/news/syntheses/${queue[currentIndex]}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        setTitle(data.synthesis?.display_title ?? '')
        if (data.episode?.audio_url) {
          setAudioUrl(data.episode.audio_url)
        } else {
          skipNext()
        }
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        skipNext()
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [currentIndex, queue])

  useEffect(() => {
    if (audioUrl && audioRef.current) {
      audioRef.current.play().catch(() => {})
      setIsPlaying(true)
    }
  }, [audioUrl])

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 mx-4">
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl px-4 py-3
                   flex items-center gap-3 shadow-2xl"
      >
        <div
          className="w-10 h-10 rounded-xl bg-violet-600 flex items-center
                     justify-center flex-shrink-0"
        >
          <span className="text-lg">📰</span>
        </div>

        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="h-3 bg-gray-700 rounded animate-pulse w-3/4" />
          ) : (
            <p className="text-white text-xs font-medium truncate">{title}</p>
          )}
          <p className="text-gray-500 text-xs mt-0.5">
            {currentIndex + 1} / {queue.length}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={skipPrev}
            disabled={currentIndex === 0}
            className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition"
            aria-label="Précédent"
          >
            ⏮
          </button>
          <button
            type="button"
            onClick={() => {
              if (!audioRef.current) return
              if (isPlaying) {
                audioRef.current.pause()
              } else {
                audioRef.current.play().catch(() => {})
              }
            }}
            disabled={loading || !audioUrl}
            className="w-9 h-9 rounded-full bg-violet-600 hover:bg-violet-500
                       flex items-center justify-center disabled:opacity-30 transition"
            aria-label={isPlaying ? 'Pause' : 'Lecture'}
          >
            {loading ? (
              <div
                className="w-3 h-3 border border-white border-t-transparent
                           rounded-full animate-spin"
              />
            ) : isPlaying ? (
              '⏸'
            ) : (
              '▶'
            )}
          </button>
          <button
            type="button"
            onClick={skipNext}
            disabled={currentIndex === queue.length - 1}
            className="p-1.5 text-gray-400 hover:text-white disabled:opacity-30 transition"
            aria-label="Suivant"
          >
            ⏭
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white transition ml-1"
            aria-label="Fermer le lecteur"
          >
            ✕
          </button>
        </div>

        <audio
          ref={audioRef}
          src={audioUrl ?? undefined}
          onEnded={skipNext}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          className="hidden"
        />
      </div>
    </div>
  )
}
