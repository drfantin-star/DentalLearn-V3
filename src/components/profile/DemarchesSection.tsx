'use client'

import { useRef } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import DemarcheCard from '@/components/home/DemarcheCard'
import type { DemarcheEnCours } from '@/lib/hooks/useDemarches'

interface DemarchesSectionProps {
  demarches: DemarcheEnCours[]
  loading: boolean
}

export default function DemarchesSection({ demarches, loading }: DemarchesSectionProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollLeft = () => scrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const scrollRight = () => scrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })

  return (
    <section>
      <h2 className="text-base font-bold text-white flex items-center gap-2 mb-3">
        <BookOpen size={18} className="text-[#8B5CF6]" />
        Mes demarches en cours
      </h2>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-white/40" size={24} />
        </div>
      ) : demarches.length > 0 ? (
        <div className="relative">
          <button
            onClick={scrollLeft}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full glass-card shadow-md items-center justify-center text-white/70 hover:text-white transition-premium"
          >
            <ChevronLeft size={20} />
          </button>
          <div
            ref={scrollRef}
            className="flex gap-3 overflow-x-auto scroll-smooth pb-2 snap-x snap-mandatory scrollbar-hide -mx-4 px-4"
          >
            {demarches.map(d => <DemarcheCard key={d.id} demarche={d} size="large" />)}
          </div>
          <button
            onClick={scrollRight}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full glass-card shadow-md items-center justify-center text-white/70 hover:text-white transition-premium"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      ) : (
        <div className="glass-card p-5 text-center rounded-2xl">
          <p className="text-white/55 text-sm">Aucune demarche en cours</p>
        </div>
      )}
    </section>
  )
}
