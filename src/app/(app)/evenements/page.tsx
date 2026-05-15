'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import EvenementsSection from '@/components/evenements/EvenementsSection'
import type { EvenementItemData } from '@/types/evenements'

export default function EvenementsPage() {
  const [items, setItems] = useState<EvenementItemData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/evenements?limit=20')
      .then((r) => r.json())
      .then((data: EvenementItemData[]) => {
        setItems(Array.isArray(data) ? data : [])
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="pb-20 px-4 pt-6 space-y-4">
      <h1 className="text-xl font-black text-white flex items-center gap-2">
        📅 Événements
      </h1>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      ) : (
        <EvenementsSection items={items} />
      )}
    </main>
  )
}
