'use client'

import React from 'react'
import type { NewsCard } from '@/types/news'
import { describeCardDate } from '@/lib/news-display'
import NewsCardSVG from './NewsCardSVG'

interface Props {
  news: NewsCard
  onClick: (news: NewsCard) => void
  variant: 'carousel' | 'grid'
}

const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  scientifique: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  pratique: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
}
const CATEGORY_BADGE_FALLBACK = 'bg-gray-500/20 text-gray-300 border-gray-400/30'

function categoryBadgeClasses(category: string | null): string {
  if (category && CATEGORY_BADGE_CLASSES[category]) {
    return CATEGORY_BADGE_CLASSES[category]
  }
  return CATEGORY_BADGE_FALLBACK
}

function dateLabel(publishedAt: string | null): string | null {
  if (!publishedAt) return null
  return describeCardDate(publishedAt, '').label
}

export default function NewsCardItem({ news, onClick, variant }: Props) {
  const category = news.category_editorial
  const badgeClass = categoryBadgeClasses(category)
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
              <span
                className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${badgeClass}`}
              >
                {category}
              </span>
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
            <span
              className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${badgeClass}`}
            >
              {category}
            </span>
          ) : null}
        </div>
        {date ? <span className="text-xs text-gray-400">{date}</span> : null}
      </div>
    </button>
  )
}
