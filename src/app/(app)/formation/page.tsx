'use client'

import React, { useState, useEffect } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  BookOpen,
  Loader2,
  Heart,
  ClipboardCheck,
} from 'lucide-react'
import { useRouter } from 'next/navigation'

// Hooks Supabase
import {
  useFormations,
  useUserFormationProgress,
  getCategoryConfig,
  CATEGORIES,
  type Formation,
  type Sequence,
  type CategoryConfig,
} from '@/lib/supabase'
import { createClient } from '@/lib/supabase/client'

// Composants
import FormationDetail from '@/components/formation/FormationDetail'
import SequencePlayer from '@/components/formation/SequencePlayer'

// ============================================
// TYPES
// ============================================

type ViewMode = 'catalog' | 'formation' | 'sequence'
type Category = CategoryConfig & { id: string }

// ============================================
// COMPOSANTS — Grilles catégories
// ============================================

function CategoryGrid({
  cats,
  onSelect,
  cols = 4,
  eppSlugs,
}: {
  cats: Category[]
  onSelect: (cat: Category) => void
  cols?: number
  eppSlugs: Set<string>
}) {
  const gridCols = cols === 3
    ? 'grid-cols-3 md:grid-cols-4 lg:grid-cols-6'
    : 'grid-cols-4 md:grid-cols-6 lg:grid-cols-8'
  return (
    <div className={`grid ${gridCols} gap-3`}>
      {cats.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat)}
          className={`flex flex-col items-center p-3 rounded-2xl border transition-all hover:shadow-md active:scale-95 ${cat.bgColor} border-gray-100 relative`}
        >
          <span className="text-2xl mb-1">{cat.emoji}</span>
          <span className={`text-[11px] font-semibold ${cat.textColor} text-center leading-tight`}>
            {cat.shortName}
          </span>
          {eppSlugs.has(cat.id) && (
            <span className="mt-1.5 inline-flex items-center gap-0.5 text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
              <ClipboardCheck size={8} />
              EPP
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

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
  const { formations, loading, error } = useFormations({ isPublished: true })

  // EPP : theme_slugs qui ont un audit publié
  const [eppSlugs, setEppSlugs] = useState<Set<string>>(new Set())

  useEffect(() => {
    async function fetchEppSlugs() {
      const supabase = createClient()
      const { data } = await supabase
        .from('epp_audits')
        .select('theme_slug')
        .eq('is_published', true)

      if (data) {
        setEppSlugs(new Set(data.map(d => d.theme_slug).filter(Boolean)))
      }
    }
    fetchEppSlugs()
  }, [])

  // États de navigation
  const [viewMode, setViewMode] = useState<ViewMode>('catalog')
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null)
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [sequenceGradient, setSequenceGradient] = useState<{ from: string; to: string }>({ from: '#8B5CF6', to: '#A78BFA' })

  // Hook pour la progression (mode preview)
  const { markCompleted } = useUserFormationProgress(selectedFormationId)

  const cpCategories = CATEGORIES.filter((c) => c.type === 'cp')
  const bonusCategories = CATEGORIES.filter((c) => c.type === 'bonus')

  // Navigation handlers
  const openCategory = (cat: Category) => {
    router.push(`/formation/${cat.id}`)
  }

  const openFormation = (f: Formation) => {
    setSelectedFormationId(f.id)
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
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-black text-gray-900">Formations</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Connaissances &amp; compétences · Axes 1 &amp; 2
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-8">
        {/* Spécialités cliniques */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Spécialités cliniques
          </h2>
          <CategoryGrid cats={cpCategories} onSelect={openCategory} eppSlugs={eppSlugs} />
        </section>

        {/* Développement professionnel */}
        {bonusCategories.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Développement professionnel
            </h2>
            <CategoryGrid cats={bonusCategories} onSelect={openCategory} cols={3} eppSlugs={eppSlugs} />
          </section>
        )}

        {/* Populaires */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Flame size={20} className="text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900">Populaires</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {formations.slice(0, 5).map((f) => (
              <FormationCard
                key={f.id}
                formation={f}
                onSelect={() => openFormation(f)}
              />
            ))}
          </div>
          {formations.length === 0 && (
            <p className="text-gray-400 text-sm text-center py-4">
              Aucune formation publiée
            </p>
          )}
        </section>

        {/* Info mode preview */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-start gap-3">
          <BookOpen size={20} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            🔓 <strong>Mode Preview</strong> — Toutes les séquences sont accessibles
            pour tester. Connectez-vous pour sauvegarder votre progression.
          </p>
        </div>
      </main>
    </>
  )
}
