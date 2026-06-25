'use client'

import React from 'react'
import { getCategoryConfig } from '@/lib/supabase/types'
import type { Formation } from '@/lib/supabase/types'
import MediaCard from './MediaCard'
import type { MediaCardAspect } from './MediaCard'

interface FormationCardOverlayProps {
  formation: Formation
  progress?: { isStarted: boolean; isCompleted: boolean }
  onClick: () => void
  accentGradient?: string
  aspect?: MediaCardAspect
}

export default function FormationCardOverlay({
  formation,
  progress,
  onClick,
  accentGradient,
  aspect = 'portrait',
}: FormationCardOverlayProps) {
  const config = getCategoryConfig(formation.category)
  const coverBg = `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})`
  const ctaLabel = progress?.isCompleted
    ? '✓ Terminé'
    : progress?.isStarted
    ? 'Continuer →'
    : 'Découvrir'
  const ctaGradient = progress?.isCompleted
    ? 'linear-gradient(135deg, #059669, #10B981)'
    : accentGradient || `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})`

  return (
    <MediaCard
      onClick={onClick}
      aspect={aspect}
      cover={formation.cover_image_url}
      coverAlt={formation.title}
      coverFit="contain"
      coverBackground={coverBg}
      fallback={
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
      }
      topRight={
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(4px)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"/>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z"/>
            <path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"/>
          </svg>
        </div>
      }
    >
      <p
        style={{
          fontSize: '13px',
          fontWeight: 700,
          color: 'white',
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: aspect === 'landscape' ? 2 : 3,
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
    </MediaCard>
  )
}
