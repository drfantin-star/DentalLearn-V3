'use client'

import React from 'react'
import { Play, Pause } from 'lucide-react'

// ============================================
// WAVEPLAYBUTTON — bouton play/pause rond avec
// remplissage liquide de progression + vagues
// ============================================
//
// Extraction presentationnelle du bouton "verre d'eau" du mode focus de
// MiniPlayer (formations). Aucune logique audio ici : le parent fournit
// isPlaying / progressPercent / onToggle. Consomme les keyframes globales
// animate-wave1 / animate-wave2 (globals.css) et le token accent.
//
// Consommateurs : MiniPlayer (mode focus, rendu inchange) et NewsModal
// (player du detail news).

interface WavePlayButtonProps {
  isPlaying: boolean
  /** Progression de lecture 0-100 — hauteur du remplissage liquide. */
  progressPercent: number
  onToggle: () => void
  /** Classes de diametre du bouton (defaut : w-16 h-16, taille MiniPlayer focus). */
  sizeClassName?: string
  /** Taille de l'icone play/pause en px (defaut 22, taille MiniPlayer focus). */
  iconSize?: number
  ariaLabel?: string
  className?: string
}

export default function WavePlayButton({
  isPlaying,
  progressPercent,
  onToggle,
  sizeClassName = 'w-16 h-16',
  iconSize = 22,
  ariaLabel,
  className,
}: WavePlayButtonProps) {
  return (
    <button
      onClick={onToggle}
      className={`relative ${sizeClassName} rounded-full overflow-hidden shadow-2xl border border-white/20 ${className ?? ''}`}
      style={{ background: '#111111' }}
      aria-label={ariaLabel ?? (isPlaying ? 'Pause' : 'Play')}
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
        {isPlaying
          ? <Pause size={iconSize} />
          : <Play size={iconSize} style={{ marginLeft: '2px' }} />
        }
      </span>
    </button>
  )
}
