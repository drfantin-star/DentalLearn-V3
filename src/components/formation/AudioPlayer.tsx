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

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl border-2 border-gray-100 shadow-sm overflow-hidden">
        {/* Visuel audio */}
        <div
          className="relative px-6 py-8 flex flex-col items-center"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColorSecondary})` }}
        >
          <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
            <span className="text-4xl">🎧</span>
          </div>
          <p className="text-white/80 text-xs font-medium mb-1">COURS AUDIO</p>
          {isThisTrack && state.currentTime > 0 ? (
            <div className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
              <span className="text-white text-sm font-semibold">
                {formatTime(state.currentTime)} / {formatTime(state.duration || duration)}
              </span>
            </div>
          ) : (
            <div className="bg-white/20 backdrop-blur-sm px-4 py-1.5 rounded-full">
              <span className="text-white text-sm font-semibold">
                Durée : {formatTime(duration)}
              </span>
            </div>
          )}
        </div>

        {/* Bouton Écouter */}
        <div className="px-5 py-5 flex justify-center">
          <button
            onClick={handleToggle}
            className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white shadow-lg transition-transform active:scale-95"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColorSecondary})` }}
          >
            {isPlaying ? (
              <>
                <Pause size={22} fill="white" />
                <span>Pause</span>
              </>
            ) : (
              <>
                <Play size={22} fill="white" className="ml-0.5" />
                <span>{isThisTrack && state.currentTime > 0 ? 'Reprendre' : 'Écouter'}</span>
              </>
            )}
          </button>
        </div>

        {/* Message DPC */}
        {(!isThisTrack || (isThisTrack && state.currentTime > 0 && state.currentTime < (state.duration || duration))) && (
          <p className="text-center text-[11px] text-gray-400 pb-4 px-4">
            Écoutez 100% du cours pour débloquer le quiz
          </p>
        )}
      </div>
    </div>
  )
}
