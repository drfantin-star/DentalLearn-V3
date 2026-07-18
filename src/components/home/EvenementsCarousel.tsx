'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MapPin, Video, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import MediaCard, { mediaCardSizeStyle } from '@/components/home/MediaCard'
import EventDetailModal from '@/components/evenements/EventDetailModal'
import { eventCategoryGradientStyle } from '@/lib/utils/eventCategoryGradient'
import type { EvenementItemData } from '@/types/evenements'

interface EvenementsCarouselProps {
  items: EvenementItemData[]
}

// Section Événements home — même shell de carte (MediaCard) et même
// carrousel (flèches + scroll horizontal) que les autres rangées de la
// home ("Pour vous", "Actualités"). Clic sur une carte = ouverture du
// détail (jamais d'action directe d'inscription/rejoindre sur la carte).
// Carte "Agenda" cliquable en fin de carrousel -> /evenements, à la place
// du lien "Voir tout" bleu.
export default function EvenementsCarousel({ items }: EvenementsCarouselProps) {
  const router = useRouter()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [detailTarget, setDetailTarget] = useState<EvenementItemData | null>(null)

  function scroll(dir: 'left' | 'right') {
    scrollRef.current?.scrollBy({ left: dir === 'left' ? -320 : 320, behavior: 'smooth' })
  }

  if (items.length === 0) return null

  return (
    <section>
      <h2 className="text-base font-bold text-[#e5e5e5] mb-3 flex items-center gap-2">
        <CalendarDays size={18} className="text-violet-400" /> Événements
      </h2>
      <div className="relative">
        <button
          onClick={() => scroll('left')}
          className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
          aria-label="Précédent"
        >
          <ChevronLeft size={20} />
        </button>
        <div
          ref={scrollRef}
          className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2 snap-x snap-mandatory"
        >
          {items.map((item) => {
            const gradientStyle = eventCategoryGradientStyle(item.category)
            const dateLabel = new Date(item.starts_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
            const timeLabel = new Date(item.starts_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
            return (
              <MediaCard
                key={item.id}
                aspect="landscape"
                onClick={() => setDetailTarget(item)}
                ariaLabel={item.title}
                topLeft={
                  <span className="flex items-center justify-center w-7 h-7 rounded-full bg-black/30 text-white">
                    {item.type === 'presentiel' ? <MapPin size={13} /> : <Video size={13} />}
                  </span>
                }
                fallback={
                  <div
                    style={gradientStyle ?? { background: 'radial-gradient(ellipse at 70% 40%, #6B7280cc 0%, #6B728044 55%, #0d0d1a 100%)' }}
                    className="absolute inset-0"
                  />
                }
              >
                <p className="text-[11px] font-semibold text-white/75 capitalize">
                  {dateLabel} · {timeLabel}
                </p>
                <p
                  style={{
                    fontSize: '14px',
                    fontWeight: 700,
                    color: 'white',
                    lineHeight: 1.3,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    textShadow: '0 1px 3px rgba(0,0,0,0.6)',
                  }}
                >
                  {item.title}
                </p>
              </MediaCard>
            )
          })}

          {/* Carte "Agenda" — même gabarit, fin de carrousel, remplace "Voir tout" */}
          <button
            type="button"
            onClick={() => router.push('/evenements')}
            aria-label="Voir l'agenda complet"
            className="flex-shrink-0 snap-start rounded-2xl overflow-hidden text-left active:scale-[0.98] transition-transform duration-150 relative flex flex-col items-center justify-center gap-2"
            style={{
              ...mediaCardSizeStyle('landscape'),
              border: '0.5px solid #333',
              background: '#1C1C1E',
            }}
          >
            <CalendarDays size={24} className="text-violet-400" />
            <span className="text-sm font-bold text-neutral-100">Agenda</span>
          </button>
        </div>
        <button
          onClick={() => scroll('right')}
          className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md items-center justify-center text-gray-300 hover:bg-gray-50"
          aria-label="Suivant"
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {detailTarget && (
        <EventDetailModal item={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </section>
  )
}
