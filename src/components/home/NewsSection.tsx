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
import type { NewsArticle } from '@/types/database'

interface NewsSectionProps {
  news: NewsArticle[]
  loading: boolean
}

const categoryStyles = {
  reglementaire: {
    icon: Scale,
    gradient: 'linear-gradient(135deg, #1D4ED8, #3B82F6)',
    iconBg: 'bg-white/20',
    text: 'text-white',
  },
  scientifique: {
    icon: FlaskConical,
    gradient: 'linear-gradient(135deg, #6D28D9, #8B5CF6)',
    iconBg: 'bg-white/20',
    text: 'text-white',
  },
  pratique: {
    icon: Stethoscope,
    gradient: 'linear-gradient(135deg, #0F766E, #14B8A6)',
    iconBg: 'bg-white/20',
    text: 'text-white',
  },
  humour: {
    icon: PartyPopper,
    gradient: 'linear-gradient(135deg, #BE185D, #EC4899)',
    iconBg: 'bg-white/20',
    text: 'text-white',
  },
}

export default function NewsSection({ news, loading }: NewsSectionProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null)

  if (loading) {
    return (
      <section>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Newspaper size={20} className="text-[#2D1B96]" /> News
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
          <Newspaper size={20} className="text-[#2D1B96]" /> News
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
          <Newspaper size={20} className="text-[#2D1B96]" /> News
        </h2>
        <button className="text-xs font-bold text-[#2D1B96] flex items-center gap-1">
          Tout voir <ChevronRight size={14} />
        </button>
      </div>
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto scroll-smooth
                   snap-x snap-mandatory scrollbar-hide -mx-4 px-4 pb-2"
      >
        {news.map((item) => {
          const style = categoryStyles[item.category]
          const Icon = style.icon
          return (
            <a
              key={item.id}
              href={item.external_url || '#'}
              target={item.external_url ? '_blank' : undefined}
              rel={item.external_url ? 'noopener noreferrer' : undefined}
              className="flex-shrink-0 snap-start rounded-2xl overflow-hidden shadow-md
                         hover:shadow-lg transition-all active:scale-95"
              style={{
                width: 'calc(75vw - 24px)',
                maxWidth: '280px',
                background: style.gradient,
              }}
            >
              <div className="p-4 flex flex-col gap-3 h-full">

                {/* Icône catégorie */}
                <div className={`w-10 h-10 rounded-xl ${style.iconBg}
                                 flex items-center justify-center shrink-0`}>
                  <Icon size={20} className="text-white" />
                </div>

                {/* Titre — 3 lignes max */}
                <h3 className="text-white font-bold text-sm leading-snug line-clamp-3 flex-1">
                  {item.title}
                </h3>

                {/* Source */}
                <div className="flex items-center gap-1">
                  <span className="text-white/60 text-xs truncate">{item.source}</span>
                  {item.external_url && <ExternalLink size={10} className="text-white/40 flex-shrink-0" />}
                </div>

              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}
