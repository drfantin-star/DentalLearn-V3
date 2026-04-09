'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Play, Pause, SkipBack, SkipForward, X, Music } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'

// ============================================
// MINIPLAYER — Floating Radio France style
// ============================================

export default function MiniPlayer() {
  const pathname = usePathname()
  const { state, pauseAudio, resumeAudio, seekTo, closePlayer } = useAudio()

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

  const handleSeekBack = () => {
    seekTo(state.currentTime - 15)
  }

  const handleSeekForward = () => {
    seekTo(state.currentTime + 15)
  }

  return (
    <div
      className="fixed bottom-20 left-3 right-3 z-40 rounded-2xl shadow-2xl overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${state.accentColor}EE, ${state.accentColor}99)` }}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">

        {/* Pochette — image formation si dispo, sinon icone onde */}
        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-white/20">
          {state.coverImageUrl ? (
            <img src={state.coverImageUrl} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Music size={20} className="text-white/80" />
            </div>
          )}
        </div>

        {/* Texte */}
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm truncate">{state.sequenceTitle}</p>
          <p className="text-white/60 text-xs truncate">{state.formationTitle}</p>
        </div>

        {/* Controles */}
        <div className="flex items-center gap-1">
          <button onClick={handleSeekBack} className="p-2 text-white/80 hover:text-white" aria-label="Reculer 15s">
            <SkipBack size={18} />
          </button>
          <button
            onClick={handleTogglePlay}
            className="w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white"
            aria-label={state.isPlaying ? 'Pause' : 'Play'}
          >
            {state.isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button onClick={handleSeekForward} className="p-2 text-white/80 hover:text-white" aria-label="Avancer 15s">
            <SkipForward size={18} />
          </button>
          <button onClick={closePlayer} className="p-2 text-white/40 hover:text-white/80" aria-label="Fermer le lecteur">
            <X size={16} />
          </button>
        </div>

      </div>

      {/* Barre de progression fine tout en bas */}
      <div className="h-0.5 bg-white/20">
        <div
          className="h-full bg-white/70 transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  )
}
