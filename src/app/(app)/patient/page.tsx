'use client'

import React, { useState, useEffect, useRef } from 'react'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'
import { CATEGORIES, getCategoryConfig } from '@/lib/supabase/types'
import type { Formation } from '@/lib/supabase/types'
import { type Theme } from '@/components/ui/ThemeCard'
import ThemeDetail from '@/components/shared/ThemeDetail'
import FormationDetail from '@/components/formation/FormationDetail'
import SequencePlayer from '@/components/formation/SequencePlayer'
import { useUserFormationProgress, type Sequence } from '@/lib/supabase'

// ============================================
// DONNÉES — Thèmes Patient (Axe 3)
// ============================================

const PATIENT_THEMES: Theme[] = [
  {
    id: 'communication',
    emoji: '🗣️',
    title: 'Communication patient',
    description: 'Techniques de communication et écoute active',
    color: '#F59E0B',
    bgLight: 'bg-amber-50',
    contents: [
      { type: 'Écoute active & Communication', icon: '🎮', status: 'available', tag: 'cp', slug: 'communication-relation-therapeutique' },
      { type: 'Auto-évaluation', icon: '📊', status: 'available', tag: 'cp' },
      { type: 'EPP - Audit clinique', icon: '📋', status: 'coming', tag: 'cp' },
      { type: 'Fiche pratique', icon: '📄', status: 'available', tag: 'bonus' },
    ],
  },
  {
    id: 'consentement',
    emoji: '📝',
    title: 'Consentement éclairé',
    description: 'Cadre juridique et bonnes pratiques',
    color: '#F59E0B',
    bgLight: 'bg-amber-50',
    contents: [
      { type: 'Formation gamifiée', icon: '🎮', status: 'available', tag: 'cp' },
      { type: 'EPP - Audit clinique', icon: '📋', status: 'coming', tag: 'cp' },
      { type: 'Fiche pratique', icon: '📄', status: 'available', tag: 'bonus' },
    ],
  },
  {
    id: 'conflits',
    emoji: '🤝',
    title: 'Gestion des conflits',
    description: 'Médiation et résolution de conflits',
    color: '#F59E0B',
    bgLight: 'bg-amber-50',
    contents: [
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming', tag: 'cp' },
      { type: 'Fiche pratique', icon: '📄', status: 'coming', tag: 'bonus' },
    ],
  },
  {
    id: 'ethique',
    emoji: '⚖️',
    title: 'Éthique & Déontologie',
    description: 'Obligations déontologiques et cas pratiques',
    color: '#F59E0B',
    bgLight: 'bg-amber-50',
    contents: [
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming', tag: 'cp' },
      { type: 'Action réflexive', icon: '🪞', status: 'coming', tag: 'cp' },
    ],
  },
]

// ============================================
// PAGE
// ============================================

export default function PatientPage() {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)
  const [viewMode, setViewMode] = useState<'themes' | 'formation' | 'sequence'>('themes')
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null)
  const [selectedAccessType, setSelectedAccessType] = useState<'demo' | 'full' | null>(null)
  const [selectedCoverImageUrl, setSelectedCoverImageUrl] = useState<string | null>(null)
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [sequenceGradient] = useState({ from: '#F59E0B', to: '#FCD34D' })

  const { user } = useUser()
  const [axe3Formations, setAxe3Formations] = useState<Formation[]>([])
  const [formationProgress, setFormationProgress] = useState<Record<string, { isStarted: boolean; isCompleted: boolean }>>({})
  const [loadingFormations, setLoadingFormations] = useState(true)
  const catScrollRef = useRef<HTMLDivElement>(null)
  const catScrollLeft = () => catScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const catScrollRight = () => catScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })
  const newScrollRef = useRef<HTMLDivElement>(null)
  const newScrollLeft = () => newScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const newScrollRight = () => newScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })

  useEffect(() => {
    async function fetchAxe3() {
      const supabase = createClient()
      const { data } = await supabase
        .from('formations')
        .select('*')
        .eq('is_published', true)
        .eq('cp_axe_id', 3)
        .order('created_at', { ascending: false })
      if (data) setAxe3Formations(data)
      setLoadingFormations(false)
    }
    fetchAxe3()
  }, [])

  useEffect(() => {
    if (!user?.id || axe3Formations.length === 0) return
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
  }, [user?.id, axe3Formations])

  const { markCompleted } = useUserFormationProgress(selectedFormationId, selectedAccessType)

  const handleContentClick = async (slug: string) => {
    try {
      const { createClient } = await import('@/lib/supabase/client')
      const supabase = createClient()
      const { data } = await supabase
        .from('formations')
        .select('id, access_type, cover_image_url')
        .eq('slug', slug)
        .single()
      if (data) {
        setSelectedFormationId(data.id)
        setSelectedAccessType(data.access_type)
        setSelectedCoverImageUrl(data.cover_image_url)
        setViewMode('formation')
      }
    } catch (err) {
      console.error('Erreur résolution slug:', err)
    }
  }

  const openSequence = (seq: Sequence) => {
    setSelectedSequence(seq)
    setViewMode('sequence')
  }

  const handleSequenceComplete = async (score: number, totalPoints: number) => {
    if (selectedSequence && selectedFormationId) {
      markCompleted(selectedSequence.id, selectedSequence.sequence_number + 1)
    }
    try { await fetch('/api/streaks/update', { method: 'POST' }) } catch {}
    setSelectedSequence(null)
    setViewMode('formation')
  }

  const goBack = () => {
    if (viewMode === 'sequence') {
      setSelectedSequence(null)
      setViewMode('formation')
    } else if (viewMode === 'formation') {
      setSelectedFormationId(null)
      setSelectedAccessType(null)
      setViewMode('themes')
    }
  }

  // Rendu séquence
  if (viewMode === 'sequence' && selectedSequence) {
    return (
      <SequencePlayer
        sequence={selectedSequence}
        categoryGradient={sequenceGradient}
        coverImageUrl={selectedCoverImageUrl}
        onBack={goBack}
        onComplete={handleSequenceComplete}
      />
    )
  }

  // Rendu formation
  if (viewMode === 'formation' && selectedFormationId) {
    return (
      <FormationDetail
        formationId={selectedFormationId}
        onBack={goBack}
        onStartSequence={openSequence}
      />
    )
  }

  // Rendu thème sélectionné
  if (selectedTheme) {
    return (
      <ThemeDetail
        theme={selectedTheme}
        accentColor="#F59E0B"
        onBack={() => setSelectedTheme(null)}
        onFormationClick={handleContentClick}
      />
    )
  }

  const axe3Categories = CATEGORIES.filter((c) => c.type === 'axe3')

  return (
    <>
      <header className="bg-gradient-to-br from-[#F97316] to-[#FBBF24] px-4 py-4">
        <h1 className="text-2xl font-black text-white">Relation Patient</h1>
        <p className="text-sm font-semibold text-white/80 mt-1 leading-relaxed">
          Améliorer la relation avec les patients · Axe 3 de la certification périodique
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
              {axe3Categories.map((cat) => {
                const theme = PATIENT_THEMES.find((t) => t.id === cat.id)
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
          ) : axe3Formations.length === 0 ? (
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
                {axe3Formations.map((f) => {
                  const config = getCategoryConfig(f.category)
                  const progress = formationProgress[f.id]
                  const ctaLabel = progress?.isCompleted
                    ? '✓ Terminé'
                    : progress?.isStarted
                    ? 'Continuer →'
                    : 'Découvrir'
                  const ctaGradient = progress?.isCompleted
                    ? 'linear-gradient(135deg, #059669, #10B981)'
                    : 'linear-gradient(135deg, #F97316, #FBBF24)'
                  return (
                    <button
                      key={f.id}
                      onClick={() => handleContentClick(f.slug)}
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
