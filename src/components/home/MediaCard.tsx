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
// catégories de « Explorer » (CategoryCarousel dans page.tsx). Exporté pour que
// les tuiles « hors shell » (ex. tuile « Voir toutes les actus » dans page.tsx)
// s'alignent exactement sur les cartes — même largeur, même hauteur.
export type MediaCardSize = 'default' | 'large'

export function mediaCardSizeStyle(aspect: MediaCardAspect, size: MediaCardSize = 'default'): React.CSSProperties {
  const isLarge = size === 'large'
  return {
    width: isLarge ? 'calc(72vw - 24px)' : 'calc(50vw - 24px)',
    minWidth: isLarge ? '220px' : '148px',
    maxWidth: isLarge ? '340px' : '220px',
    aspectRatio: ASPECT_RATIO[aspect],
  }
}

export const MEDIA_CARD_STYLE: React.CSSProperties = {
  ...mediaCardSizeStyle('portrait'),
  position: 'relative',
  border: '0.5px solid #333',
}

// Overlay sombre bas, lié à l'aspect (lisibilité texte). Le portrait
// (« Fraîchement arrivé ») garde un scrim plus dense (couvre une vedette plein
// cadre) ; le landscape (« Pour vous » / « Actualités ») est allégé pour ne pas
// noircir les covers paysage.
const DARK_OVERLAY: Record<MediaCardAspect, string> = {
  portrait:
    'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.3) 45%, transparent 70%)',
  landscape:
    'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.28) 45%, transparent 72%)',
}

// Masque de couture pour une cover en `contain` ancrée haut-droite : adoucit les
// bords gauche/bas de l'image (transition vers le dégradé de fond) plutôt qu'une
// arête nette. Valeur tunable au smoke.
const SEAM_FADE = 'linear-gradient(to top right, transparent 0%, #000 38%)'

interface MediaCardProps {
  /** Rendu `<a>` si `href`, sinon `<button>`. */
  href?: string
  onClick?: () => void
  ariaLabel?: string
  /** URL cover ; si absente, `fallback` occupe le fond pleine carte. */
  cover?: string | null
  coverAlt?: string
  /**
   * Mode d'affichage de la cover. `cover` (défaut) = `object-cover` plein cadre.
   * `contain` = image `object-contain` ancrée haut-droite (~58 %) sur un fond
   * `coverBackground`, bords adoucis — pour des covers non recadrables (ex.
   * covers formation arbitraires dans « Pour vous »).
   */
  coverFit?: 'cover' | 'contain'
  /** Fond CSS derrière une cover `contain` (dégradé d'axe / catégorie). */
  coverBackground?: string
  /** Opacité de la cover (0–1, défaut 1). Permet de mettre l'image en arrière-plan. */
  coverOpacity?: number
  /** Fond pleine carte quand pas de cover (dégradé + picto/SVG). */
  fallback?: ReactNode
  /** Pastille catégorie / badge type — haut gauche. */
  topLeft?: ReactNode
  /** Badge secondaire (ex. podcast) — haut droite. */
  topRight?: ReactNode
  /** Orientation. Défaut `portrait` (3/4). `landscape` (3/2) pour Pour vous / Actualités. */
  aspect?: MediaCardAspect
  /** Taille. 'default' = largeur standard (50vw, max 220px). 'large' = 72vw, max 340px. */
  size?: MediaCardSize
  /**
   * Placement du bloc `children`. `bottom` (défaut) = ancré bas-gauche.
   * `center` = centré horizontalement + verticalement (cartes sans image, ex.
   * fiches / auto-évaluations : le titre occupe le centre de la carte).
   */
  align?: 'bottom' | 'center'
  /** Bloc bas en overlay : titre + sous-titre / CTA. */
  children: ReactNode
}

export default function MediaCard({
  href,
  onClick,
  ariaLabel,
  cover,
  coverAlt,
  coverFit = 'cover',
  coverBackground,
  coverOpacity = 1,
  fallback,
  topLeft,
  topRight,
  aspect = 'portrait',
  size = 'default',
  align = 'bottom',
  children,
}: MediaCardProps) {
  const className = 'flex-shrink-0 snap-start rounded-2xl overflow-hidden block text-left'
  const style: React.CSSProperties = {
    ...mediaCardSizeStyle(aspect, size),
    position: 'relative',
    border: '0.5px solid #333',
    boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
  }

  const inner = (
    <>
      {/* Fond pleine carte */}
      {cover ? (
        coverFit === 'contain' ? (
          <div style={{ position: 'absolute', inset: 0, background: coverBackground, opacity: coverOpacity }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt={coverAlt ?? ''}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                height: '100%',
                width: '58%',
                objectFit: 'contain',
                objectPosition: 'top right',
                WebkitMaskImage: SEAM_FADE,
                maskImage: SEAM_FADE,
              }}
            />
          </div>
        ) : (
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
              opacity: coverOpacity,
            }}
          />
        )
      ) : (
        fallback
      )}

      {/* Overlay dégradé sombre */}
      <div style={{ position: 'absolute', inset: 0, background: DARK_OVERLAY[aspect] }} />

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

      {/* Bloc titre — ancré bas (défaut) ou centré (cartes sans image) */}
      {align === 'center' ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '14px',
          }}
        >
          {children}
        </div>
      ) : (
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
          {children}
        </div>
      )}
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
