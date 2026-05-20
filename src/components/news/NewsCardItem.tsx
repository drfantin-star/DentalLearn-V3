'use client'

import React from 'react'
import type { NewsCard } from '@/types/news'
import { describeCardDate } from '@/lib/news-display'
import NewsCardSVG from './NewsCardSVG'
import Badge, { type BadgeVariant } from '@/components/ui/Badge'

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

  return (
    <button
      type="button"
      onClick={() => onClick(news)}
      className="flex-shrink-0 w-[200px] rounded-xl bg-gray-800 overflow-hidden
                 cursor-pointer hover:scale-[1.02] transition text-left"
    >
      <div className="w-full h-[120px] bg-gray-900">
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
      <div className="p-3 flex flex-col gap-2">
        <h3 className="text-sm font-medium text-white line-clamp-2 leading-snug">
          {news.display_title}
        </h3>
        <div className="flex items-center gap-2 flex-wrap">
          {category ? (
            <Badge variant={categoryVariant(category)} size="md">
              {category}
            </Badge>
          ) : null}
        </div>
      </div>
    </button>
  )
}
