'use client'

import React, { useState } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  Lock,
  Play,
  Flame,
  BookOpen,
} from 'lucide-react'

// Import des composants de formation
import FormationDetail, {
  type FormationDetailData,
  type Sequence,
  generateMockSequences,
} from '@/components/formation/FormationDetail'
import SequencePlayer, {
  mockQuestions,
} from '@/components/formation/SequencePlayer'

// ============================================
// TYPES
// ============================================

type FilterTab = 'toutes' | 'cp' | 'bonus'
type ViewMode = 'catalog' | 'category' | 'formation' | 'sequence'

interface Category {
  id: string
  name: string
  shortName: string
  emoji: string
  bgColor: string
  textColor: string
  borderColor: string
  gradient: { from: string; to: string }
  type: 'cp' | 'bonus'
  formationCount: number
}

interface FormationListItem {
  id: string
  rank?: number
  title: string
  instructor: string
  categoryId: string
  categoryEmoji: string
  categoryBgColor: string
  gradient: { from: string; to: string }
  likes: number
  isCP: boolean
  badge?: 'NOUVEAU' | 'POPULAIRE'
  isEnCours?: boolean
  progressPercent?: number
  currentSequence?: number
  totalSequences: number
  totalPoints: number
}

// ============================================
// DONNÉES — Catégories
// ============================================

const categories: Category[] = [
  // CP — Spécialités cliniques
  {
    id: 'esthetique',
    name: 'Esthétique',
    shortName: 'Esthétique',
    emoji: '✨',
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-600',
    borderColor: 'border-violet-100',
    gradient: { from: '#8B5CF6', to: '#A78BFA' },
    type: 'cp',
    formationCount: 2,
  },
  {
    id: 'restauratrice',
    name: 'Dentisterie Restauratrice',
    shortName: 'Restauratrice',
    emoji: '🦷',
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-100',
    gradient: { from: '#F59E0B', to: '#FBBF24' },
    type: 'cp',
    formationCount: 3,
  },
  {
    id: 'chirurgie',
    name: 'Chirurgie Orale',
    shortName: 'Chirurgie',
    emoji: '🔪',
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-600',
    borderColor: 'border-rose-100',
    gradient: { from: '#EF4444', to: '#F87171' },
    type: 'cp',
    formationCount: 1,
  },
  {
    id: 'implant',
    name: 'Implantologie',
    shortName: 'Implant',
    emoji: '🔩',
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    borderColor: 'border-green-100',
    gradient: { from: '#10B981', to: '#34D399' },
    type: 'cp',
    formationCount: 2,
  },
  {
    id: 'prothese',
    name: 'Prothèse',
    shortName: 'Prothèse',
    emoji: '👄',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-100',
    gradient: { from: '#F97316', to: '#FB923C' },
    type: 'cp',
    formationCount: 2,
  },
  {
    id: 'paro',
    name: 'Parodontologie',
    shortName: 'Paro',
    emoji: '🫧',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-100',
    gradient: { from: '#EC4899', to: '#F472B6' },
    type: 'cp',
    formationCount: 1,
  },
  {
    id: 'endo',
    name: 'Endodontie',
    shortName: 'Endo',
    emoji: '🔬',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-100',
    gradient: { from: '#6366F1', to: '#818CF8' },
    type: 'cp',
    formationCount: 1,
  },
  {
    id: 'radio',
    name: 'Radiologie',
    shortName: 'Radio',
    emoji: '📡',
    bgColor: 'bg-teal-50',
    textColor: 'text-teal-600',
    borderColor: 'border-teal-100',
    gradient: { from: '#14B8A6', to: '#2DD4BF' },
    type: 'cp',
    formationCount: 1,
  },
  // Bonus
  {
    id: 'management',
    name: 'Management',
    shortName: 'Management',
    emoji: '💼',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-100',
    gradient: { from: '#64748B', to: '#94A3B8' },
    type: 'bonus',
    formationCount: 2,
  },
  {
    id: 'organisation',
    name: 'Organisation',
    shortName: 'Organisation',
    emoji: '📋',
    bgColor: 'bg-stone-50',
    textColor: 'text-stone-600',
    borderColor: 'border-stone-100',
    gradient: { from: '#78716C', to: '#A8A29E' },
    type: 'bonus',
    formationCount: 1,
  },
  {
    id: 'softskills',
    name: 'Soft Skills',
    shortName: 'Soft Skills',
    emoji: '🤝',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    borderColor: 'border-yellow-100',
    gradient: { from: '#D97706', to: '#F59E0B' },
    type: 'bonus',
    formationCount: 1,
  },
]

// ============================================
// DONNÉES — Formations
// ============================================

const formationsList: FormationListItem[] = [
  {
    id: 'f1',
    rank: 1,
    title: 'Composite stratifié antérieur',
    instructor: 'Dr Marc Revised',
    categoryId: 'esthetique',
    categoryEmoji: '✨',
    categoryBgColor: 'bg-violet-100',
    gradient: { from: '#8B5CF6', to: '#A78BFA' },
    likes: 203,
    isCP: true,
    badge: 'POPULAIRE',
    totalSequences: 15,
    totalPoints: 825,
  },
  {
    id: 'f2',
    rank: 2,
    title: 'Éclaircissements & Taches Blanches',
    instructor: 'Dr Laurent Elbeze',
    categoryId: 'esthetique',
    categoryEmoji: '✨',
    categoryBgColor: 'bg-violet-100',
    gradient: { from: '#8B5CF6', to: '#A78BFA' },
    likes: 142,
    isCP: true,
    isEnCours: true,
    progressPercent: 40,
    currentSequence: 6,
    totalSequences: 15,
    totalPoints: 825,
  },
  {
    id: 'f3',
    rank: 3,
    title: 'Fêlures : Diagnostic & Traitement',
    instructor: 'Dr Gauthier Weisrock',
    categoryId: 'restauratrice',
    categoryEmoji: '🦷',
    categoryBgColor: 'bg-amber-100',
    gradient: { from: '#F59E0B', to: '#FBBF24' },
    likes: 98,
    isCP: true,
    badge: 'NOUVEAU',
    isEnCours: true,
    progressPercent: 7,
    currentSequence: 1,
    totalSequences: 15,
    totalPoints: 810,
  },
  {
    id: 'f4',
    rank: 4,
    title: 'Onlays céramiques : de A à Z',
    instructor: 'Dr Sophie Laurent',
    categoryId: 'restauratrice',
    categoryEmoji: '🦷',
    categoryBgColor: 'bg-amber-100',
    gradient: { from: '#F59E0B', to: '#FBBF24' },
    likes: 176,
    isCP: true,
    totalSequences: 15,
    totalPoints: 800,
  },
  {
    id: 'f5',
    rank: 5,
    title: 'Management d\'équipe au cabinet',
    instructor: 'Coach Pierre Martin',
    categoryId: 'management',
    categoryEmoji: '💼',
    categoryBgColor: 'bg-slate-100',
    gradient: { from: '#64748B', to: '#94A3B8' },
    likes: 89,
    isCP: false,
    totalSequences: 12,
    totalPoints: 600,
  },
]

// ============================================
// HELPER — Convertir FormationListItem en FormationDetailData
// ============================================

function toFormationDetail(f: FormationListItem): FormationDetailData {
  const cat = categories.find((c) => c.id === f.categoryId)
  return {
    id: f.id,
    title: f.title,
    instructor: f.instructor,
    category: f.categoryId,
    categoryGradient: f.gradient,
    categoryEmoji: f.categoryEmoji,
    totalSequences: f.totalSequences,
    totalPoints: f.totalPoints,
    likes: f.likes,
    isCP: f.isCP,
    sequences: generateMockSequences(f.totalSequences + 1), // +1 pour intro (seq 0)
    userProgress: f.isEnCours
      ? {
          currentSequence: f.currentSequence || 0,
          completedSequences: Array.from(
            { length: f.currentSequence || 0 },
            (_, i) => i
          ),
          totalPoints: Math.round(
            (f.totalPoints * (f.progressPercent || 0)) / 100
          ),
        }
      : null,
  }
}

// ============================================
// COMPOSANTS — Grilles catégories
// ============================================

function CategoryGrid({
  cats,
  onSelect,
}: {
  cats: Category[]
  onSelect: (cat: Category) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-3">
      {cats.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat)}
          className={`flex flex-col items-center p-3 rounded-2xl border transition-all hover:shadow-md active:scale-95 ${cat.bgColor} ${cat.borderColor}`}
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

function BonusGrid({
  cats,
  onSelect,
}: {
  cats: Category[]
  onSelect: (cat: Category) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {cats.map((cat) => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat)}
          className={`flex flex-col items-center p-4 rounded-2xl border transition-all hover:shadow-md active:scale-95 ${cat.bgColor} ${cat.borderColor}`}
        >
          <span className="text-2xl mb-1">{cat.emoji}</span>
          <span className={`text-xs font-semibold ${cat.textColor}`}>
            {cat.shortName}
          </span>
        </button>
      ))}
    </div>
  )
}

// ============================================
// COMPOSANT — Carte formation populaire
// ============================================

function PopularFormationCard({
  formation,
  onSelect,
}: {
  formation: FormationListItem
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full flex items-center gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all text-left"
    >
      {/* Rang */}
      {formation.rank && (
        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-gray-500">{formation.rank}</span>
        </div>
      )}

      {/* Emoji catégorie */}
      <div className={`w-10 h-10 rounded-xl ${formation.categoryBgColor} flex items-center justify-center shrink-0`}>
        <span className="text-xl">{formation.categoryEmoji}</span>
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <h3 className="font-semibold text-sm text-gray-800 truncate">
            {formation.title}
          </h3>
          {formation.isCP && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-200">
              CP
            </span>
          )}
          {formation.badge && (
            <span
              className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                formation.badge === 'NOUVEAU'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-orange-50 text-orange-600'
              }`}
            >
              {formation.badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-400">
          <span>{formation.totalSequences} séq.</span>
          <span className="flex items-center gap-1">
            <Heart size={10} className="text-red-400 fill-red-400" />
            {formation.likes}
          </span>
        </div>
      </div>

      {/* Progression ou flèche */}
      {formation.isEnCours ? (
        <div className="flex items-center gap-2">
          <div className="w-12 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#8B5CF6] rounded-full"
              style={{ width: `${formation.progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] font-bold text-gray-400">
            {formation.progressPercent}%
          </span>
        </div>
      ) : (
        <ChevronRight size={16} className="text-gray-300 shrink-0" />
      )}
    </button>
  )
}

// ============================================
// COMPOSANT — Vue détail catégorie
// ============================================

function CategoryDetailView({
  category,
  formations,
  onBack,
  onSelectFormation,
}: {
  category: Category
  formations: FormationListItem[]
  onBack: () => void
  onSelectFormation: (f: FormationListItem) => void
}) {
  const [filter, setFilter] = useState<FilterTab>('toutes')

  const categoryFormations = formations.filter(
    (f) => f.categoryId === category.id
  )

  const filteredFormations = categoryFormations.filter((f) => {
    if (filter === 'cp') return f.isCP
    if (filter === 'bonus') return !f.isCP
    return true
  })

  const hasCp = categoryFormations.some((f) => f.isCP)
  const hasBonus = categoryFormations.some((f) => !f.isCP)
  const showFilters = hasCp && hasBonus

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
        {showFilters && (
          <div className="mb-4">
            <FilterTabs active={filter} onChange={setFilter} />
          </div>
        )}

        <div className="space-y-2">
          {filteredFormations.map((f) => (
            <PopularFormationCard
              key={f.id}
              formation={f}
              onSelect={() => onSelectFormation(f)}
            />
          ))}
        </div>

        {filteredFormations.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">
            Aucune formation dans cette catégorie
          </p>
        )}
      </main>
    </>
  )
}

// ============================================
// COMPOSANT — FilterTabs
// ============================================

function FilterTabs({
  active,
  onChange,
}: {
  active: FilterTab
  onChange: (tab: FilterTab) => void
}) {
  const tabs: { key: FilterTab; label: string; emoji?: string }[] = [
    { key: 'toutes', label: 'Toutes' },
    { key: 'cp', label: 'Certif. Périodique', emoji: '🏅' },
    { key: 'bonus', label: 'Bonus', emoji: '🎁' },
  ]

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap transition-all ${
            active === tab.key
              ? 'bg-[#2D1B96] text-white shadow-md'
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          {tab.emoji && <span>{tab.emoji}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  )
}

// ============================================
// PAGE PRINCIPALE
// ============================================

export default function FormationPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('catalog')
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [selectedFormation, setSelectedFormation] = useState<FormationDetailData | null>(null)
  const [selectedSequence, setSelectedSequence] = useState<Sequence | null>(null)
  const [isPremium] = useState(false) // TODO: Connecter à Supabase

  const cpCategories = categories.filter((c) => c.type === 'cp')
  const bonusCategories = categories.filter((c) => c.type === 'bonus')

  // Navigation handlers
  const openCategory = (cat: Category) => {
    setSelectedCategory(cat)
    setViewMode('category')
  }

  const openFormation = (f: FormationListItem) => {
    setSelectedFormation(toFormationDetail(f))
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
      setSelectedFormation(null)
      setViewMode(selectedCategory ? 'category' : 'catalog')
    } else if (viewMode === 'category') {
      setSelectedCategory(null)
      setViewMode('catalog')
    }
  }

  const handleSequenceComplete = (score: number, totalPoints: number) => {
    // TODO: Mettre à jour Supabase
    console.log('Sequence complete:', { score, totalPoints })
    setSelectedSequence(null)
    setViewMode('formation')
  }

  // ============================================
  // RENDU — Sequence Player
  // ============================================
  if (viewMode === 'sequence' && selectedSequence && selectedFormation) {
    return (
      <SequencePlayer
        sequence={selectedSequence}
        categoryGradient={selectedFormation.categoryGradient}
        questions={mockQuestions}
        onBack={goBack}
        onComplete={handleSequenceComplete}
      />
    )
  }

  // ============================================
  // RENDU — Formation Detail
  // ============================================
  if (viewMode === 'formation' && selectedFormation) {
    return (
      <FormationDetail
        formation={selectedFormation}
        isPremium={isPremium}
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
        formations={formationsList}
        onBack={goBack}
        onSelectFormation={openFormation}
      />
    )
  }

  // ============================================
  // RENDU — Catalogue principal
  // ============================================
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
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Développement professionnel
          </h2>
          <BonusGrid cats={bonusCategories} onSelect={openCategory} />
        </section>

        {/* Populaires */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Flame size={20} className="text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900">Populaires</h2>
          </div>
          <div className="space-y-2">
            {formationsList.slice(0, 5).map((f) => (
              <PopularFormationCard
                key={f.id}
                formation={f}
                onSelect={() => openFormation(f)}
              />
            ))}
          </div>
        </section>

        {/* Info freemium */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-100 flex items-start gap-3">
          <BookOpen size={20} className="text-blue-500 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            L&apos;<strong>intro</strong> de chaque formation est gratuite.
            Passez en Premium pour accéder à toutes les séquences.
          </p>
        </div>
      </main>
    </>
  )
}
