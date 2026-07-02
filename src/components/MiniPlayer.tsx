'use client'

import React from 'react'
import { usePathname } from 'next/navigation'
import { Play, Pause, SkipBack, SkipForward, X, Music } from 'lucide-react'
import { useAudio } from '@/context/AudioContext'
import { useFocusMode } from '@/context/FocusModeContext'

// ============================================
// MINIPLAYER — Floating Radio France style
// ============================================

export default function MiniPlayer() {
  const pathname = usePathname()
  const { state, pauseAudio, resumeAudio, seekTo, closePlayer } = useAudio()
  const { isFocus } = useFocusMode()

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

  // Mode focus mobile : verre d'eau — bouton unique play/pause avec niveau de progression.
  // md:hidden garantit que ce rendu ne s'active jamais sur desktop.
  if (isFocus) {
    return (
      <div className="md:hidden fixed z-50" style={{ bottom: 'calc(env(safe-area-inset-bottom) + 12px)', right: '16px' }}>
        <button
          onClick={handleTogglePlay}
          className="relative w-16 h-16 rounded-full overflow-hidden shadow-2xl border border-white/20"
          style={{ background: '#111111' }}
          aria-label={state.isPlaying ? 'Pause' : 'Play'}
        >
          {/* Remplissage liquide qui monte selon la progression */}
          <div
            className="absolute bottom-0 left-0 right-0 bg-accent transition-[height] duration-1000"
            style={{ height: `${progressPercent}%` }}
          >
            {/* Vague double animee en haut du liquide — 200% wide pour le translateX infini.
                text-accent sur le SVG => currentColor = couleur accent => fill-current fonctionne. */}
            <svg
              aria-hidden="true"
              className="absolute -top-3 left-0 w-[200%] text-accent"
              viewBox="0 0 128 12"
              preserveAspectRatio="none"
              height="12"
            >
              <path
                className="fill-current opacity-90 animate-wave1"
                d="M0 6 Q8 0 16 6 Q24 12 32 6 Q40 0 48 6 Q56 12 64 6 Q72 0 80 6 Q88 12 96 6 Q104 0 112 6 Q120 12 128 6 L128 12 L0 12 Z"
              />
              <path
                className="fill-current opacity-50 animate-wave2"
                d="M0 6 Q8 12 16 6 Q24 0 32 6 Q40 12 48 6 Q56 0 64 6 Q72 12 80 6 Q88 0 96 6 Q104 12 112 6 Q120 0 128 6 L128 12 L0 12 Z"
              />
            </svg>
          </div>

          {/* Icone play/pause au centre, au-dessus du liquide */}
          <span className="absolute inset-0 flex items-center justify-center text-white z-10">
            {state.isPlaying
              ? <Pause size={22} />
              : <Play size={22} style={{ marginLeft: '2px' }} />
            }
          </span>
        </button>
      </div>
    )
  }

  // Rendu normal (hors focus)
  return (
    <div
      className="fixed bottom-28 left-3 right-3 z-40 rounded-2xl shadow-2xl overflow-hidden"
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
