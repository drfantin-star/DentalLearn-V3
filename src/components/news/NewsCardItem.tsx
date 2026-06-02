'use client'

import React from 'react'
import type { NewsCard } from '@/types/news'
import { describeCardDate } from '@/lib/news-display'
import NewsCardSVG, { SPECIALITE_COLORS, NEWS_DEFAULT_COLOR } from './NewsCardSVG'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import MediaCard from '@/components/home/MediaCard'

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

export default function NewsCardItem({ news, onClick, variant }: Props) {
  const category = news.category_editorial
  const date = dateLabel(news.published_at)

  if (variant === 'grid') {
    return (
      <button
        type="button"
        onClick={() => onClick(news)}
        className="w-full flex items-center gap-3 rounded-xl bg-gray-800/50 p-3 text-left
                   hover:bg-gray-800 transition"
      >
        <div className="w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden">
          {news.cover_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={news.cover_image_url}
              alt={news.display_title}
              className="w-full h-full object-cover"
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
              <span className="text-xs text-gray-400">{date}</span>
            ) : null}
          </div>
        </div>
      </button>
    )
  }

  // Dégradé de fond par spécialité (mapping news existant, cf. NewsCardSVG) —
  // utilisé seulement quand la news n'a pas de cover.
  const accent = (news.specialite && SPECIALITE_COLORS[news.specialite]) || NEWS_DEFAULT_COLOR

  return (
    <MediaCard
      onClick={() => onClick(news)}
      ariaLabel={news.display_title}
      cover={news.cover_image_url}
      coverAlt={news.display_title}
      fallback={
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
          <span aria-hidden>📰</span>
        </div>
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
        {news.display_title}
      </p>
      {date ? (
        <p
          style={{
            fontSize: '11px',
            fontWeight: 500,
            color: 'rgba(255,255,255,0.75)',
            lineHeight: 1.25,
          }}
        >
          {date}
        </p>
      ) : null}
    </MediaCard>
  )
}
