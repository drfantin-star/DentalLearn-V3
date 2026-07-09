'use client'

import React, { useState } from 'react'
import type { NewsCard } from '@/types/news'
import { describeCardDate } from '@/lib/news-display'
import NewsCardSVG, { SPECIALITE_COLORS, NEWS_DEFAULT_COLOR } from './NewsCardSVG'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import MediaCard, { mediaCardSizeStyle } from '@/components/home/MediaCard'
import CutoutCardRender from '@/components/home/CutoutCardRender'
import { getNewsCoverChain, getNewsCutoutUrl, getSpecialiteColor } from '@/lib/news-cover'

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

  // ── Variant grid (/news) — vignette ronde detouree, anneau + halo specialite ──
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
        <div className="relative w-20 h-20 flex-shrink-0">
          {/* Halo diffus — frere du cercle clippe, sinon rogne par overflow-hidden.
              Meme montage que le medaillon HomeFeedCard (alpha ~0.38 = suffixe 61). */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full blur-xl pointer-events-none"
            style={{ background: `${gridColor}61`, transform: 'scale(1.15)' }}
          />
          {/* Anneau fin + clip rond — couleur dynamique par specialite,
              d'ou le box-shadow inline (equivalent visuel du ring-2 Home). */}
          <div
            className="relative w-full h-full rounded-full overflow-hidden"
            style={{ boxShadow: `0 0 0 2px ${gridColor}` }}
          >
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
  // Pas d'image : degrade radial specialite + voile bas + titre CENTRE (H+V) +
  // ombre — meme langage visuel que les cartes "Reprendre", titre centre car
  // aucune icone a habiller.
  if (hideCover) {
    const themeColor = getSpecialiteColor(news.specialite)
    return (
      <button
        type="button"
        onClick={() => onClick(news)}
        aria-label={news.display_title}
        className="flex-shrink-0 snap-start rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform duration-150 relative"
        style={{
          ...mediaCardSizeStyle('landscape'),
          border: '0.5px solid rgba(255,255,255,0.08)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        {/* Fond degrade radial pilote par la specialite */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at 70% 40%, ${themeColor}cc 0%, ${themeColor}44 55%, #0d0d1a 100%)`,
          }}
        />
        {/* Voile sombre bas pour lisibilite du titre */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.35) 100%)',
          }}
        />
        {/* Titre centre H+V */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '14px',
          }}
        >
          <p
            style={{
              margin: 0,
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 700,
              color: 'white',
              lineHeight: 1.3,
              textShadow: '0 2px 6px rgba(0,0,0,0.85)',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {news.display_title}
          </p>
        </div>
      </button>
    )
  }

  // ── Variant carousel par defaut (rangee "Dernieres actus" et Home normale) ─
  const cutoutSrc = getNewsCutoutUrl(news)
  const baseColor = getSpecialiteColor(news.specialite)

  // Rendu cutout si un detourage est disponible (theme ou specialite).
  // Delegue a CutoutCardRender (meme rendu que "Reprendre"/"Pour toi") : titre
  // remonte + habillage de l'icone via shape-outside, affiche en entier.
  if (cutoutSrc) {
    return (
      <button
        type="button"
        onClick={() => onClick(news)}
        aria-label={news.display_title}
        className="flex-shrink-0 snap-start rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform duration-150 relative"
        style={{
          ...mediaCardSizeStyle('landscape'),
          border: '0.5px solid #333',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}
      >
        <CutoutCardRender
          cutoutSrc={cutoutSrc}
          colorFrom={baseColor}
          title={news.display_title}
        />
      </button>
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
          WebkitLineClamp: 4,
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
