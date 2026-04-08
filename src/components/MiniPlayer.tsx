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
  const heights = isPlaying ? [14, 20, 10] : [6, 6, 6]
  return (
    <div className="flex items-end gap-[3px] h-6 w-5">
      {heights.map((h, i) => (
        <div
          key={i}
          className={`w-[3px] rounded-full ${isPlaying ? 'animate-pulse' : ''}`}
          style={{
            backgroundColor: color,
            height: `${h}px`,
            animationDelay: `${i * 200}ms`,
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
      {/* Progress bar — 3px, at very top */}
      <div
        ref={progressBarRef}
        onClick={handleProgressClick}
        className="h-[3px] bg-gray-100 cursor-pointer relative"
      >
        <div
          className="absolute top-0 left-0 h-full rounded-r-full transition-[width] duration-300"
          style={{
            width: `${progressPercent}%`,
            backgroundColor: state.accentColor,
          }}
        />
      </div>

      {/* Player body — 64px, white, subtle border */}
      <div className="bg-white border-t border-gray-100 h-16 px-4 flex items-center gap-3">
        {/* Wave icon */}
        <WaveIcon isPlaying={state.isPlaying} color={state.accentColor} />

        {/* Title + time */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
            {state.sequenceTitle}
          </p>
          <p className="text-xs text-gray-400 truncate leading-tight mt-0.5">
            {formatTime(state.currentTime)} / {formatTime(state.duration)}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5">
          {/* Skip back 15s */}
          <button
            onClick={handleSkipBack}
            className="p-2 rounded-full hover:bg-gray-50 active:scale-95 transition-all"
            aria-label="Reculer 15s"
          >
            <RotateCcw size={20} className="text-gray-400" />
          </button>

          {/* Play / Pause — 40px circle */}
          <button
            onClick={handleTogglePlay}
            className="w-10 h-10 rounded-full flex items-center justify-center active:scale-95 transition-all shadow-md"
            style={{ backgroundColor: state.accentColor }}
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? (
              <Pause size={18} className="text-white" fill="white" />
            ) : (
              <Play size={18} className="text-white ml-0.5" fill="white" />
            )}
          </button>

          {/* Skip forward 15s */}
          <button
            onClick={handleSkipForward}
            className="p-2 rounded-full hover:bg-gray-50 active:scale-95 transition-all"
            aria-label="Avancer 15s"
          >
            <RotateCw size={20} className="text-gray-400" />
          </button>

          {/* Close — discret */}
          <button
            onClick={closePlayer}
            className="p-2 rounded-full hover:bg-gray-50 active:scale-95 transition-all"
            aria-label="Fermer le lecteur"
          >
            <X size={18} className="text-gray-300" />
          </button>
        </div>
      </div>
    </div>
  )
}
