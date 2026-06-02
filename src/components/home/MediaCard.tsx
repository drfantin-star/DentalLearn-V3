'use client'

import React from 'react'
import type { ReactNode } from 'react'

/**
 * Shell média commun des carrousels de la home (« Pour vous »,
 * « Fraîchement arrivé », « Actualités »). Garantit une carte à dimensions
 * IDENTIQUES partout :
 *   width = calc(50vw - 24px), clampée 148→220px, aspectRatio 3/4.
 * La hauteur n'est pas figée en pixels : elle dérive de l'aspect-ratio
 * appliqué à la largeur responsive (valeur héritée des cartes « Pour vous »
 * et `FormationCardOverlay`, qui partageaient déjà ce shell par duplication).
 *
 * Anatomie : fond pleine carte (cover sinon `fallback`) → overlay dégradé
 * sombre → slots `topLeft` / `topRight` → bloc bas (`children`).
 */

// Orientation de la carte. `portrait` (3/4) = format vedette « Fraîchement
// arrivé ». `landscape` (3/2) = format des cartes catégories « Explorer »,
// repris pour « Pour vous » et « Actualités » (hauteur réduite, alignée sur
// les catégories).
export type MediaCardAspect = 'portrait' | 'landscape'
const ASPECT_RATIO: Record<MediaCardAspect, string> = {
  portrait: '3 / 4',
  landscape: '3 / 2',
}

// Dimensions partagées — source unique de vérité de la « hauteur de carte ».
// La largeur (et donc la hauteur via l'aspect-ratio) est identique aux cartes
// catégories de « Explorer » (CategoryCarousel dans page.tsx).
export const MEDIA_CARD_STYLE: React.CSSProperties = {
  width: 'calc(50vw - 24px)',
  maxWidth: '220px',
  minWidth: '148px',
  aspectRatio: '3 / 4',
  position: 'relative',
  border: '0.5px solid #333',
}

// Overlay sombre bas, identique pour les trois carrousels (lisibilité texte).
const DARK_OVERLAY =
  'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 45%, transparent 70%)'

interface MediaCardProps {
  /** Rendu `<a>` si `href`, sinon `<button>`. */
  href?: string
  onClick?: () => void
  ariaLabel?: string
  /** URL cover ; si absente, `fallback` occupe le fond pleine carte. */
  cover?: string | null
  coverAlt?: string
  /** Fond pleine carte quand pas de cover (dégradé + picto/SVG). */
  fallback?: ReactNode
  /** Pastille catégorie / badge type — haut gauche. */
  topLeft?: ReactNode
  /** Badge secondaire (ex. podcast) — haut droite. */
  topRight?: ReactNode
  /** Orientation. Défaut `portrait` (3/4). `landscape` (3/2) pour Pour vous / Actualités. */
  aspect?: MediaCardAspect
  /** Bloc bas en overlay : titre + sous-titre / CTA. */
  children: ReactNode
}

export default function MediaCard({
  href,
  onClick,
  ariaLabel,
  cover,
  coverAlt,
  fallback,
  topLeft,
  topRight,
  aspect = 'portrait',
  children,
}: MediaCardProps) {
  const className = 'flex-shrink-0 snap-start rounded-2xl overflow-hidden block text-left'
  const style: React.CSSProperties = { ...MEDIA_CARD_STYLE, aspectRatio: ASPECT_RATIO[aspect] }

  const inner = (
    <>
      {/* Fond pleine carte */}
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt={coverAlt ?? ''}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        fallback
      )}

      {/* Overlay dégradé sombre */}
      <div style={{ position: 'absolute', inset: 0, background: DARK_OVERLAY }} />

      {topLeft && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 2 }}>
          {topLeft}
        </div>
      )}
      {topRight && (
        <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 2 }}>
          {topRight}
        </div>
      )}

      {/* Bloc bas */}
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
        {children}
      </div>
    </>
  )

  if (href) {
    return (
      <a href={href} aria-label={ariaLabel} className={className} style={style}>
        {inner}
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
      style={style}
    >
      {inner}
    </button>
  )
}
