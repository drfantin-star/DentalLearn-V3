'use client'

import React from 'react'

interface CutoutCardRenderProps {
  cutoutSrc: string
  /** Couleur principale du dégradé radial et du glow (hex). */
  colorFrom: string
  /** Eyebrow court affiché en haut à gauche (ex. shortName de catégorie). */
  eyebrow?: string
  title: string
  /**
   * Pourcentage de progression (0-100). Si undefined, la barre n'est pas affichée.
   * Utilisé par FormationCardOverlay (Reprendre). Pour toi et Parce que → omettre.
   */
  progress?: number
}

/**
 * Rendu détouré générique : fond radial + glow + objet PNG flottant droite
 * + eyebrow + titre + barre de progression optionnelle.
 *
 * Ne rend que les couches internes (toutes en position absolute).
 * Le consommateur fournit le conteneur `position: relative; overflow: hidden`.
 */
export default function CutoutCardRender({
  cutoutSrc,
  colorFrom,
  eyebrow,
  title,
  progress,
}: CutoutCardRenderProps) {
  const showProgress = progress !== undefined
  const pct = showProgress ? Math.min(100, Math.max(0, Math.round(progress))) : 0

  return (
    <>
      {/* Fond dégradé radial piloté par la couleur catégorie / spécialité */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 70% 40%, ${colorFrom}cc 0%, ${colorFrom}44 55%, #0d0d1a 100%)`,
        }}
      />

      {/* Voile sombre en bas pour lisibilité du titre */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
          zIndex: 1,
        }}
      />

      {/* Glow doux derrière l'objet */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '-10%',
          top: '0%',
          width: '80%',
          height: '85%',
          background: `radial-gradient(ellipse at center, ${colorFrom}55 0%, transparent 70%)`,
          zIndex: 1,
        }}
      />

      {/* Objet détouré — flotte à droite, jamais rogné */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={cutoutSrc}
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: '-4%',
          top: '2%',
          width: '72%',
          height: '88%',
          objectFit: 'contain',
          objectPosition: 'center bottom',
          zIndex: 2,
          filter: 'drop-shadow(0 8px 20px rgba(0,0,0,0.5))',
        }}
      />

      {/* Eyebrow — haut gauche */}
      {eyebrow && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            zIndex: 4,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            borderRadius: '100px',
            padding: '3px 8px',
            border: '0.5px solid rgba(255,255,255,0.15)',
          }}
        >
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.8)',
              textTransform: 'uppercase',
              letterSpacing: '0.07em',
            }}
          >
            {eyebrow}
          </span>
        </div>
      )}

      {/* Titre — bas gauche, laisse de la place à l'objet détouré */}
      <p
        style={{
          position: 'absolute',
          bottom: showProgress ? '18px' : '14px',
          left: '10px',
          right: '48%',
          zIndex: 4,
          margin: 0,
          fontSize: '13px',
          fontWeight: 700,
          color: 'white',
          lineHeight: 1.25,
          textShadow: '0 2px 6px rgba(0,0,0,0.8)',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {title}
      </p>

      {/* Barre de progression — optionnelle, tout en bas */}
      {showProgress && (
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
      )}
    </>
  )
}
