'use client'

import React from 'react'
import type { ForYouItem, ForYouType } from '@/types/forYou'

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

const TYPE_BADGE: Record<ForYouType, string> = {
  formation: 'Formation',
  epp: 'EPP',
  fiche: 'Fiche',
  autoeval: 'Auto-évaluation',
  news: 'Actu',
  conformite: 'Conformité',
}

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
  const hasCover = !!item.cover

  return (
    <a
      href={item.href}
      className="flex-shrink-0 snap-start rounded-2xl overflow-hidden block"
      style={{
        width: 'calc(50vw - 24px)',
        maxWidth: '220px',
        minWidth: '148px',
        aspectRatio: '3/4',
        position: 'relative',
        border: '0.5px solid #333',
      }}
    >
      {/* Fond : cover si dispo, sinon dégradé accentué + picto */}
      {hasCover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.cover as string}
          alt={item.title}
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
            background: `linear-gradient(135deg, ${accent}, ${accent}99)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '46px',
          }}
        >
          <span aria-hidden>{TYPE_PICTO[item.type]}</span>
        </div>
      )}

      {/* Overlay sombre bas pour lisibilité texte */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 45%, transparent 70%)',
        }}
      />

      {/* Badge de type, accent couleur d'axe */}
      <span
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 2,
          background: accent,
          color: '#fff',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.02em',
          padding: '3px 8px',
          borderRadius: '999px',
          textTransform: 'uppercase',
        }}
      >
        {TYPE_BADGE[item.type]}
      </span>

      {/* Titre + matchReason en bas */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: '10px',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
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
          {item.title}
        </p>
        {item.matchReason && (
          <p
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.75)',
              lineHeight: 1.25,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.matchReason}
            {item.estMinutes ? ` · ~${item.estMinutes} min` : ''}
          </p>
        )}
      </div>
    </a>
  )
}
