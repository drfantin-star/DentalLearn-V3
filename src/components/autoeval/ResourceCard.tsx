'use client'

import { ExternalLink, Heart, LifeBuoy } from 'lucide-react'
import type { RoutingCard } from '@/lib/autoeval/types'
import SpsCard from './SpsCard'

/**
 * Carte ressource générique issue du routage. La variante 'sps' délègue à SpsCard ;
 * 'sensitive' (ex. violence) adopte un ton discret.
 */
export default function ResourceCard({ card }: { card: RoutingCard }) {
  if (card.variant === 'sps') return <SpsCard card={card} />

  const sensitive = card.variant === 'sensitive'
  const Icon = sensitive ? Heart : LifeBuoy

  return (
    <div
      className={`rounded-2xl border p-4 ${
        sensitive
          ? 'border-[#A78BFA]/40 bg-[#A78BFA]/10'
          : 'border-[#333] bg-[#1a1a1a]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${
            sensitive ? 'bg-[#A78BFA]/20' : 'bg-[#EC4899]/15'
          }`}
        >
          <Icon size={20} className={sensitive ? 'text-[#A78BFA]' : 'text-[#EC4899]'} />
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-bold text-white">{card.title}</h4>
          <p className="mt-1 text-xs leading-relaxed text-[#d4d4d4]">{card.body}</p>
          {card.href && (
            <a
              href={card.href}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#EC4899] hover:underline"
            >
              En savoir plus <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
