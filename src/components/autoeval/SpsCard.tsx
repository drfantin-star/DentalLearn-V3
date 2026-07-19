'use client'

import { Phone } from 'lucide-react'
import type { RoutingCard } from '@/lib/autoeval/types'

/**
 * Carte d'écoute SPS — ton posé, jamais imposé. Le numéro est cliquable (tel:).
 */
export default function SpsCard({ card }: { card: RoutingCard }) {
  const telHref = card.phone ? `tel:${card.phone.replace(/\s/g, '')}` : undefined
  return (
    <div className="rounded-2xl border border-pink-500/40 bg-pink-500/10 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-pink-500/20">
          <Phone size={20} className="text-pink-500" />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-white">{card.title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-[#d4d4d4]">{card.body}</p>
          {card.phone && (
            <a
              href={telHref}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
            >
              <Phone size={16} />
              {card.phone}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
