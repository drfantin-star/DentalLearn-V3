'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import EvenementItem from './EvenementItem'
import type { EvenementItemData } from '@/types/evenements'

type FilterType = 'tous' | 'presentiel' | 'virtuel'

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'presentiel', label: 'Présentiel' },
  { key: 'virtuel', label: 'Classe virtuelle' },
]

interface EvenementsSectionProps {
  items: EvenementItemData[]
  showVoirTout?: boolean
}

export default function EvenementsSection({ items, showVoirTout }: EvenementsSectionProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterType>('tous')
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToast({ text, type })
    setTimeout(() => setToast(null), 5000)
  }

  function handleItemClick(item: EvenementItemData) {
    if (item.type === 'virtuel') {
      router.push(`/sessions/${item.id}`)
    } else {
      showToast('Contactez le formateur pour vous inscrire')
    }
  }

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
              onClick={() => { handleItemClick(item) }}
            />
          ))
        )}
      </div>

      {/* Lien "Voir tout" */}
      {showVoirTout && items.length > 0 && (
        <Link
          href="/evenements"
          className="block text-center text-sm font-semibold text-primary hover:text-primary-hover transition-colors py-1"
        >
          Voir tout →
        </Link>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-semibold',
            'px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2',
            toast.type === 'error' ? 'bg-red-600' : 'bg-green-600',
          )}
        >
          {toast.type === 'error' && <AlertTriangle size={16} />}
          {toast.text}
        </div>
      )}
    </div>
  )
}
