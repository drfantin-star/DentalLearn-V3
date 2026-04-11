'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Loader2,
  Heart,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// Hooks Supabase
import {
  useFormations,
  useUserFormationProgress,
  usePreviewMode,
  getCategoryConfig,
  CATEGORIES,
  type Formation,
  type Sequence,
  type CategoryConfig,
} from '@/lib/supabase'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/lib/hooks/useUser'

// Composants
import FormationDetail from '@/components/formation/FormationDetail'
import SequencePlayer from '@/components/formation/SequencePlayer'

// ============================================
// TYPES
// ============================================

type ViewMode = 'catalog' | 'formation' | 'sequence'
type Category = CategoryConfig & { id: string }

// ============================================
// COMPOSANT — Carte formation
// ============================================

function FormationCard({ formation, onSelect }: { formation: Formation; onSelect: () => void }) {
  const config = getCategoryConfig(formation.category)

  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left"
    >
      <div className={`w-10 h-10 rounded-xl ${config.bgColor} flex items-center justify-center shrink-0`}>
        <span className="text-xl">{config.emoji}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <h3 className="font-semibold text-sm text-gray-800 truncate">
            {formation.title}
          </h3>
          {formation.cp_eligible && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-200">
              CP
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span>{formation.instructor_name}</span>
          <span>{formation.total_sequences} séq.</span>
        </div>
      </div>

      {/* Likes count */}
      {formation.likes_count > 0 && (
        <div className="flex items-center gap-1 text-pink-500 shrink-0 mr-1">
          <Heart size={14} className="fill-pink-500" />
          <span className="text-xs font-semibold">{formation.likes_count}</span>
        </div>
      )}

      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </button>
  )
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function FormationPage() {
  const router = useRouter()

  // Récupérer les formations depuis Supabase
  const { formations: allFormations, loading, error } = useFormations({ isPublished: true })
  const formations = allFormations.filter(f => f.cp_axe_id === 1 || f.cp_axe_id === 2 || f.cp_axe_id === null)

  const { user } = useUser()
  const [formationProgress, setFormationProgress] = useState<Record<string, { isStarted: boolean; isCompleted: boolean }>>({})

  const catScrollRef = useRef<HTMLDivElement>(null)
  const catScrollLeft = () => catScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const catScrollRight = () => catScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })

  const nouveautesScrollRef = useRef<HTMLDivElement>(null)
  const nouveautesScrollLeft = () => nouveautesScrollRef.current?.scrollBy({ left: -320, behavior: 'smooth' })
  const nouveautesScrollRight = () => nouveautesScrollRef.current?.scrollBy({ left: 320, behavior: 'smooth' })

  useEffect(() => {
    if (!user?.id || formations.length === 0) return
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

  // États de navigation
  const [viewMode, setViewMode] = useState<ViewMode>('catalog')
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null)
  const [selectedAccessType, setSelectedAccessType] = useState<'demo' | 'full' | null>(null)
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [sequenceGradient, setSequenceGradient] = useState<{ from: string; to: string }>({ from: '#8B5CF6', to: '#A78BFA' })

  // Hook pour la progression
  const { markCompleted } = useUserFormationProgress(selectedFormationId, selectedAccessType)
  const { isPreview } = usePreviewMode(selectedAccessType)

  const cpCategories = CATEGORIES.filter((c) => c.type === 'cp')

  // Navigation handlers
  const openCategory = (cat: Category) => {
    router.push(`/formation/${cat.id}`)
  }

  const openFormation = (f: Formation) => {
    setSelectedFormationId(f.id)
    setSelectedAccessType(f.access_type)
    const config = getCategoryConfig(f.category)
    setSequenceGradient(config.gradient)
    setViewMode('formation')
  }

  const openSequence = (seq: Sequence) => {
    setSelectedSequence(seq)
    setViewMode('sequence')
  }

  const goBack = () => {
    if (viewMode === 'sequence') {
      setSelectedSequence(null)
      setViewMode('formation')
    } else if (viewMode === 'formation') {
      setSelectedFormationId(null)
      setViewMode('catalog')
    }
  }

  const handleSequenceComplete = (score: number, totalPoints: number) => {
    console.log('✅ Séquence terminée:', { score, totalPoints })

    // Marquer comme complétée (localement en mode preview)
    if (selectedSequence) {
      markCompleted(selectedSequence.id, selectedSequence.sequence_number + 1)
    }

    setSelectedSequence(null)
    setViewMode('formation')
  }

  // ============================================
  // RENDU — Sequence Player
  // ============================================
  if (viewMode === 'sequence' && selectedSequence) {
    return (
      <SequencePlayer
        sequence={selectedSequence}
        categoryGradient={sequenceGradient}
        coverImageUrl={formations.find(f => f.id === selectedFormationId)?.cover_image_url}
        onBack={goBack}
        onComplete={handleSequenceComplete}
      />
    )
  }

  // ============================================
  // RENDU — Formation Detail
  // ============================================
  if (viewMode === 'formation' && selectedFormationId) {
    return (
      <FormationDetail
        formationId={selectedFormationId}
        onBack={goBack}
        onStartSequence={openSequence}
      />
    )
  }

  // ============================================
  // RENDU — Catalogue principal
  // ============================================

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">Erreur : {error.message}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-100 rounded-xl text-sm"
          >
            Réessayer
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="bg-gradient-to-br from-[#1E40AF] to-[#3B82F6] px-4 py-4">
        <h1 className="text-2xl font-black text-white">Pratiques</h1>
        <p className="text-xs font-semibold text-white/80 mt-1 leading-relaxed">
          Connaissances, compétences, qualité des pratiques · Axes 1 &amp; 2 de la certification périodique
        </p>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-8">
        {/* Spécialités cliniques */}
        <section>
          <h2 className="text-base font-bold text-gray-900 mb-3">
            Explore par spécialité
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
              {cpCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => openCategory(cat)}
                  className="flex-shrink-0 snap-start flex items-center gap-2.5 rounded-2xl px-3.5"
                  style={{
                    width: 'calc(25vw - 16px)',
                    maxWidth: '220px',
                    minWidth: '160px',
                    height: '88px',
                    background: `linear-gradient(135deg, ${cat.gradient.from}, ${cat.gradient.to})`,
                  }}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0 text-xl leading-none">
                    {cat.emoji}
                  </div>
                  <span className="text-white font-semibold leading-snug text-left flex-1 text-xs md:text-sm">
                    <span className="md:hidden">{cat.shortName}</span>
                    <span className="hidden md:inline">{cat.name}</span>
                  </span>
                </button>
              ))}
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
          <div className="relative">
            <button
              onClick={nouveautesScrollLeft}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              <ChevronLeft size={20} />
            </button>

            <div
              ref={nouveautesScrollRef}
              className="flex gap-2.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-2 snap-x snap-mandatory"
            >
              {[...formations]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .slice(0, 6)
                .map((f) => {
                  const config = getCategoryConfig(f.category)
                  const progress = formationProgress[f.id]
                  const ctaLabel = progress?.isCompleted
                    ? '✓ Terminé'
                    : progress?.isStarted
                    ? 'Continuer →'
                    : 'Découvrir'
                  const ctaGradient = progress?.isCompleted
                    ? 'linear-gradient(135deg, #059669, #10B981)'
                    : `linear-gradient(135deg, ${config.gradient.from}, ${config.gradient.to})`
                  return (
                    <button
                      key={f.id}
                      onClick={() => openFormation(f)}
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
                          background: !f.cover_image_url
                            ? `linear-gradient(135deg, ${config.gradient.from}33, ${config.gradient.from}66)`
                            : undefined,
                        }}
                      >
                        {f.cover_image_url ? (
                          <img
                            src={f.cover_image_url}
                            alt={f.title}
                            className="w-full h-full object-cover"
                          />
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
              onClick={nouveautesScrollRight}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 w-10 h-10 rounded-full bg-white shadow-md items-center justify-center text-gray-600 hover:bg-gray-50"
            >
              <ChevronRight size={20} />
            </button>
          </div>
          {formations.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">
              Aucune formation publiée
            </p>
          )}
        </section>

        {/* Info mode preview */}
        {isPreview && (
          <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-start gap-3">
            <BookOpen size={20} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-700">
              🔓 <strong>Mode Preview</strong> — Toutes les séquences sont accessibles
              pour tester. Connectez-vous pour sauvegarder votre progression.
            </p>
          </div>
        )}
      </main>
    </>
  )
}
