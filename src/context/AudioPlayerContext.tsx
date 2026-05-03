'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react'

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface AudioTrack {
  url: string
  title: string
  duration_s?: number
  type: 'news' | 'journal' | 'formation'
  episodeId?: string
}

interface AudioPlayerContextValue {
  queue: AudioTrack[]
  currentIndex: number
  isPlaying: boolean
  // Remplace la queue par un track unique et démarre la lecture.
  playTrack: (track: AudioTrack) => void
  // Remplace la queue par la liste fournie (utilisée par la playlist /news).
  // startIndex permet de démarrer ailleurs qu'au premier élément.
  addToQueue: (tracks: AudioTrack[], opts?: { startIndex?: number }) => void
  clearQueue: () => void
  next: () => void
  prev: () => void
  setIsPlaying: (v: boolean) => void
  togglePlayPause: () => void
}

const AudioPlayerContext = createContext<AudioPlayerContextValue | null>(null)

// ----------------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------------

// Coexiste volontairement avec AudioContext.tsx (player formations DPC) qui
// reste seul propriétaire de course_watch_logs et des règles anti-skip.
// Ce Context-ci ne sert que pour la lecture passive News + Journal hebdo.

export function AudioPlayerProvider({ children }: { children: React.ReactNode }) {
  const [queue, setQueue] = useState<AudioTrack[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlayingState] = useState(false)

  const playTrack = useCallback((track: AudioTrack) => {
    setQueue([track])
    setCurrentIndex(0)
    setIsPlayingState(true)
  }, [])

  const addToQueue = useCallback(
    (tracks: AudioTrack[], opts?: { startIndex?: number }) => {
      if (tracks.length === 0) return
      const start = Math.min(
        Math.max(0, opts?.startIndex ?? 0),
        tracks.length - 1,
      )
      setQueue(tracks)
      setCurrentIndex(start)
      setIsPlayingState(true)
    },
    [],
  )

  const clearQueue = useCallback(() => {
    setQueue([])
    setCurrentIndex(0)
    setIsPlayingState(false)
  }, [])

  const next = useCallback(() => {
    setCurrentIndex((i) => {
      if (queue.length === 0) return 0
      return i < queue.length - 1 ? i + 1 : i
    })
  }, [queue.length])

  const prev = useCallback(() => {
    setCurrentIndex((i) => (i > 0 ? i - 1 : 0))
  }, [])

  const setIsPlaying = useCallback((v: boolean) => {
    setIsPlayingState(v)
  }, [])

  const togglePlayPause = useCallback(() => {
    setIsPlayingState((p) => !p)
  }, [])

  const value: AudioPlayerContextValue = {
    queue,
    currentIndex,
    isPlaying,
    playTrack,
    addToQueue,
    clearQueue,
    next,
    prev,
    setIsPlaying,
    togglePlayPause,
  }

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  )
}

// ----------------------------------------------------------------------------
// Hook
// ----------------------------------------------------------------------------

export function useAudioPlayer() {
  const ctx = useContext(AudioPlayerContext)
  if (!ctx) {
    throw new Error('useAudioPlayer must be used within AudioPlayerProvider')
  }
  return ctx
}
