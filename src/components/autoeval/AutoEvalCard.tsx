'use client'

import Link from 'next/link'
import { ChevronRight, HeartPulse } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { AXE_GRADIENTS } from '@/lib/bibliotheque/types'

/**
 * Carte d'entrée vers l'auto-évaluation santé, placée sur /sante sous la
 * bibliothèque. Même recette que BibliothequeBanner : AXE_GRADIENTS[4].
 */
export default function AutoEvalCard({ className }: { className?: string }) {
  const { from, to } = AXE_GRADIENTS[4]
  return (
    <Link
      href="/sante/auto-evaluation"
      aria-label="Auto-évaluation de ma santé professionnelle — Action B"
      className={cn(
        'group flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left text-white shadow-lg transition-transform',
        'hover:scale-[1.01] active:scale-[0.99]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F0F]',
        className
      )}
      style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
    >
      <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-white/20">
        <HeartPulse size={22} className="text-white" aria-hidden="true" />
      </div>
      <div className="min-w-0 flex-1">
        <h2 className="truncate text-base font-black leading-tight">Auto-évaluation de ma santé</h2>
        <p className="mt-0.5 truncate text-xs font-semibold text-white/80">
          Un miroir, pas un diagnostic · 15-20 min · Action B
        </p>
      </div>
      <ChevronRight
        size={20}
        aria-hidden="true"
        className="flex-shrink-0 text-white/70 transition-transform group-hover:translate-x-0.5 group-hover:text-white"
      />
    </Link>
  )
}
