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

interface ThemeDetailProps {
  theme: Theme
  accentColor: string // couleur du Play button (#F59E0B pour Patient, #EC4899 pour Santé)
  onBack: () => void
  onFormationClick?: (slug: string) => void
}

export default function ThemeDetail({
  theme,
  accentColor,
  onBack,
  onFormationClick,
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
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 -ml-2 hover:bg-gray-50 rounded-xl transition-colors"
            >
              <ChevronLeft size={20} className="text-gray-600" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{theme.emoji}</span>
              <h1 className="text-lg font-bold text-gray-900">{theme.title}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-3">
        <p className="text-sm text-gray-500 mb-2">{theme.description}</p>

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
                               z-10 w-10 h-10 rounded-full bg-white shadow-md
                               items-center justify-center text-gray-600 hover:bg-gray-50"
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
                        const config = f ? getCategoryConfig(f.category) : null
                        const progress = f ? formationProgress[f.id] : null
                        const ctaLabel = progress?.isCompleted
                          ? '✓ Terminé'
                          : progress?.isStarted
                          ? 'Continuer →'
                          : 'Découvrir'
                        const ctaStyle = progress?.isCompleted
                          ? 'linear-gradient(135deg, #059669, #10B981)'
                          : `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)`

                        return (
                          <button
                            key={i}
                            onClick={() => {
                              if (content.slug) {
                                if (onFormationClick) {
                                  onFormationClick(content.slug)
                                } else {
                                  router.push(
                                    `/formation/relation-patient?formation=${content.slug}`
                                  )
                                }
                              }
                            }}
                            className="flex-shrink-0 snap-start bg-white rounded-2xl overflow-hidden border border-gray-100 text-left"
                            style={{
                              width: 'calc(50vw - 24px)',
                              maxWidth: '220px',
                              minWidth: '148px',
                            }}
                          >
                            <div
                              className="w-full aspect-square flex items-center justify-center"
                              style={{
                                background: f?.cover_image_url
                                  ? undefined
                                  : config
                                  ? `linear-gradient(135deg, ${config.gradient.from}33, ${config.gradient.from}66)`
                                  : `${accentColor}22`,
                              }}
                            >
                              {f?.cover_image_url ? (
                                <img
                                  src={f.cover_image_url}
                                  alt={f.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <span className="text-5xl">{content.icon}</span>
                              )}
                            </div>
                            <div className="p-2.5 flex flex-col gap-2">
                              <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">
                                {f?.title || content.type}
                              </p>
                              <div
                                className="w-full text-center text-xs font-semibold text-white py-1.5 rounded-xl"
                                style={{ background: ctaStyle }}
                              >
                                {ctaLabel}
                              </div>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>

                  <button
                    onClick={scrollRight}
                    className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4
                               z-10 w-10 h-10 rounded-full bg-white shadow-md
                               items-center justify-center text-gray-600 hover:bg-gray-50"
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
                    className={`w-full bg-white rounded-xl p-4 border text-left transition-all ${
                      isAvailable
                        ? 'border-gray-100 shadow-sm hover:shadow-md cursor-pointer'
                        : 'border-gray-50 opacity-50 cursor-not-allowed'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{content.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-gray-900 text-sm">
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
                        <p className="text-[11px] text-gray-400 mt-0.5">
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
