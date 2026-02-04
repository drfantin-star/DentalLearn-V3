'use client'

import React, { useState, useMemo } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Flame,
  BookOpen,
  Loader2,
} from 'lucide-react'

// Hooks Supabase
import {
  useFormations,
  useUserFormationProgress,
  getCategoryConfig,
  type Formation,
  type Sequence,
} from '@/lib/supabase'

// Composants
import FormationDetail from '@/components/formation/FormationDetail'
import SequencePlayer from '@/components/formation/SequencePlayer'

// ============================================
// TYPES
// ============================================

type ViewMode = 'catalog' | 'category' | 'formation' | 'sequence'

interface Category {
  id: string
  name: string
  shortName: string
  emoji: string
  bgColor: string
  textColor: string
  gradient: { from: string; to: string }
  type: 'cp' | 'bonus'
}

// ============================================
// DONNÉES — Catégories
// ============================================

const categories: Category[] = [
  { id: 'esthetique', name: 'Esthétique', shortName: 'Esthétique', emoji: '✨', bgColor: 'bg-violet-50', textColor: 'text-violet-600', gradient: { from: '#8B5CF6', to: '#A78BFA' }, type: 'cp' },
  { id: 'restauratrice', name: 'Dentisterie Restauratrice', shortName: 'Restauratrice', emoji: '🦷', bgColor: 'bg-amber-50', textColor: 'text-amber-700', gradient: { from: '#F59E0B', to: '#FBBF24' }, type: 'cp' },
  { id: 'chirurgie', name: 'Chirurgie Orale', shortName: 'Chirurgie', emoji: '🔪', bgColor: 'bg-rose-50', textColor: 'text-rose-600', gradient: { from: '#EF4444', to: '#F87171' }, type: 'cp' },
  { id: 'implant', name: 'Implantologie', shortName: 'Implant', emoji: '🔩', bgColor: 'bg-green-50', textColor: 'text-green-600', gradient: { from: '#10B981', to: '#34D399' }, type: 'cp' },
  { id: 'prothese', name: 'Prothèse', shortName: 'Prothèse', emoji: '👄', bgColor: 'bg-orange-50', textColor: 'text-orange-600', gradient: { from: '#F97316', to: '#FB923C' }, type: 'cp' },
  { id: 'parodontologie', name: 'Parodontologie', shortName: 'Paro', emoji: '🫧', bgColor: 'bg-pink-50', textColor: 'text-pink-600', gradient: { from: '#EC4899', to: '#F472B6' }, type: 'cp' },
  { id: 'endodontie', name: 'Endodontie', shortName: 'Endo', emoji: '🔬', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', gradient: { from: '#6366F1', to: '#818CF8' }, type: 'cp' },
  { id: 'radiologie', name: 'Radiologie', shortName: 'Radio', emoji: '📡', bgColor: 'bg-teal-50', textColor: 'text-teal-600', gradient: { from: '#14B8A6', to: '#2DD4BF' }, type: 'cp' },
  { id: 'soft-skills', name: 'Soft Skills', shortName: 'Soft Skills', emoji: '🤝', bgColor: 'bg-yellow-50', textColor: 'text-yellow-700', gradient: { from: '#D97706', to: '#F59E0B' }, type: 'bonus' },
]

// ============================================
// COMPOSANTS — Grilles catégories
// ============================================

function CategoryGrid({ cats, onSelect }: { cats: Category[]; onSelect: (cat: Category) => void }) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {cats.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat)}
          className={`flex flex-col items-center p-3 rounded-2xl border transition-all hover:shadow-md active:scale-95 ${cat.bgColor} border-gray-100`}
        >
          <span className="text-2xl mb-1">{cat.emoji}</span>
          <span className={`text-[11px] font-semibold ${cat.textColor} text-center leading-tight`}>
            {cat.shortName}
          </span>
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

      <ChevronRight size={16} className="text-gray-300 shrink-0" />
    </button>
  )
}

// ============================================
// COMPOSANT — Vue catégorie
// ============================================

function CategoryDetailView({
  category,
  formations,
  onBack,
  onSelectFormation,
}: {
  category: Category
  formations: Formation[]
  onBack: () => void
  onSelectFormation: (f: Formation) => void
}) {
  const categoryFormations = formations.filter(
    (f) => f.category?.toLowerCase() === category.id.toLowerCase()
  )

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
              <span className="text-2xl">{category.emoji}</span>
              <h1 className="text-lg font-bold text-gray-900">{category.name}</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        <div className="space-y-2">
          {categoryFormations.map((f) => (
            <FormationCard
              key={f.id}
              formation={f}
              onSelect={() => onSelectFormation(f)}
            />
          ))}
        </div>

        {categoryFormations.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">
            Aucune formation dans cette catégorie
          </p>
        )}
      </main>
    </>
  )
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function FormationPage() {
  // Récupérer les formations depuis Supabase
  const { formations, loading, error } = useFormations({ isPublished: true })

  // États de navigation
  const [viewMode, setViewMode] = useState<ViewMode>('catalog')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null)
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [sequenceGradient, setSequenceGradient] = useState<{ from: string; to: string }>({ from: '#8B5CF6', to: '#A78BFA' })

  // Hook pour la progression (mode preview)
  const { markCompleted } = useUserFormationProgress(selectedFormationId)

  const cpCategories = categories.filter((c) => c.type === 'cp')
  const bonusCategories = categories.filter((c) => c.type === 'bonus')

  // Navigation handlers
  const openCategory = (cat: Category) => {
    setSelectedCategory(cat)
    setViewMode('category')
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
      setViewMode(selectedCategory ? 'category' : 'catalog')
    } else if (viewMode === 'category') {
      setSelectedCategory(null)
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
  // RENDU — Category Detail
  // ============================================
  if (viewMode === 'category' && selectedCategory) {
    return (
      <CategoryDetailView
        category={selectedCategory}
        formations={formations}
        onBack={goBack}
        onSelectFormation={openFormation}
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
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-2xl font-black text-gray-900">Formations</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Connaissances &amp; compétences · Axes 1 &amp; 2
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-8">
        {/* Spécialités cliniques */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Spécialités cliniques
          </h2>
          <CategoryGrid cats={cpCategories} onSelect={openCategory} />
        </section>

        {/* Développement professionnel */}
        {bonusCategories.length > 0 && (
          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Développement professionnel
            </h2>
            <CategoryGrid cats={bonusCategories} onSelect={openCategory} />
          </section>
        )}

        {/* Populaires */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Flame size={20} className="text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900">Populaires</h2>
          </div>
          <div className="space-y-2">
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
