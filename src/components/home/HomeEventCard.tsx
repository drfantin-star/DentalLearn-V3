'use client'

import Link from 'next/link'
import { MapPin, Video } from 'lucide-react'
import type { EvenementItemData } from '@/types/evenements'

interface HomeEventCardProps {
  item: EvenementItemData
}

// Carte événement de la home — même langage visuel que HomeHeroCard
// (eyebrow en haut, titre dominant, CTA en bas), adaptée à une grille
// de plusieurs cartes de hauteur égale plutôt qu'à une tuile hero unique.
export default function HomeEventCard({ item }: HomeEventCardProps) {
  const date = new Date(item.starts_at)
  const dateLabel = date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
  const timeLabel = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const href = item.type === 'virtuel' ? `/sessions/${item.id}` : '/evenements'

  return (
    <Link
      href={href}
      className="relative flex flex-col h-full min-h-[160px] rounded-2xl p-4 shadow-md overflow-hidden transition-colors hover:bg-white/[0.03]"
      style={{ background: '#1C1C1E', border: '0.5px solid rgba(255,255,255,0.08)' }}
    >
      <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-neutral-400">
        {item.type === 'presentiel' ? <MapPin size={12} /> : <Video size={12} />}
        <span className="capitalize">{dateLabel}</span>
        <span>· {timeLabel}</span>
      </p>
      <div className="flex flex-1 items-center">
        <h3 className="text-2xl font-semibold leading-tight text-neutral-100 line-clamp-3">
          {item.title}
        </h3>
      </div>
      <span className="mt-auto w-full rounded-xl flex items-center justify-center gap-1.5 font-bold py-2.5 text-sm border border-white/15 text-neutral-100">
        {item.type === 'presentiel' ? 'Voir les détails' : 'Rejoindre'}
      </span>
    </Link>
  )
}
