'use client'

import React, { useRef } from 'react'
import { usePathname } from 'next/navigation'
import { Play, Pause, RotateCcw, RotateCw, X } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'

// ============================================
// HELPERS
// ============================================

function formatTime(seconds: number): string {
  if (!seconds || isNaN(seconds)) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

// ============================================
// WAVE ICON (animated when playing)
// ============================================

function WaveIcon({ isPlaying, color }: { isPlaying: boolean; color: string }) {
  return (
    <div className="flex items-end gap-[3px] h-5 w-5">
      {[1, 2, 3].map(i => (
        <div
          key={i}
          className={`w-[3px] rounded-full ${isPlaying ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor: color,
            height: isPlaying ? `${8 + i * 4}px` : '6px',
            animationDelay: `${i * 150}ms`,
            transition: 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  )
}

// ============================================
// MINIPLAYER
// ============================================

export default function MiniPlayer() {
  const pathname = usePathname()
  const { state, pauseAudio, resumeAudio, seekTo, closePlayer } = useAudio()
  const progressBarRef = useRef<HTMLDivElement>(null)

  // Hidden pages
  const hiddenPaths = ['/login', '/register', '/admin']
  const isHidden = hiddenPaths.some(p => pathname.startsWith(p))

  // Don't render if no audio or on hidden pages
  if (!state.audioUrl || isHidden) return null

  const progressPercent = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0

  const handleTogglePlay = () => {
    if (state.isPlaying) {
      pauseAudio()
    } else {
      resumeAudio()
    }
  }

  const handleSkipBack = () => {
    seekTo(state.currentTime - 15)
  }

  const handleSkipForward = () => {
    seekTo(state.currentTime + 15)
  }

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressBarRef.current
    if (!bar || state.duration === 0) return
    const rect = bar.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    seekTo(percent * state.duration)
  }

  return (
    <div className="fixed bottom-16 left-0 right-0 z-40 safe-bottom">
      {/* Progress bar - thin, clickable, at the very top */}
      <div
        ref={progressBarRef}
        onClick={handleProgressClick}
        className="h-1 bg-gray-200 cursor-pointer relative"
      >
        <div
          className="absolute top-0 left-0 h-full transition-[width] duration-300"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: state.accentColor,
          }}
        />
      </div>

      {/* Player body */}
      <div
        className="bg-white shadow-lg border-t-2 px-3 py-2 flex items-center gap-3"
        style={{ borderTopColor: state.accentColor }}
      >
        {/* Wave icon */}
        <WaveIcon isPlaying={state.isPlaying} color={state.accentColor} />

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-800 truncate leading-tight">
            {state.sequenceTitle}
          </p>
          <p className="text-[11px] text-gray-400 truncate leading-tight">
            {state.formationTitle} — {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {/* Skip back 15s */}
          <button
            onClick={handleSkipBack}
            className="p-1.5 rounded-full hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Reculer 15s"
          >
            <RotateCcw size={18} className="text-gray-500" />
          </button>

          {/* Play / Pause */}
          <button
            onClick={handleTogglePlay}
            className="w-9 h-9 rounded-full flex items-center justify-center active:scale-95 transition-all"
            style={{ backgroundColor: state.accentColor }}
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? (
              <Pause size={16} className="text-white" fill="white" />
            ) : (
              <Play size={16} className="text-white ml-0.5" fill="white" />
            )}
          </button>

          {/* Skip forward 15s */}
          <button
            onClick={handleSkipForward}
            className="p-1.5 rounded-full hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Avancer 15s"
          >
            <RotateCw size={18} className="text-gray-500" />
          </button>

          {/* Close */}
          <button
            onClick={closePlayer}
            className="p-1.5 rounded-full hover:bg-gray-100 active:scale-95 transition-all ml-1"
            aria-label="Fermer le lecteur"
          >
            <X size={18} className="text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  )
}
