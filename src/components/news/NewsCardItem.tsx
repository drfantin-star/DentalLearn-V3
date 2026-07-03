'use client'

import React, { useState } from 'react'
import type { NewsCard } from '@/types/news'
import { describeCardDate } from '@/lib/news-display'
import NewsCardSVG, { SPECIALITE_COLORS, NEWS_DEFAULT_COLOR } from './NewsCardSVG'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import MediaCard from '@/components/home/MediaCard'
import CutoutCardRender from '@/components/home/CutoutCardRender'
import { getNewsCoverChain, getSpecialiteGradient, getNewsCutoutUrl, getSpecialiteColor } from '@/lib/news-cover'

interface Props {
  news: NewsCard
  onClick: (news: NewsCard) => void
  variant: 'carousel' | 'grid'
  /**
   * Quand true (carousel uniquement) : pas d'image, fond = degrade specialite ~70%
   * + titre en grand. N'est passe QUE par les rangees thematiques de la Home.
   * /news et la rangee "Dernieres actus" ne le passent PAS -> comportement inchange.
   */
  hideCover?: boolean
  /** Quand true : masque la pastille de categorie dans tous les variants. */
  hideBadge?: boolean
}

const CATEGORY_VARIANT: Record<string, BadgeVariant> = {
  scientifique:   'news-scientifique',
  pratique:       'news-pratique',
  reglementaire:  'news-reglementaire',
  humour:         'news-humour',
}

function categoryVariant(category: string | null): BadgeVariant {
  if (category && CATEGORY_VARIANT[category]) {
    return CATEGORY_VARIANT[category]
  }
  return 'neutral'
}

function dateLabel(publishedAt: string | null): string | null {
  if (!publishedAt) return null
  return describeCardDate(publishedAt, '').label
}

export default function NewsCardItem({ news, onClick, variant, hideCover = false, hideBadge = false }: Props) {
  const category = news.category_editorial
  const date = dateLabel(news.published_at)

  // Cascade de couverture — hooks toujours initialises, quelle que soit la branche.
  const chain = getNewsCoverChain(news)
  const [coverIdx, setCoverIdx] = useState(0)
  const coverSrc = chain[coverIdx]

  // Degrade de fond par specialite — filet ultime (cascade epuisee) ou hideCover.
  const accent = (news.specialite && SPECIALITE_COLORS[news.specialite]) || NEWS_DEFAULT_COLOR

  // ── Variant grid (/news) — vignette carrée détourée ──────────────────────
  if (variant === 'grid') {
    const gridCutout = getNewsCutoutUrl(news)
    const gridColor = getSpecialiteColor(news.specialite)
    return (
      <button
        type="button"
        onClick={() => onClick(news)}
        className="w-full flex items-center gap-3 rounded-xl glass-card p-3 text-left
                   hover:border-white/20 transition-premium"
      >
        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden relative">
          {gridCutout ? (
            <CutoutCardRender
              cutoutSrc={gridCutout}
              colorFrom={gridColor}
              title=""
              variant="compact"
            />
          ) : (
            <NewsCardSVG
              specialite={news.specialite}
              display_title={news.display_title}
              className="w-full h-full"
            />
          )}
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <h3 className="text-sm font-medium text-white truncate">
            {news.display_title}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {!hideBadge && category ? (
              <Badge variant={categoryVariant(category)} size="md">
                {category}
              </Badge>
            ) : null}
            {date ? (
              <span className="text-xs text-white/55">{date}</span>
            ) : null}
          </div>
        </div>
      </button>
    )
  }

  // ── Variant carousel + hideCover (rangees thematiques Home uniquement) ────
  // Pas d'image : fond = degrade specialite a 70% d'opacite + titre en grand.
  if (hideCover) {
    return (
      <MediaCard
        aspect="landscape"
        onClick={() => onClick(news)}
        ariaLabel={news.display_title}
        cover={undefined}
        fallback={
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: getSpecialiteGradient(news.specialite),
              opacity: 0.7,
            }}
          />
        }
        topLeft={
          !hideBadge && category ? (
            <Badge variant={categoryVariant(category)} size="md">
              {category}
            </Badge>
          ) : undefined
        }
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
            textShadow: '0 1px 4px rgba(0,0,0,0.7)',
            textAlign: 'center',
          }}
        >
          {news.display_title}
        </p>
      </MediaCard>
    )
  }

  // ── Variant carousel par defaut (rangee "Dernieres actus" et Home normale) ─
  const cutoutSrc = getNewsCutoutUrl(news)
  const baseColor = getSpecialiteColor(news.specialite)

  // Rendu cutout si un detourage est disponible (theme ou specialite).
  if (cutoutSrc) {
    return (
      <MediaCard
        aspect="landscape"
        onClick={() => onClick(news)}
        ariaLabel={news.display_title}
        cover={undefined}
        fallback={
          <>
            {/* Fond dégradé radial piloté par la spécialité */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(ellipse at 70% 40%, ${baseColor}cc 0%, ${baseColor}44 55%, #0d0d1a 100%)`,
              }}
            />
            {/* Voile sombre bas pour lisibilité */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)',
              }}
            />
            {/* Glow derrière l'objet */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: '-10%',
                top: '0%',
                width: '75%',
                height: '100%',
                background: `radial-gradient(ellipse at center, ${baseColor}55 0%, transparent 70%)`,
              }}
            />
            {/* Objet detouré — flotte à droite, jamais rogné */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cutoutSrc}
              alt=""
              aria-hidden="true"
              style={{
                position: 'absolute',
                right: '-4%',
                top: '0%',
                width: '68%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'center bottom',
                filter: 'drop-shadow(0 6px 16px rgba(0,0,0,0.5))',
              }}
            />
          </>
        }
        topLeft={
          !hideBadge && category ? (
            <Badge variant={categoryVariant(category)} size="md">
              {category}
            </Badge>
          ) : undefined
        }
      >
        <p
          style={{
            fontSize: '14px',
            fontWeight: 700,
            color: 'white',
            lineHeight: 1.3,
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textShadow: '0 1px 3px rgba(0,0,0,0.7)',
            maxWidth: '55%',
          }}
        >
          {news.display_title}
        </p>
      </MediaCard>
    )
  }

  // Fallback : rendu cover classique (cascade cover_image_url → theme → specialite → SVG).
  return (
    <MediaCard
      aspect="landscape"
      onClick={() => onClick(news)}
      ariaLabel={news.display_title}
      cover={undefined}
      fallback={
        coverSrc ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverSrc}
              alt={news.display_title}
              loading="lazy"
              onError={() => setCoverIdx((i) => i + 1)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              }}
            />
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(135deg, ${accent}, ${accent}88)`,
            }}
          >
            <span
              aria-hidden
              style={{ position: 'absolute', top: '8px', right: '10px', fontSize: '22px', opacity: 0.2 }}
            >
              📰
            </span>
          </div>
        )
      }
      topLeft={
        !hideBadge && category ? (
          <Badge variant={categoryVariant(category)} size="md">
            {category}
          </Badge>
        ) : undefined
      }
    >
      <p
        style={{
          fontSize: '14px',
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
        {news.display_title}
      </p>
    </MediaCard>
  )
}
