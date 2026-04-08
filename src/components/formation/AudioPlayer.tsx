'use client'

import React from 'react'
import { Play, Pause } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'

// ============================================
// TYPES
// ============================================

interface AudioPlayerProps {
  src: string
  duration: number // en secondes (depuis course_duration_seconds)
  sequenceId: string
  onComplete: () => void
  onProgress: (percent: number) => void
  accentColor?: string
  accentColorSecondary?: string
  sequenceTitle?: string
  formationTitle?: string
  userId?: string
}

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
// COMPOSANT AUDIOPLAYER (simplifié)
// Les logs DPC sont gérés dans AudioContext.
// ============================================

export default function AudioPlayer({
  src,
  duration,
  sequenceId,
  onComplete,
  onProgress,
  accentColor = '#2D1B96',
  accentColorSecondary = '#00D1C1',
  sequenceTitle = 'Cours audio',
  formationTitle = '',
  userId = '',
}: AudioPlayerProps) {
  const { state, playAudio, pauseAudio } = useAudio()

  const isThisTrack = state.audioUrl === src
  const isPlaying = isThisTrack && state.isPlaying

  const handleToggle = () => {
    if (isPlaying) {
      pauseAudio()
    } else {
      playAudio({
        audioUrl: src,
        sequenceTitle,
        formationTitle,
        accentColor,
        sequenceId,
        userId,
        duration,
        onComplete,
        onProgress,
      })
    }
  }

  const currentDuration = (isThisTrack ? state.duration : 0) || duration
  const currentPos = isThisTrack ? state.currentTime : 0
  const progressPercent = currentDuration > 0 ? (currentPos / currentDuration) * 100 : 0

  return (
    <div className="w-full">
      <div className="rounded-2xl shadow-sm overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColorSecondary})` }}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0">
            <span className="text-lg">🎧</span>
          </div>
          <p className="text-white font-bold text-lg leading-snug flex-1 line-clamp-2">
            {sequenceTitle}
          </p>
        </div>

        {/* Timer pill */}
        <div className="flex justify-center px-5 pb-2">
          <div className="bg-white/20 backdrop-blur-sm px-4 py-1 rounded-full">
            <span className="text-white text-sm font-semibold tabular-nums">
              {formatTime(currentPos)} / {formatTime(currentDuration)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-5 pb-4">
          <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Bouton Écouter */}
        <div className="px-5 pb-5 flex justify-center">
          <button
            onClick={handleToggle}
            className="flex items-center gap-3 px-8 py-3.5 rounded-2xl font-bold text-sm shadow-lg transition-transform active:scale-95"
            style={{
              background: 'rgba(255,255,255,0.2)',
              backdropFilter: 'blur(8px)',
              color: 'white',
            }}
          >
            {isPlaying ? (
              <>
                <Pause size={20} fill="white" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={20} fill="white" className="ml-0.5" />
                <span>{isThisTrack && state.currentTime > 0 ? 'Reprendre' : 'Écouter'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
