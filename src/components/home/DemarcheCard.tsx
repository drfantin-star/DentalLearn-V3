import React from 'react'
import Link from 'next/link'
import type { DemarcheEnCours } from '@/lib/hooks/useDemarches'
import FormationCardOverlay from '@/components/home/FormationCardOverlay'

interface DemarcheCardProps {
  demarche: DemarcheEnCours
}

export default function DemarcheCard({ demarche }: DemarcheCardProps) {
  // --- Formation cards: square card with cover image ---
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
        onClick={() => { window.location.href = demarche.ctaUrl }}
      />
    )
  }

  // EPP card — format overlay unifié
  const eppColor = '#0F766E'
  const isValidated = demarche.subtitle?.includes('validé') || false
  const isT2 = demarche.subtitle?.includes('Tour 2') || false
  const eppGradient = isValidated
    ? 'linear-gradient(135deg, #059669, #10B981)'
    : `linear-gradient(135deg, ${eppColor}, #2DD4BF)`
  const dashArray = isValidated ? '276 276' : isT2 ? '207 276' : '138 276'

  return (
    <Link
      href={demarche.ctaUrl}
      className="flex-shrink-0 snap-start rounded-2xl overflow-hidden"
      style={{
        width: 'calc(50vw - 24px)',
        maxWidth: '220px',
        minWidth: '148px',
        border: '0.5px solid #333',
        position: 'relative',
        aspectRatio: '3/4',
        display: 'block',
        textDecoration: 'none',
      }}
    >
      {/* Fond coloré plein */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: eppGradient,
        }}
      />

      {/* Anneau SVG + cercle centré */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -85%)',
          zIndex: 1,
        }}
      >
        <svg width="108" height="108" viewBox="0 0 108 108">
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
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '72px', height: '72px',
            borderRadius: '50%',
            background: 'white',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '2px',
            border: isValidated ? '2px solid #10B981' : 'none',
          }}
        >
          {isValidated ? (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke="#059669" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#059669',
                textTransform: 'uppercase' }}>Validée</span>
            </>
          ) : isT2 ? (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke={eppColor} strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280',
                textTransform: 'uppercase' }}>Tour 2</span>
              <span style={{ fontSize: '10px', fontWeight: 900, color: eppColor }}>en cours</span>
            </>
          ) : (
            <>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                stroke={eppColor} strokeWidth="2.5">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#6b7280',
                textTransform: 'uppercase' }}>Tour 1</span>
              <span style={{ fontSize: '13px', fontWeight: 900, color: eppColor }}>✓</span>
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

      {/* Titre + CTA en bas */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: '10px',
          zIndex: 3,
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <p
          style={{
            fontSize: '12px',
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
          {demarche.title}
        </p>
        <div
          style={{
            background: eppGradient,
            color: 'white',
            fontSize: '12px',
            fontWeight: 600,
            textAlign: 'center',
            padding: '7px',
            borderRadius: '10px',
          }}
        >
          {demarche.ctaLabel}
        </div>
      </div>
    </Link>
  )
}
