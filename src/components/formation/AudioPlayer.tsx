'use client'

import React from 'react'
import { Play, Pause, Check } from 'lucide-react'
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
  learningObjectives?: string[] | null
  coverImageUrl?: string | null
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
  learningObjectives,
  coverImageUrl,
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
        coverImageUrl: coverImageUrl || undefined,
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

      {/* IMAGE MOBILE — 240×240 carré centré */}
      {coverImageUrl && (
        <div className="md:hidden mx-auto mb-3 rounded-2xl overflow-hidden"
             style={{ width: '160px', height: '160px' }}>
          <img
            src={coverImageUrl}
            alt={sequenceTitle}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* LAYOUT DESKTOP — image collée au player, un seul bloc */}
      <div className="md:flex md:gap-2 md:items-stretch md:w-full">

        {/* Image desktop — carré fixe 280×280 */}
        {coverImageUrl && (
          <div className="hidden md:flex md:items-center md:justify-center md:flex-shrink-0 md:rounded-2xl overflow-hidden"
               style={{ background: '#1a1a1a', width: '280px', minWidth: '280px' }}>
            <img
              src={coverImageUrl}
              alt={sequenceTitle}
              className="w-full object-contain"
              style={{ height: '280px' }}
            />
          </div>
        )}

        {/* CARD PLAYER */}
        <div className="flex-1 rounded-2xl p-6 flex flex-col justify-center gap-4"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColorSecondary})` }}
        >
          {/* Title + Formation */}
          <div className="flex flex-col items-center">
            <p className="text-white font-bold text-xl text-center leading-snug">
              {sequenceTitle}
            </p>
            {formationTitle && (
              <p className="text-white/60 text-sm text-center mt-1">{formationTitle}</p>
            )}
          </div>

          {/* Objectives */}
          {learningObjectives && learningObjectives.length > 0 && (
            <>
              <div className="h-px bg-white/20" />
              <div className="space-y-2">
                <p className="text-white/60 text-xs uppercase tracking-wider text-center mb-3">
                  À l'issue de cette séquence
                </p>
                {learningObjectives.map((obj, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                      <Check size={12} className="text-white" />
                    </span>
                    <p className="text-white/90 text-sm leading-snug">{obj}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="h-px bg-white/20" />

          {/* Timer pill */}
          <div className="flex justify-center">
            <div className="bg-white/20 backdrop-blur-sm px-4 py-1 rounded-full">
              <span className="text-white text-sm font-semibold tabular-nums">
                {formatTime(currentPos)} / {formatTime(currentDuration)}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-[width] duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          {/* Bouton Écouter */}
          <div className="flex justify-center">
            <button
              onClick={handleToggle}
              className="flex items-center gap-3 px-8 py-3.5 rounded-2xl font-semibold text-sm shadow-lg transition-transform active:scale-95 bg-white"
              style={{ color: accentColor }}
            >
              {isPlaying ? (
                <>
                  <Pause size={20} fill={accentColor} />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play size={20} fill={accentColor} className="ml-0.5" />
                  <span>{isThisTrack && state.currentTime > 0 ? 'Reprendre' : 'Écouter'}</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
