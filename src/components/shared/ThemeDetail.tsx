'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Play, Loader2 } from 'lucide-react'
import FilterTabs, { type FilterTab } from '@/components/ui/FilterTabs'
import type { Theme } from '@/components/ui/ThemeCard'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { getCategoryConfig } from '@/lib/supabase/types'
import type { Formation } from '@/lib/supabase/types'
import FormationCardOverlay from '@/components/home/FormationCardOverlay'

interface ThemeDetailProps {
  theme: Theme
  accentColor: string // couleur du Play button (#F59E0B pour Patient, #EC4899 pour Santé)
  onBack: () => void
  onFormationClick?: (slug: string) => void
  fromPage?: string
}

export default function ThemeDetail({
  theme,
  accentColor,
  onBack,
  onFormationClick,
  fromPage = '/formation',
}: ThemeDetailProps) {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterTab>('tous')

  const { user } = useUser()
  const [formations, setFormations] = useState<Record<string, Formation>>({})
  const [formationProgress, setFormationProgress] = useState<
    Record<string, { isStarted: boolean; isCompleted: boolean }>
  >({})
  const [loadingFormations, setLoadingFormations] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollLeft = () =>
    scrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const scrollRight = () =>
    scrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })

  // Charger les formations depuis Supabase pour les slugs disponibles
  const availableSlugs = theme.contents
    .filter((c) => c.slug && c.status === 'available')
    .map((c) => c.slug as string)

  useEffect(() => {
    if (availableSlugs.length === 0) return
    async function fetchFormations() {
      setLoadingFormations(true)
      const supabase = createClient()
      const { data } = await supabase
        .from('formations')
        .select('*')
        .in('slug', availableSlugs)
      if (data) {
        const map: Record<string, Formation> = {}
        data.forEach((f) => {
          map[f.slug] = f
        })
        setFormations(map)
      }
      setLoadingFormations(false)
    }
    fetchFormations()
  }, [theme.id])

  useEffect(() => {
    if (!user?.id || Object.keys(formations).length === 0) return
    async function fetchProgress() {
      const supabase = createClient()
      const { data } = await supabase
        .from('user_formations')
        .select('formation_id, current_sequence, completed_at')
        .eq('user_id', user!.id)
      if (data) {
        const map: Record<string, { isStarted: boolean; isCompleted: boolean }> = {}
        data.forEach((uf) => {
          map[uf.formation_id] = {
            isStarted: true,
            isCompleted: !!uf.completed_at,
          }
        })
        setFormationProgress(map)
      }
    }
    fetchProgress()
  }, [user?.id, formations])

  const hasCp = theme.contents.some((c) => c.tag === 'cp')
  const hasBonus = theme.contents.some((c) => c.tag === 'bonus')
  const showFilters = hasCp && hasBonus

  const filteredContents = theme.contents.filter((c) => {
    if (filter === 'cp') return c.tag === 'cp'
    if (filter === 'bonus') return c.tag === 'bonus'
    return true
  })

  return (
    <>
      <header className="sticky top-0 z-30" style={{ background: '#1a1a1a', borderBottom: '0.5px solid #2a2a2a' }}>
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-[#242424] rounded-xl transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-300" />
            </button>
            <h1 className="text-lg font-bold text-white">{theme.title}</h1>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-3 min-h-screen" style={{ background: '#0F0F0F' }}>
        <p className="text-sm text-[#a3a3a3] mb-2">{theme.description}</p>

        {/* Filtres CP / Bonus */}
        {showFilters && (
          <div className="pb-2">
            <FilterTabs active={filter} onChange={setFilter} />
          </div>
        )}

        {/* ── FORMATIONS (cards carrées avec cover) ── */}
        {(() => {
          const formationContents = filteredContents.filter(
            (c) => c.slug && c.status === 'available'
          )
          const otherContents = filteredContents.filter(
            (c) => !c.slug || c.status !== 'available'
          )

          return (
            <>
              {/* Carousel formations */}
              {formationContents.length > 0 && (
                <div className="relative">
                  <button
                    onClick={scrollLeft}
                    className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4
                               z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md
                               items-center justify-center text-gray-300 hover:bg-[#2e2e2e]"
                  >
                    <ChevronLeft size={20} />
                  </button>

                  <div
                    ref={scrollRef}
                    className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x snap-mandatory"
                  >
                    {loadingFormations ? (
                      <div className="flex items-center justify-center w-full py-8">
                        <Loader2 className="animate-spin text-gray-400" size={24} />
                      </div>
                    ) : (
                      formationContents.map((content, i) => {
                        const f = content.slug ? formations[content.slug] : null
                        if (!f) return null
                        return (
                          <FormationCardOverlay
                            key={i}
                            formation={f}
                            progress={formationProgress[f.id]}
                            onClick={() => {
                              if (onFormationClick) {
                                onFormationClick(content.slug!)
                              } else {
                                router.push(
                                  `/formation/${theme.id}?formation=${content.slug}&from=${fromPage}`
                                )
                              }
                            }}
                            accentGradient={`linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`}
                          />
                        )
                      })
                    )}
                  </div>

                  <button
                    onClick={scrollRight}
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4
                               z-10 w-10 h-10 rounded-full bg-[#242424] shadow-md
                               items-center justify-center text-gray-300 hover:bg-[#2e2e2e]"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>
              )}

              {/* Liste autres contenus (auto-éval, fiches, prochainement) */}
              {otherContents.map((content, i) => {
                const isAvailable = content.status === 'available'
                return (
                  <button
                    key={i}
                    disabled={!isAvailable}
                    style={{
                      background: '#242424',
                      border: `0.5px solid ${isAvailable ? '#444' : '#333'}`,
                      borderRadius: '12px',
                      padding: '16px',
                      width: '100%',
                      textAlign: 'left',
                      opacity: isAvailable ? 1 : 0.5,
                      cursor: isAvailable ? 'pointer' : 'not-allowed',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{content.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-[#e5e5e5] text-sm">
                            {content.type}
                          </h3>
                          {content.tag && (
                            <span
                              className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                                content.tag === 'cp'
                                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                  : 'bg-yellow-50 text-yellow-600 border-yellow-200'
                              }`}
                            >
                              {content.tag === 'cp' ? 'CP' : 'Bonus'}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#6b7280] mt-0.5">
                          {isAvailable ? 'Disponible' : 'Prochainement'}
                        </p>
                      </div>
                      {isAvailable ? (
                        <Play
                          size={16}
                          className="shrink-0"
                          style={{ color: accentColor }}
                        />
                      ) : (
                        <span className="text-[10px] text-gray-300 font-medium">
                          Bientôt
                        </span>
                      )}
                    </div>
                  </button>
                )
              })}
            </>
          )
        })()}
      </main>
    </>
  )
}
