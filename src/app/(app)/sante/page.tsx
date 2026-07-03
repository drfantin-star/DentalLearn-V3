'use client'

import React, { useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { CATEGORIES, getLabelCutoutUrl } from '@/lib/supabase/types'
import BibliothequeBanner from '@/components/ui/BibliothequeBanner'
import CutoutCardRender from '@/components/home/CutoutCardRender'
import AutoEvalCard from '@/components/autoeval/AutoEvalCard'
import { useRessourceCount } from '@/lib/bibliotheque/useRessourceCount'

function SantePageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const themeId = searchParams.get('theme')
    if (themeId) router.replace(`/formation/${themeId}?from=/sante`)
  }, [])

  const axe4Categories = CATEGORIES.filter((c) => c.type === 'axe4')
  const biblioCount = useRessourceCount(4)

  return (
    <>
      <header className="bg-gradient-to-br from-[#EC4899] to-[#A78BFA] px-4 py-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push('/')}
            className="p-2 -ml-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <h1 className="text-2xl font-black text-white">Santé Praticien</h1>
        </div>
        <p className="text-sm font-semibold text-white/80 mt-1 leading-relaxed">
          Mieux prendre en compte sa santé personnelle · Axe 4 de la certification périodique
        </p>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 min-h-screen" style={{ background: '#0F0F0F' }}>
        <BibliothequeBanner
          axe={4}
          href="/sante/bibliotheque"
          count={biblioCount}
          className="mb-3"
        />
        <AutoEvalCard className="mb-6" />
        <h2 className="text-xl font-black text-white mb-4">
          🔍 Explorer par thème
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {axe4Categories.map((cat) => {
            const cutoutUrl = getLabelCutoutUrl(cat)
            return (
              <button
                key={cat.id}
                onClick={() => router.push(`/formation/${cat.id}?from=/sante`)}
                className="relative rounded-2xl overflow-hidden"
                style={{ aspectRatio: '3/2' }}
              >
                {cutoutUrl ? (
                  <CutoutCardRender
                    cutoutSrc={cutoutUrl}
                    colorFrom={cat.gradient.from}
                    title={cat.name}
                    variant="theme"
                  />
                ) : (
                  <>
                    <div
                      className="absolute inset-0"
                      style={{ background: `linear-gradient(135deg, ${cat.gradient.from}, ${cat.gradient.to})` }}
                    />
                    <div
                      className="absolute inset-0"
                      style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }}
                    />
                    <span
                      className="absolute font-bold text-white leading-tight"
                      style={{ bottom: '10px', left: '12px', fontSize: '16px', textShadow: '0 1px 3px rgba(0,0,0,0.4)', maxWidth: 'calc(100% - 24px)' }}
                    >
                      {cat.name}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </main>
    </>
  )
}

export default function SantePage() {
  return (
    <Suspense>
      <SantePageContent />
    </Suspense>
  )
}
