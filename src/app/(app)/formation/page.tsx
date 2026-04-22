'use client'

import React, { useState } from 'react'
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

  // États de navigation
  const [viewMode, setViewMode] = useState<ViewMode>('catalog')
  const [selectedFormationId, setSelectedFormationId] = useState<string | null>(null)
  const [selectedAccessType, setSelectedAccessType] = useState<'demo' | 'full' | null>(null)
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [sequenceGradient, setSequenceGradient] = useState<{ from: string; to: string }>({ from: '#8B5CF6', to: '#A78BFA' })

  // Hook pour la progression
  const { markCompleted } = useUserFormationProgress(selectedFormationId)
  const { isPreview } = usePreviewMode(selectedAccessType)

  const cpCategories = CATEGORIES.filter((c) => c.type === 'cp')

  // Navigation handlers
  const openCategory = (cat: Category) => {
    router.push(`/formation/${cat.id}?from=/formation`)
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
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push('/')}
            className="p-2 -ml-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <h1 className="text-2xl font-black text-white">Pratiques</h1>
        </div>
        <p className="text-sm font-semibold text-white/80 mt-1 leading-relaxed">
          Connaissances, compétences, qualité des pratiques · Axes 1 &amp; 2 de la certification périodique
        </p>
      </header>

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-8 min-h-screen" style={{ background: '#0F0F0F' }}>
        <section>
          <h2 className="text-xl font-black text-white mb-4">
            🔍 Explorer par spécialité
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {cpCategories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => openCategory(cat)}
                className="relative rounded-2xl overflow-hidden"
                style={{ aspectRatio: '3/2' }}
              >
                {cat.labelImageUrl ? (
                  <img
                    src={cat.labelImageUrl}
                    alt={cat.name}
                    className="w-full h-full object-cover absolute inset-0"
                  />
                ) : (
                  <div
                    className="w-full h-full absolute inset-0"
                    style={{ background: `linear-gradient(135deg, ${cat.gradient.from}, ${cat.gradient.to})` }}
                  />
                )}
                <div
                  className="absolute inset-0"
                  style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }}
                />
                <span
                  className="absolute font-bold text-white leading-tight"
                  style={{
                    bottom: '10px',
                    left: '12px',
                    fontSize: '16px',
                    textShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    maxWidth: 'calc(100% - 24px)',
                  }}
                >
                  {cat.name}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Info mode preview */}
        {isPreview && (
          <div className="p-4 flex items-start gap-3" style={{ background: '#1a2744', border: '0.5px solid #1e3a8a', borderRadius: '16px' }}>
            <BookOpen size={20} className="text-blue-500 shrink-0 mt-0.5" />
            <p className="text-sm text-blue-300">
              🔓 <strong>Mode Preview</strong> — Toutes les séquences sont accessibles
              pour tester. Connectez-vous pour sauvegarder votre progression.
            </p>
          </div>
        )}
      </main>
    </>
  )
}
