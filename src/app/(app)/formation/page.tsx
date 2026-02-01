'use client'

import React, { useState } from 'react'
import {
  ChevronRight, Heart, Lock, Play, Star,
  Flame, BookOpen, Filter
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

type FilterTab = 'toutes' | 'cp' | 'bonus'

interface Category {
  id: string
  name: string
  shortName: string
  emoji: string
  bgColor: string
  textColor: string
  borderColor: string
  type: 'cp' | 'bonus'
  formationCount: number
}

interface FormationPopulaire {
  id: string
  rank: number
  title: string
  instructor: string
  categoryId: string
  categoryEmoji: string
  categoryBgColor: string
  likes: number
  isCP: boolean
  badge?: 'NOUVEAU' | 'POPULAIRE'
  isEnCours?: boolean
  progressPercent?: number
  currentSequence?: number
  totalSequences: number
}

// ============================================
// DONNÉES — Catégories spécialités cliniques
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
    type: 'cp',
    formationCount: 1,
  },
  {
    id: 'paro',
    name: 'Parodontologie',
    shortName: 'Paro',
    emoji: '🫧',
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    borderColor: 'border-pink-100',
    type: 'cp',
    formationCount: 2,
  },
  {
    id: 'endo',
    name: 'Endodontie',
    shortName: 'Endo',
    emoji: '🔬',
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    borderColor: 'border-indigo-100',
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
    type: 'cp',
    formationCount: 1,
  },
  // Bonus — Développement professionnel
  {
    id: 'management',
    name: 'Management',
    shortName: 'Management',
    emoji: '💼',
    bgColor: 'bg-slate-100',
    textColor: 'text-slate-600',
    borderColor: 'border-slate-200',
    type: 'bonus',
    formationCount: 1,
  },
  {
    id: 'organisation',
    name: 'Organisation',
    shortName: 'Organisation',
    emoji: '📋',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-600',
    borderColor: 'border-gray-200',
    type: 'bonus',
    formationCount: 1,
  },
  {
    id: 'softskills',
    name: 'Soft Skills',
    shortName: 'Soft Skills',
    emoji: '🤝',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    borderColor: 'border-orange-100',
    type: 'bonus',
    formationCount: 0,
  },
]

// ============================================
// DONNÉES — Formations populaires
// ============================================

const formationsPopulaires: FormationPopulaire[] = [
  {
    id: '1',
    rank: 1,
    title: 'Composite stratifié antérieur',
    instructor: 'Dr MarcErgani',
    categoryId: 'esthetique',
    categoryEmoji: '✨',
    categoryBgColor: 'bg-violet-100',
    likes: 203,
    isCP: true,
    badge: 'POPULAIRE',
    totalSequences: 15,
  },
  {
    id: '2',
    rank: 2,
    title: 'Éclaircissements & Taches Blanches',
    instructor: 'Dr Laurent Elbeze',
    categoryId: 'restauratrice',
    categoryEmoji: '🦷',
    categoryBgColor: 'bg-amber-100',
    likes: 124,
    isCP: true,
    isEnCours: true,
    progressPercent: 40,
    currentSequence: 6,
    totalSequences: 15,
  },
  {
    id: '3',
    rank: 3,
    title: 'Fêlures & Overlays',
    instructor: 'Dr Gauthier Weisrock',
    categoryId: 'restauratrice',
    categoryEmoji: '🦷',
    categoryBgColor: 'bg-amber-100',
    likes: 89,
    isCP: true,
    badge: 'NOUVEAU',
    totalSequences: 15,
  },
  {
    id: '4',
    rank: 4,
    title: 'Gestion du cabinet',
    instructor: 'Dentalschool',
    categoryId: 'management',
    categoryEmoji: '💼',
    categoryBgColor: 'bg-slate-100',
    likes: 67,
    isCP: false,
    totalSequences: 15,
  },
]

// ============================================
// COMPOSANTS
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
          className={`flex flex-col items-center gap-2 p-3 rounded-2xl border ${cat.borderColor} ${cat.bgColor} hover:shadow-md hover:scale-[1.03] active:scale-[0.97] transition-all`}
        >
          <span className="text-3xl">{cat.emoji}</span>
          <span className={`text-xs font-semibold ${cat.textColor} text-center leading-tight`}>
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
          className={`flex flex-col items-center gap-2 p-4 rounded-2xl border ${cat.borderColor} ${cat.bgColor} hover:shadow-md hover:scale-[1.03] active:scale-[0.97] transition-all`}
        >
          <span className="text-3xl">{cat.emoji}</span>
          <span className={`text-xs font-semibold ${cat.textColor} text-center leading-tight`}>
            {cat.shortName}
          </span>
        </button>
      ))}
    </div>
  )
}

function PopularFormationCard({ formation }: { formation: FormationPopulaire }) {
  // Couleur du rang
  const rankColors: Record<number, string> = {
    1: 'bg-yellow-400 text-yellow-900',
    2: 'bg-gray-300 text-gray-700',
    3: 'bg-orange-300 text-orange-800',
  }
  const rankClass = rankColors[formation.rank] || 'bg-gray-200 text-gray-600'

  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-2xl border transition-all hover:shadow-md ${
        formation.rank === 1
          ? 'border-yellow-300 bg-yellow-50/50'
          : 'border-gray-100 bg-white'
      }`}
    >
      {/* Rang */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shrink-0 ${rankClass}`}
      >
        {formation.rank}
      </div>

      {/* Icône catégorie */}
      <div
        className={`w-12 h-12 rounded-xl ${formation.categoryBgColor} flex items-center justify-center text-2xl shrink-0`}
      >
        {formation.categoryEmoji}
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-gray-900 leading-snug truncate">
            {formation.title}
          </h3>
          {formation.isCP && (
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded border border-emerald-200 shrink-0">
              CP
            </span>
          )}
        </div>
        <p className="text-[11px] text-gray-400 mt-0.5">
          {formation.totalSequences} séquences
        </p>
        {formation.isEnCours && formation.progressPercent !== undefined && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#8B5CF6] rounded-full"
                style={{ width: `${formation.progressPercent}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">
              {formation.currentSequence}/{formation.totalSequences}
            </span>
          </div>
        )}
      </div>

      {/* Likes */}
      <div className="flex flex-col items-center gap-0.5 shrink-0">
        <Heart size={16} className="text-red-400 fill-red-400" />
        <span className="text-[11px] font-medium text-gray-500">
          {formation.likes}
        </span>
      </div>
    </div>
  )
}

function CategoryDetailView({
  category,
  formations,
  onBack,
}: {
  category: Category
  formations: FormationPopulaire[]
  onBack: () => void
}) {
  const [filter, setFilter] = useState<FilterTab>('toutes')

  const catFormations = formations.filter(
    (f) => f.categoryId === category.id
  )

  const filteredFormations = catFormations.filter((f) => {
    if (filter === 'cp') return f.isCP
    if (filter === 'bonus') return !f.isCP
    return true
  })

  const hasCp = catFormations.some((f) => f.isCP)
  const hasBonus = catFormations.some((f) => !f.isCP)
  const showFilters = hasCp && hasBonus // ne montrer les filtres que si mix CP + Bonus

  return (
    <div>
      {/* Header avec retour */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-gray-500 mb-4 hover:text-gray-700 transition-colors"
      >
        <ChevronRight size={16} className="rotate-180" />
        Retour aux catégories
      </button>

      {/* Header catégorie */}
      <div className={`rounded-2xl p-6 ${category.bgColor} border ${category.borderColor} mb-6`}>
        <div className="flex items-center gap-4">
          <span className="text-5xl">{category.emoji}</span>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              {category.name}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {catFormations.length} formation{catFormations.length !== 1 ? 's' : ''} disponible{catFormations.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Filtres CP / Bonus — uniquement si la catégorie contient les deux types */}
      {showFilters && (
        <div className="mb-4">
          <FilterTabs active={filter} onChange={setFilter} />
        </div>
      )}

      {/* Liste formations */}
      {filteredFormations.length > 0 ? (
        <div className="space-y-3">
          {filteredFormations.map((f) => (
            <div
              key={f.id}
              className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900">{f.title}</h3>
                    {f.badge && (
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          f.badge === 'NOUVEAU'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-orange-50 text-orange-600'
                        }`}
                      >
                        {f.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {f.totalSequences} séquences • Intro gratuite
                  </p>
                </div>
                <div className="flex items-center gap-1 text-gray-400 shrink-0">
                  <Heart size={14} className="text-red-400 fill-red-400" />
                  <span className="text-xs font-medium">{f.likes}</span>
                </div>
              </div>

              {f.isEnCours && f.progressPercent !== undefined ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#8B5CF6] rounded-full"
                        style={{ width: `${f.progressPercent}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 font-medium">
                      {f.currentSequence}/{f.totalSequences}
                    </span>
                  </div>
                  <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#2D1B96] to-[#3D2BB6] text-white rounded-xl text-sm font-bold hover:shadow-md transition-all">
                    <Play size={14} /> Continuer
                  </button>
                </>
              ) : (
                <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-[#00D1C1] text-white rounded-xl text-sm font-bold hover:bg-[#00b8a9] transition-all mt-2">
                  Commencer gratuitement
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
          <div className="text-4xl mb-3">🚧</div>
          <p className="font-semibold text-gray-700 mb-1">Bientôt disponible</p>
          <p className="text-sm text-gray-400">
            De nouvelles formations arrivent dans cette catégorie
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================
// PAGE FORMATION
// ============================================

export default function FormationPage() {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)

  const cpCategories = categories.filter((c) => c.type === 'cp')
  const bonusCategories = categories.filter((c) => c.type === 'bonus')

  // Vue détail catégorie
  if (selectedCategory) {
    return (
      <>
        <header className="bg-white sticky top-0 z-30 shadow-sm">
          <div className="max-w-lg mx-auto px-4 py-4">
            <h1 className="text-xl font-bold text-gray-900">
              {selectedCategory.name}
            </h1>
          </div>
        </header>
        <main className="max-w-lg mx-auto px-4 py-6">
          <CategoryDetailView
            category={selectedCategory}
            formations={formationsPopulaires}
            onBack={() => setSelectedCategory(null)}
          />
        </main>
      </>
    )
  }

  // Vue principale
  return (
    <>
      {/* Header */}
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
          <CategoryGrid
            cats={cpCategories}
            onSelect={setSelectedCategory}
          />
        </section>

        {/* Développement professionnel */}
        <section>
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Développement professionnel
          </h2>
          <BonusGrid
            cats={bonusCategories}
            onSelect={setSelectedCategory}
          />
        </section>

        {/* Populaires */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Flame size={20} className="text-orange-500" />
            <h2 className="text-lg font-bold text-gray-900">Populaires</h2>
          </div>
          <div className="space-y-2">
            {formationsPopulaires.map((f) => (
              <PopularFormationCard key={f.id} formation={f} />
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
