'use client'

import React from 'react'
import type { Formation } from '@/lib/supabase/types'
import { getCategoryConfig } from '@/lib/supabase/types'
import { mediaCardSizeStyle } from './MediaCard'
import type { MediaCardAspect } from './MediaCard'
import CutoutCardRender from './CutoutCardRender'

interface FormationCardOverlayProps {
  formation: Formation
  progressPercent?: number
  onClick: () => void
  aspect?: MediaCardAspect
}

export default function FormationCardOverlay({
  formation,
  progressPercent = 0,
  onClick,
  aspect = 'portrait',
}: FormationCardOverlayProps) {
  const pct = Math.min(100, Math.max(0, Math.round(progressPercent)))
  const ariaLabel = `Reprendre : ${formation.title}, ${pct} %`
  const hasCutout = Boolean(formation.cover_cutout_url)
  const catConfig = getCategoryConfig(formation.category)

  const cardStyle: React.CSSProperties = {
    ...mediaCardSizeStyle(aspect),
    position: 'relative',
    borderRadius: '18px',
    border: '0.5px solid rgba(255,255,255,0.08)',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
    overflow: 'hidden',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="flex-shrink-0 snap-start block text-left active:scale-[0.98] transition-transform duration-150"
      style={cardStyle}
    >
      {hasCutout ? (
        /* ── Mode cutout ─────────────────────────────── */
        <CutoutCardRender
          cutoutSrc={formation.cover_cutout_url!}
          colorFrom={catConfig.gradient.from}
          title={formation.title}
          progress={pct}
        />
      ) : (
        /* ── Fallback : rendu image cover existant ───── */
        <>
          {formation.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={formation.cover_image_url}
              alt={formation.title}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center top',
              }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #1a1a2e, #16213e)' }} />
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.15) 55%, transparent 100%)',
            }}
          />

          <p
            style={{
              position: 'absolute',
              bottom: '18px',
              left: '10px',
              right: '10px',
              zIndex: 3,
              margin: 0,
              fontSize: '13px',
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.25,
              textShadow: '0 2px 6px rgba(0,0,0,0.7)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {formation.title}
          </p>

          {/* Barre de progression — fallback */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '4px',
              background: 'rgba(255,255,255,0.18)',
              zIndex: 5,
            }}
          >
            <div
              className="bg-accent"
              style={{
                height: '100%',
                width: `${pct}%`,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
        </>
      )}
    </button>
  )
}
