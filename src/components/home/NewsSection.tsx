import React from 'react'
import {
  Newspaper,
  ChevronRight,
  Scale,
  FlaskConical,
  Stethoscope,
  PartyPopper,
  ExternalLink,
  Loader2,
} from 'lucide-react'
import { formatRelativeDate } from '@/lib/hooks/useNews'
import type { NewsArticle } from '@/types/database'

interface NewsSectionProps {
  news: NewsArticle[]
  loading: boolean
}

const categoryStyles = {
  reglementaire: {
    icon: Scale,
    bg: 'bg-blue-50',
    text: 'text-blue-600',
    label: 'Réglementaire',
  },
  scientifique: {
    icon: FlaskConical,
    bg: 'bg-purple-50',
    text: 'text-purple-600',
    label: 'Scientifique',
  },
  pratique: {
    icon: Stethoscope,
    bg: 'bg-teal-50',
    text: 'text-teal-600',
    label: 'Pratique',
  },
  humour: {
    icon: PartyPopper,
    bg: 'bg-pink-50',
    text: 'text-pink-600',
    label: 'Humour',
  },
}

export default function NewsSection({ news, loading }: NewsSectionProps) {
  if (loading) {
    return (
      <section>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Newspaper size={20} className="text-[#2D1B96]" /> Veille métier
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      </section>
    )
  }

  if (news.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Newspaper size={20} className="text-[#2D1B96]" /> Veille métier
        </h2>
        <p className="text-gray-400 text-sm text-center py-8">
          Aucune actualité pour le moment
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Newspaper size={20} className="text-[#2D1B96]" /> Veille métier
        </h2>
        <button className="text-xs font-bold text-[#2D1B96] flex items-center gap-1">
          Tout voir <ChevronRight size={14} />
        </button>
      </div>
      <div className="space-y-3">
        {news.map((item) => {
          const style = categoryStyles[item.category]
          const Icon = style.icon
          return (
            <a
              key={item.id}
              href={item.external_url || '#'}
              target={item.external_url ? '_blank' : undefined}
              rel={item.external_url ? 'noopener noreferrer' : undefined}
              className="block bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${style.bg} ${style.text} flex items-center justify-center shrink-0`}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase ${style.text}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-[10px] text-gray-300">•</span>
                    <span className="text-[10px] text-gray-400">
                      {formatRelativeDate(item.published_at)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                    <span>{item.source}</span>
                    {item.external_url && <ExternalLink size={10} />}
                  </div>
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
