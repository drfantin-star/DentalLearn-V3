'use client'

import React, { useState } from 'react'
import type { NewsCard } from '@/types/news'
import { describeCardDate } from '@/lib/news-display'
import NewsCardSVG, { SPECIALITE_COLORS, NEWS_DEFAULT_COLOR } from './NewsCardSVG'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import MediaCard from '@/components/home/MediaCard'
import { getNewsCoverChain } from '@/lib/news-cover'

interface Props {
  news: NewsCard
  onClick: (news: NewsCard) => void
  variant: 'carousel' | 'grid'
}

const CATEGORY_VARIANT: Record<string, BadgeVariant> = {
  scientifique: 'news-scientifique',
  pratique: 'news-pratique',
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

// Assombrit un hex de ~`amount` (0-1) en multipliant chaque canal — regle
// UNIQUE et deterministe pour deriver le degrade news (base -> base assombri),
// dans la direction 135 des cartes categories.
function darkenHex(hex: string, amount: number): string {
  const m = hex.replace('#', '')
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m
  const ch = (i: number) => Math.round(parseInt(n.slice(i, i + 2), 16) * (1 - amount))
  const h = (v: number) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')
  return `#${h(ch(0))}${h(ch(2))}${h(ch(4))}`
}

export default function NewsCardItem({ news, onClick, variant }: Props) {
  const category = news.category_editorial
  const date = dateLabel(news.published_at)

  // Cascade de couverture : cover_image_url -> theme -> specialite -> SVG
  const chain = getNewsCoverChain(news)
  const [coverIdx, setCoverIdx] = useState(0)
  const coverSrc = chain[coverIdx] // undefined = toutes les URLs ont echoue

  // Degrade de fond par specialite — filet ultime quand toutes les URLs echouent.
  const accent = (news.specialite && SPECIALITE_COLORS[news.specialite]) || NEWS_DEFAULT_COLOR

  if (variant === 'grid') {
    return (
      <button
        type="button"
        onClick={() => onClick(news)}
        className="w-full flex items-center gap-3 rounded-xl glass-card p-3 text-left
                   hover:border-white/20 transition-premium"
      >
        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
          {coverSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={coverSrc}
              alt={news.display_title}
              loading="lazy"
              className="w-full h-full object-cover"
              onError={() => setCoverIdx((i) => i + 1)}
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
            {category ? (
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

  // Variant carousel : on gere la cascade dans le fallback de MediaCard.
  // cover={undefined} -> MediaCard affiche toujours `fallback`.
  // On switche entre l'img chargeable et le degrade SVG selon coverSrc.
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
              background: `linear-gradient(135deg, ${accent}, ${darkenHex(accent, 0.35)})`,
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
        category ? (
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
