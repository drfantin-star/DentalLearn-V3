'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import EvenementItem from './EvenementItem'
import EventDetailModal from './EventDetailModal'
import type { EvenementItemData } from '@/types/evenements'

type FilterType = 'tous' | 'presentiel' | 'virtuel'

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'presentiel', label: 'Présentiel' },
  { key: 'virtuel', label: 'Classe virtuelle' },
]

interface EvenementsSectionProps {
  items: EvenementItemData[]
}

export default function EvenementsSection({ items }: EvenementsSectionProps) {
  const [filter, setFilter] = useState<FilterType>('tous')
  const [detailTarget, setDetailTarget] = useState<EvenementItemData | null>(null)

  const filteredItems = filter === 'tous'
    ? items
    : items.filter((i) => i.type === filter)

  return (
    <div className="space-y-3">
      {/* Pills filtre */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all',
              filter === f.key
                ? 'bg-primary text-white shadow-md'
                : 'bg-neutral-800 text-gray-500 border border-neutral-700 hover:bg-neutral-700',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {filteredItems.length === 0 ? (
          <p className="text-gray-500 text-sm py-4">Aucun événement à venir</p>
        ) : (
          filteredItems.map((item) => (
            <EvenementItem
              key={item.id}
              id={item.id}
              type={item.type}
              title={item.title}
              starts_at={item.starts_at}
              category={item.category}
              formateur_display_name={item.formateur_display_name}
              formateur_slug={item.formateur_slug}
              formateur_photo_url={item.formateur_photo_url}
              onClick={() => setDetailTarget(item)}
            />
          ))
        )}
      </div>

      {detailTarget && (
        <EventDetailModal item={detailTarget} onClose={() => setDetailTarget(null)} />
      )}
    </div>
  )
}
