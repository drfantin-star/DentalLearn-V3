import React from 'react'
import Link from 'next/link'
import type { DemarcheEnCours } from '@/lib/hooks/useDemarches'
import FormationCardOverlay from '@/components/home/FormationCardOverlay'
import { mediaCardSizeStyle } from '@/components/home/MediaCard'
import type { MediaCardSize } from '@/components/home/MediaCard'

interface DemarcheCardProps {
  demarche: DemarcheEnCours
  size?: MediaCardSize
}

export default function DemarcheCard({ demarche, size = 'default' }: DemarcheCardProps) {
  // --- Formation cards: landscape ---
  if (demarche.type === 'formation') {
    const formation = {
      id: demarche.id,
      title: demarche.title,
      category: demarche.category ?? '',
      cover_image_url: demarche.coverImageUrl ?? null,
      slug: demarche.ctaUrl.split('/').pop() ?? '',
    } as any

    const progress = {
      isStarted: true,
      isCompleted: demarche.subtitle?.includes('Terminé') || false,
    }

    return (
      <FormationCardOverlay
        formation={formation}
        progress={progress}
        aspect="landscape"
        size={size}
        onClick={() => { window.location.href = demarche.ctaUrl }}
      />
    )
  }

  // EPP card — format paysage 3/2, anneau ancre a droite
  const eppColor = '#0F766E'
  const isValidated = demarche.subtitle?.includes('validé') || false
  const isT2 = demarche.subtitle?.includes('Tour 2') || false
  const eppGradient = isValidated
    ? 'linear-gradient(135deg, #059669, #10B981)'
    : `linear-gradient(135deg, ${eppColor}, #2DD4BF)`
  const dashArray = isValidated ? '276 276' : isT2 ? '207 276' : '138 276'

  const RING_SIZE = 72
  const INNER_SIZE = 46

  return (
    <Link
      href={demarche.ctaUrl}
      className="flex-shrink-0 snap-start rounded-2xl overflow-hidden block"
      style={{
        ...mediaCardSizeStyle('landscape', size),
        position: 'relative',
        border: '0.5px solid #333',
        textDecoration: 'none',
      }}
    >
      {/* Fond colore plein */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: eppGradient,
          opacity: 0.7,
        }}
      />

      {/* Anneau SVG ancre a droite, centre verticalement */}
      <div
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          zIndex: 1,
          opacity: 0.7,
          width: `${RING_SIZE}px`,
          height: `${RING_SIZE}px`,
        }}
      >
        <svg width={RING_SIZE} height={RING_SIZE} viewBox="0 0 108 108">
          <circle cx="54" cy="54" r="44" fill="none"
            stroke="rgba(255,255,255,0.2)" strokeWidth="5"/>
          <circle cx="54" cy="54" r="44" fill="none"
            stroke="white" strokeWidth="5"
            strokeDasharray={dashArray}
            strokeLinecap="round"
            transform="rotate(-90 54 54)"
            opacity="0.9"
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${INNER_SIZE}px`,
            height: `${INNER_SIZE}px`,
            borderRadius: '50%',
            background: 'white',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1px',
            border: isValidated ? '2px solid #10B981' : 'none',
          }}
        >
          {isValidated ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#059669" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span style={{ fontSize: '7px', fontWeight: 700, color: '#059669',
                textTransform: 'uppercase' }}>Validee</span>
            </>
          ) : isT2 ? (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={eppColor} strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ fontSize: '7px', fontWeight: 700, color: '#6b7280',
                textTransform: 'uppercase' }}>Tour 2</span>
              <span style={{ fontSize: '8px', fontWeight: 900, color: eppColor }}>en cours</span>
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke={eppColor} strokeWidth="2.5">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <span style={{ fontSize: '7px', fontWeight: 700, color: '#6b7280',
                textTransform: 'uppercase' }}>Tour 1</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: eppColor }}>✓</span>
            </>
          )}
        </div>
      </div>

      {/* Overlay gradient sombre en bas */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.2) 45%, transparent 65%)',
          zIndex: 2,
        }}
      />

      {/* Titre + CTA en bas-gauche, laisse place a l'anneau */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: `${RING_SIZE + 16}px`,
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <p
          style={{
            fontSize: '16px',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.25,
            display: '-webkit-box',
            WebkitLineClamp: 4,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textShadow: '0 2px 6px rgba(0,0,0,0.7)',
          }}
        >
          {demarche.title}
        </p>
        <div
          style={{
            background: eppGradient,
            color: 'white',
            fontSize: '11px',
            fontWeight: 600,
            textAlign: 'center',
            padding: '5px 7px',
            borderRadius: '10px',
          }}
        >
          {demarche.ctaLabel}
        </div>
      </div>
    </Link>
  )
}
