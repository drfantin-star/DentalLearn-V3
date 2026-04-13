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

  // --- EPP cards: unified format (square image + ring + center circle) ---
  // Couleur catégorie pour le fond — teal par défaut pour EPP
  const eppColor = '#0F766E'
  const isValidated = demarche.subtitle?.includes('validé') || false
  const isT2 = demarche.subtitle?.includes('Tour 2') || false

  return (
    <div
      className="flex-shrink-0 snap-start rounded-2xl overflow-hidden text-left"
      style={{
        width: 'calc(50vw - 24px)',
        maxWidth: '220px',
        minWidth: '148px',
        display: 'flex',
        flexDirection: 'column',
        background: '#242424',
        border: '0.5px solid #333',
      }}
    >
      {/* Zone image — fond couleur catégorie foncée */}
      <div
        className="w-full flex items-center justify-center relative"
        style={{
          aspectRatio: '1/1',
          background: isValidated ? '#059669' : eppColor,
          flexShrink: 0,
        }}
      >
        {/* Anneau de progression SVG */}
        <svg
          width="108" height="108" viewBox="0 0 108 108"
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 1 }}
        >
          <circle cx="54" cy="54" r="44" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="5"/>
          <circle
            cx="54" cy="54" r="44" fill="none"
            stroke={isValidated ? 'white' : 'white'}
            strokeWidth="5"
            strokeDasharray={isValidated ? '276 276' : isT2 ? '207 276' : '138 276'}
            strokeLinecap="round"
            transform="rotate(-90 54 54)"
            opacity="0.9"
          />
        </svg>

        {/* Cercle blanc central */}
        <div
          style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'white', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: '2px',
            position: 'relative', zIndex: 2,
            border: isValidated ? '2px solid #10B981' : 'none',
          }}
        >
          {isValidated ? (
            <>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Validée
              </span>
            </>
          ) : isT2 ? (
            <>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={eppColor} strokeWidth="2.5">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tour 2
              </span>
              <span style={{ fontSize: '11px', fontWeight: 900, color: eppColor, lineHeight: 1 }}>
                en cours
              </span>
            </>
          ) : (
            <>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={eppColor} strokeWidth="2.5">
                <path d="M9 11l3 3L22 4"/>
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
              </svg>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Tour 1
              </span>
              <span style={{ fontSize: '13px', fontWeight: 900, color: eppColor, lineHeight: 1 }}>✓</span>
            </>
          )}
        </div>
      </div>

      {/* Corps */}
      <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <p style={{
          fontSize: '12px', fontWeight: 600, color: '#e5e5e5',
          lineHeight: 1.3, flex: 1, marginBottom: '6px',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden'
        }}>
          {demarche.title}
        </p>
        <Link
          href={demarche.ctaUrl}
          style={{
            display: 'block', textAlign: 'center',
            fontSize: '11px', fontWeight: 600, color: 'white',
            padding: '6px', borderRadius: '10px', marginTop: 'auto',
            background: isValidated
              ? 'linear-gradient(135deg, #059669, #10B981)'
              : `linear-gradient(135deg, ${eppColor}, #2DD4BF)`,
            textDecoration: 'none',
          }}
        >
          {demarche.ctaLabel}
        </Link>
      </div>
    </div>
  )
}
