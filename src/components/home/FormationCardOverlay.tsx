'use client'

import React from 'react'
import { getCategoryConfig } from '@/lib/supabase/types'
import type { Formation } from '@/lib/supabase/types'

interface FormationCardOverlayProps {
  formation: Formation
  progress?: { isStarted: boolean; isCompleted: boolean }
  onClick: () => void
  accentGradient?: string
}

export default function FormationCardOverlay({
  formation,
  progress,
  onClick,
  accentGradient,
}: FormationCardOverlayProps) {
  const config = getCategoryConfig(formation.category)
  const ctaLabel = progress?.isCompleted
    ? '✓ Terminé'
    : progress?.isStarted
    ? 'Continuer →'
    : 'Découvrir'
  const ctaGradient = progress?.isCompleted
    ? 'linear-gradient(135deg, #059669, #10B981)'
    : accentGradient || `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})`

  return (
    <button
      onClick={onClick}
      className="flex-shrink-0 snap-start rounded-2xl overflow-hidden text-left"
      style={{
        width: 'calc(50vw - 24px)',
        maxWidth: '220px',
        minWidth: '148px',
        display: 'flex',
        flexDirection: 'column',
        border: '0.5px solid #333',
        position: 'relative',
      }}
    >
      {/* Cover — carré */}
      <div
        className="w-full flex items-center justify-center relative"
        style={{
          aspectRatio: '1/1',
          background: !formation.cover_image_url
            ? `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})`
            : undefined,
        }}
      >
        {formation.cover_image_url ? (
          <img
            src={formation.cover_image_url}
            alt={formation.title}
            className="w-full h-full object-cover absolute inset-0"
          />
        ) : (
          <span className="text-5xl z-10">{config.emoji}</span>
        )}

        {/* Overlay gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.3) 40%, transparent 65%)',
          }}
        />

        {/* Badge podcast haut droite */}
        <div
          className="absolute flex items-center justify-center"
          style={{
            top: '10px',
            right: '10px',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            zIndex: 2,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        </div>
      </div>

      {/* Phantom body — force la hauteur totale identique à l'ancienne carte */}
      <div style={{ height: '70px', flexShrink: 0, position: 'relative' }} />

      {/* Contenu overlay — titre + CTA */}
      <div
        className="absolute"
        style={{
          bottom: '10px',
          left: '10px',
          right: '10px',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <p
          className="font-bold text-white leading-snug"
          style={{
            fontSize: '12px',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {formation.title}
        </p>
        <div
          className="w-full text-center text-xs font-semibold text-white py-1.5 rounded-xl"
          style={{ background: ctaGradient }}
        >
          {ctaLabel}
        </div>
      </div>
    </button>
  )
}
