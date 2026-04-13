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
      className="flex-shrink-0 snap-start rounded-2xl overflow-hidden"
      style={{
        width: 'calc(50vw - 24px)',
        maxWidth: '220px',
        minWidth: '148px',
        border: '0.5px solid #333',
        position: 'relative',
        aspectRatio: '3/4',
        display: 'block',
      }}
    >
      {/* Image pleine carte */}
      {formation.cover_image_url ? (
        <img
          src={formation.cover_image_url}
          alt={formation.title}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '48px',
          }}
        >
          {config.emoji}
        </div>
      )}

      {/* Overlay gradient sombre en bas */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 45%, transparent 70%)',
        }}
      />

      {/* Badge podcast haut droite */}
      <div
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.45)',
          backdropFilter: 'blur(4px)',
          border: '1.5px solid rgba(255,255,255,0.3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
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

      {/* Titre + CTA en bas */}
      <div
        style={{
          position: 'absolute',
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
          style={{
            fontSize: '13px',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
          }}
        >
          {formation.title}
        </p>
        <div
          style={{
            background: ctaGradient,
            color: 'white',
            fontSize: '12px',
            fontWeight: 600,
            textAlign: 'center',
            padding: '7px',
            borderRadius: '10px',
          }}
        >
          {ctaLabel}
        </div>
      </div>
    </button>
  )
}
