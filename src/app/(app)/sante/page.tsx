'use client'

import { useState } from 'react'
import { HeartPulse, ChevronRight, ChevronLeft, Play } from 'lucide-react'

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

  if (selectedTheme) {
    return (
      <ThemeDetail
        theme={selectedTheme}
        onBack={() => setSelectedTheme(null)}
      />
    )
  }

  return (
    <>
      {/* Header */}
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-pink-50 flex items-center justify-center">
              <HeartPulse size={20} className="text-[#EC4899]" />
            </div>
            Santé Praticien
          </h1>
          <p className="text-xs text-gray-400 mt-1 ml-12">
            Axe 4 • Certification Périodique
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {SANTE_THEMES.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            onOpen={setSelectedTheme}
          />
        ))}

        {/* Info Axe 4 */}
        <div className="bg-pink-50 rounded-xl p-4 border border-pink-100 mt-6">
          <p className="text-xs text-pink-700 leading-relaxed">
            <strong>Axe 4 — Santé personnelle :</strong> Ergonomie,
            prévention du burn-out, hygiène de vie et suivi médical.
            Minimum 2 actions à valider sur 6 ans.
          </p>
        </div>
      </main>
    </>
  )
}
