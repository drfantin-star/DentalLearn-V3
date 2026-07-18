'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { MapPin, Video } from 'lucide-react'
import type { EvenementItemData } from '@/types/evenements'
import { eventCategoryGradientStyle } from '@/lib/utils/eventCategoryGradient'

interface HomeEventCardProps {
  item: EvenementItemData
}

function getInitials(name: string): string {
  return name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('')
}

// Carte événement de la home — même langage visuel que HomeHeroCard
// (eyebrow en haut, titre dominant, CTA en bas), adaptée à une grille
// de plusieurs cartes de hauteur égale plutôt qu'à une tuile hero unique.
export default function HomeEventCard({ item }: HomeEventCardProps) {
  const router = useRouter()
  const date = new Date(item.starts_at)
  const dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeLabel = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const href = item.type === 'virtuel' ? `/sessions/${item.id}` : '/evenements'
  const gradientStyle = eventCategoryGradientStyle(item.category)
  const hasGradient = Boolean(gradientStyle)

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => router.push(href)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') router.push(href) }}
      style={gradientStyle ?? { background: '#1C1C1E', border: '0.5px solid rgba(255,255,255,0.08)' }}
      className="relative flex flex-col h-full min-h-[160px] rounded-2xl p-4 shadow-md overflow-hidden cursor-pointer transition-colors hover:brightness-110"
    >
      <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest ${hasGradient ? 'text-white/80' : 'text-neutral-400'}`}>
        {item.type === 'presentiel' ? <MapPin size={12} /> : <Video size={12} />}
        <span className="capitalize">{dateLabel}</span>
        <span>· {timeLabel}</span>
      </p>
      <div className="flex flex-1 items-center">
        <h3 className={`text-2xl font-semibold leading-tight line-clamp-3 ${hasGradient ? 'text-white' : 'text-neutral-100'}`}>
          {item.title}
        </h3>
      </div>
      {item.formateur_display_name && (
        <div className="flex items-center gap-1.5 mb-2">
          <div className={`w-5 h-5 rounded-full overflow-hidden shrink-0 flex items-center justify-center ${hasGradient ? 'bg-white/20' : 'bg-neutral-700'}`}>
            {item.formateur_photo_url ? (
              <img src={item.formateur_photo_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className={`text-[9px] font-bold ${hasGradient ? 'text-white' : 'text-neutral-300'}`}>
                {getInitials(item.formateur_display_name)}
              </span>
            )}
          </div>
          {item.formateur_slug ? (
            <Link
              href={`/formateurs/${item.formateur_slug}`}
              onClick={(e) => e.stopPropagation()}
              className={`text-xs hover:underline ${hasGradient ? 'text-white/90' : 'text-neutral-300'}`}
            >
              {item.formateur_display_name}
            </Link>
          ) : (
            <span className={`text-xs ${hasGradient ? 'text-white/80' : 'text-neutral-300'}`}>
              {item.formateur_display_name}
            </span>
          )}
        </div>
      )}
      <span className={`mt-auto w-full rounded-xl flex items-center justify-center gap-1.5 font-bold py-2.5 text-sm border ${hasGradient ? 'border-white/25 text-white' : 'border-white/15 text-neutral-100'}`}>
        {item.type === 'presentiel' ? 'Voir les détails' : 'Rejoindre'}
      </span>
    </div>
  )
}
