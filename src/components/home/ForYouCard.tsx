'use client'

import React from 'react'
import type { ForYouItem, ForYouType } from '@/types/forYou'
import { getCategoryConfig } from '@/lib/supabase/types'
import { mediaCardSizeStyle } from './MediaCard'
import MediaCard from './MediaCard'
import CutoutCardRender from './CutoutCardRender'

// Carte unique du feed « Pour vous » : un seul rendu visuel cohérent (style
// « feed » uniforme) piloté par `type`, plutôt que d'alterner entre cartes
// formation / news. Cover si disponible, sinon fond accentué + picto.

// Accents par axe (design system brand kit ; couleurs interdites #2D1B96 /
// #00D1C1 proscrites). conformité / news (axe null) → neutre.
const AXE_ACCENT: Record<number, string> = {
  1: '#8B5CF6',
  2: '#0F7B6C',
  3: '#D97706',
  4: '#EC4899',
}
const NEUTRAL_ACCENT = '#6B7280'

const TYPE_PICTO: Record<ForYouType, string> = {
  formation: '🎓',
  epp: '📋',
  fiche: '📄',
  autoeval: '🩺',
  news: '📰',
  conformite: '🛡️',
}

function accentFor(axe: ForYouItem['axe']): string {
  return axe != null && AXE_ACCENT[axe] ? AXE_ACCENT[axe] : NEUTRAL_ACCENT
}

export default function ForYouCard({ item }: { item: ForYouItem }) {
  const accent = accentFor(item.axe)

  // Formation avec détourage → rendu cutout (sans barre de progression).
  if (item.type === 'formation' && item.cutout) {
    const cfg = item.category ? getCategoryConfig(item.category) : null
    const colorFrom = cfg?.gradient.from ?? accent

    return (
      <a
        href={item.href}
        aria-label={item.title}
        className="flex-shrink-0 snap-start rounded-2xl overflow-hidden block text-left active:scale-[0.98] transition-transform duration-150"
        style={{
          ...mediaCardSizeStyle('landscape'),
          position: 'relative',
          border: '0.5px solid #333',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <CutoutCardRender
          cutoutSrc={item.cutout}
          colorFrom={colorFrom}
          title={item.title}
        />
      </a>
    )
  }

  // Cover formation : rendue en `contain` (non recadrée) sur un dégradé de fond,
  // les covers admin étant des JPEG arbitraires. Le fond reprend la couleur de
  // catégorie (même famille que la cover) ; à défaut (catégorie nulle / non
  // mappée → on évite le gris neutre par défaut), on retombe sur le gradient
  // d'axe — exactement la couleur du fallback sans cover.
  const isFormationCover = item.type === 'formation' && !!item.cover
  const cfg = item.category ? getCategoryConfig(item.category) : null
  const g = cfg?.gradient
  const coverBg =
    g?.from && g?.to
      ? `linear-gradient(135deg, ${g.from}, ${g.to})`
      : `linear-gradient(135deg, ${accent}, ${accent}99)`

  return (
    <MediaCard
      aspect="landscape"
      href={item.href}
      ariaLabel={item.title}
      cover={item.cover}
      coverAlt={item.title}
      coverFit={isFormationCover ? 'contain' : 'cover'}
      coverBackground={isFormationCover ? coverBg : undefined}
      // Sans image (fiche / auto-évaluation) : titre centré H+V. Avec cover :
      // titre ancré en bas.
      align={item.cover ? 'bottom' : 'center'}
      fallback={
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 70% 40%, ${accent}cc 0%, ${accent}44 55%, #0d0d1a 100%)`,
          }}
        >
          <span
            aria-hidden
            style={{ position: 'absolute', top: '10px', right: '12px', fontSize: '30px', opacity: 0.32 }}
          >
            {TYPE_PICTO[item.type]}
          </span>
        </div>
      }
    >
      <p
        style={{
          fontSize: '14px',
          fontWeight: 700,
          color: 'white',
          lineHeight: 1.3,
          display: '-webkit-box',
          WebkitLineClamp: item.cover ? 4 : 5,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
          textShadow: '0 1px 3px rgba(0,0,0,0.6)',
        }}
      >
        {item.title}
      </p>
    </MediaCard>
  )
}
