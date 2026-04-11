'use client'

import React, { useState, useEffect, useRef } from 'react'
import { HeartPulse, ChevronRight, ChevronLeft, Play, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { CATEGORIES, getCategoryConfig } from '@/lib/supabase/types'
import type { Formation } from '@/lib/supabase/types'

// Thèmes Santé Pro — basé sur le prototype V5
const SANTE_THEMES = [
  {
    id: 'ergonomie',
    emoji: '🧘',
    title: 'Ergonomie au cabinet',
    description: 'Postures de travail et aménagement du poste',
    color: '#EC4899',
    bgLight: 'bg-pink-50',
    contents: [
      { type: 'Formation gamifiée', icon: '🎮', status: 'available' },
      { type: 'Auto-évaluation', icon: '📊', status: 'available' },
      { type: 'EPP - Audit clinique', icon: '📋', status: 'coming' },
      { type: 'Programme exercices', icon: '🏋️', status: 'available' },
    ],
  },
  {
    id: 'tms',
    emoji: '💪',
    title: 'Prévention TMS',
    description: 'Troubles musculosquelettiques et prévention',
    color: '#EC4899',
    bgLight: 'bg-pink-50',
    contents: [
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming' },
      { type: 'Fiche pratique', icon: '📄', status: 'available' },
      { type: 'Programme exercices', icon: '🏋️', status: 'available' },
    ],
  },
  {
    id: 'stress',
    emoji: '🧠',
    title: 'Gestion du stress',
    description: 'Burn-out, charge mentale et prévention',
    color: '#EC4899',
    bgLight: 'bg-pink-50',
    contents: [
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming' },
      { type: 'Auto-évaluation', icon: '📊', status: 'coming' },
      { type: 'Fiche pratique', icon: '📄', status: 'coming' },
    ],
  },
  {
    id: 'hygiene-vie',
    emoji: '😴',
    title: 'Hygiène de vie',
    description: 'Sommeil, nutrition et activité physique',
    color: '#EC4899',
    bgLight: 'bg-pink-50',
    contents: [
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming' },
      { type: 'Action réflexive', icon: '🪞', status: 'coming' },
    ],
  },
  {
    id: 'bilan-sante',
    emoji: '📊',
    title: 'Bilan santé praticien',
    description: 'Suivi médical et dépistages recommandés',
    color: '#EC4899',
    bgLight: 'bg-pink-50',
    contents: [
      { type: 'Fiche pratique', icon: '📄', status: 'coming' },
      { type: 'Action réflexive', icon: '🪞', status: 'coming' },
    ],
  },
]

type Theme = (typeof SANTE_THEMES)[number]

function ThemeCard({
  theme,
  onOpen,
}: {
  theme: Theme
  onOpen: (t: Theme) => void
}) {
  const hasEPP = theme.contents.some(
    (c) => c.type === 'EPP - Audit clinique'
  )

  return (
    <button
      onClick={() => onOpen(theme)}
      className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left hover:shadow-md hover:scale-[1.01] transition-all active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{theme.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-bold text-gray-900 text-sm">{theme.title}</h3>
            {hasEPP && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E0F7F5] text-[#00D1C1]">
                EPP
              </span>
            )}
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">
            {theme.description}
          </p>
          <div className="flex items-center gap-1 mt-2">
            {theme.contents.map((content, i) => (
              <span
                key={i}
                className={`text-sm ${
                  content.status === 'coming' ? 'opacity-40' : ''
                }`}
                title={content.type}
              >
                {content.icon}
              </span>
            ))}
          </div>
        </div>
        <ChevronRight size={16} className="text-gray-300 mt-2 shrink-0" />
      </div>
    </button>
  )
}

function ThemeDetail({
  theme,
  onBack,
}: {
  theme: Theme
  onBack: () => void
}) {
  return (
    <>
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
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

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-3">
        <p className="text-sm text-gray-500 mb-4">{theme.description}</p>

        {theme.contents.map((content, i) => {
          const isAvailable = content.status === 'available'

          return (
            <button
              key={i}
              disabled={!isAvailable}
              className={`w-full bg-white rounded-xl p-4 border text-left transition-all ${
                isAvailable
                  ? 'border-gray-100 shadow-sm hover:shadow-md'
                  : 'border-gray-50 opacity-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{content.icon}</span>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-sm">
                    {content.type}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isAvailable ? 'Disponible' : 'Prochainement'}
                  </p>
                </div>
                {isAvailable ? (
                  <Play size={16} className="text-[#EC4899] shrink-0" />
                ) : (
                  <span className="text-[10px] text-gray-300 font-medium">
                    Bientôt
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </main>
    </>
  )
}

export default function SantePage() {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)
  const { user } = useUser()
  const [axe4Formations, setAxe4Formations] = useState<Formation[]>([])
  const [formationProgress, setFormationProgress] = useState<Record<string, { isStarted: boolean; isCompleted: boolean }>>({})
  const [loadingFormations, setLoadingFormations] = useState(true)
  const catScrollRef = useRef<HTMLDivElement>(null)
  const catScrollLeft = () => catScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const catScrollRight = () => catScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })
  const newScrollRef = useRef<HTMLDivElement>(null)
  const newScrollLeft = () => newScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const newScrollRight = () => newScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })

  useEffect(() => {
    async function fetchAxe4() {
      const supabase = createClient()
      const { data } = await supabase
        .from('formations')
        .select('*')
        .eq('is_published', true)
        .eq('cp_axe_id', 4)
        .order('created_at', { ascending: false })
      if (data) setAxe4Formations(data)
      setLoadingFormations(false)
    }
    fetchAxe4()
  }, [])

  useEffect(() => {
    if (!user?.id || axe4Formations.length === 0) return
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
  }, [user?.id, axe4Formations])

  if (selectedTheme) {
    return (
      <ThemeDetail
        theme={selectedTheme}
        onBack={() => setSelectedTheme(null)}
      />
    )
  }

  const axe4Categories = CATEGORIES.filter((c) => c.type === 'axe4')

  return (
    <>
      <header className="bg-gradient-to-br from-[#EC4899] to-[#A78BFA] px-4 py-4">
        <h1 className="text-2xl font-black text-white">Santé Praticien</h1>
        <p className="text-sm font-semibold text-white/80 mt-1 leading-relaxed">
          Mieux prendre en compte sa santé personnelle · Axe 4 de la certification périodique
        </p>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-8">

        {/* Explore par thème */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">
            Explore par thème
          </h2>
          <div className="relative">
            <button
              onClick={catScrollLeft}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              <ChevronLeft size={20} />
            </button>
            <div
              ref={catScrollRef}
              className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x snap-mandatory"
            >
              {axe4Categories.map((cat) => {
                const theme = SANTE_THEMES.find((t) => t.id === cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => theme && setSelectedTheme(theme)}
                    className="flex-shrink-0 snap-start flex items-center gap-2.5 rounded-2xl px-3.5"
                    style={{
                      width: 'calc(25vw - 16px)',
                      maxWidth: '220px',
                      minWidth: '160px',
                      height: '88px',
                      background: `linear-gradient(135deg, ${cat.gradient.from}, ${cat.gradient.to})`,
                      border: '1px solid rgba(255,255,255,0.35)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
                    }}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 text-xl leading-none">
                      {cat.emoji}
                    </div>
                    <span className="text-white font-semibold leading-snug text-left flex-1 text-sm md:text-base">
                      <span className="md:hidden">{cat.shortName}</span>
                      <span className="hidden md:inline">{cat.name}</span>
                    </span>
                  </button>
                )
              })}
            </div>
            <button
              onClick={catScrollRight}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </section>

        {/* Fraîchement arrivé */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">
            ⚡ Fraîchement arrivé
          </h2>
          {loadingFormations ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-gray-400" size={24} />
            </div>
          ) : axe4Formations.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">
              Aucune formation disponible pour le moment
            </p>
          ) : (
            <div className="relative">
              <button
                onClick={newScrollLeft}
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-gray-600 hover:bg-gray-50"
              >
                <ChevronLeft size={20} />
              </button>
              <div
                ref={newScrollRef}
                className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x snap-mandatory"
              >
                {axe4Formations.map((f) => {
                  const config = getCategoryConfig(f.category)
                  const progress = formationProgress[f.id]
                  const ctaLabel = progress?.isCompleted
                    ? '✓ Terminé'
                    : progress?.isStarted
                    ? 'Continuer →'
                    : 'Découvrir'
                  const ctaGradient = progress?.isCompleted
                    ? 'linear-gradient(135deg, #059669, #10B981)'
                    : 'linear-gradient(135deg, #EC4899, #A78BFA)'
                  return (
                    <button
                      key={f.id}
                      onClick={() => {
                        setSelectedTheme(
                          SANTE_THEMES.find((t) => t.id === f.category) || SANTE_THEMES[0]
                        )
                      }}
                      className="flex-shrink-0 snap-start bg-white rounded-2xl overflow-hidden border border-gray-100 text-left"
                      style={{ width: 'calc(50vw - 24px)', maxWidth: '220px', minWidth: '148px' }}
                    >
                      <div
                        className="w-full aspect-square flex items-center justify-center"
                        style={{
                          background: !f.cover_image_url
                            ? `linear-gradient(135deg, ${config.gradient.from}33, ${config.gradient.from}66)`
                            : undefined,
                        }}
                      >
                        {f.cover_image_url ? (
                          <img src={f.cover_image_url} alt={f.title} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-5xl">{config.emoji}</span>
                        )}
                      </div>
                      <div className="p-2.5 flex flex-col gap-2">
                        <p className="text-xs font-semibold text-gray-900 leading-snug line-clamp-2">
                          {f.title}
                        </p>
                        <div
                          className="w-full text-center text-xs font-semibold text-white py-1.5 rounded-xl"
                          style={{ background: ctaGradient }}
                        >
                          {ctaLabel}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
              <button
                onClick={newScrollRight}
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-gray-600 hover:bg-gray-50"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}
        </section>

      </main>
    </>
  )
}
