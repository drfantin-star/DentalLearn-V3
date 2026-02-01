'use client'

import { useState } from 'react'
import { HeartHandshake, ChevronRight, ChevronLeft, Play, ClipboardCheck } from 'lucide-react'

// Thèmes Patient — basé sur le prototype V5
const PATIENT_THEMES = [
  {
    id: 'communication',
    emoji: '🗣️',
    title: 'Communication patient',
    description: 'Techniques de communication et écoute active',
    color: '#F59E0B',
    bgLight: 'bg-amber-50',
    contents: [
      { type: 'Formation gamifiée', icon: '🎮', status: 'available' },
      { type: 'Auto-évaluation', icon: '📊', status: 'available' },
      { type: 'EPP - Audit clinique', icon: '📋', status: 'coming' },
      { type: 'Fiche pratique', icon: '📄', status: 'available' },
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
      { type: 'Formation gamifiée', icon: '🎮', status: 'available' },
      { type: 'EPP - Audit clinique', icon: '📋', status: 'coming' },
      { type: 'Fiche pratique', icon: '📄', status: 'available' },
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
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming' },
      { type: 'Fiche pratique', icon: '📄', status: 'coming' },
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
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming' },
      { type: 'Action réflexive', icon: '🪞', status: 'coming' },
    ],
  },
]

type Theme = (typeof PATIENT_THEMES)[number]

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
                  <Play
                    size={16}
                    className="text-[#F59E0B] shrink-0"
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
      </main>
    </>
  )
}

export default function PatientPage() {
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
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center">
              <HeartHandshake size={20} className="text-[#F59E0B]" />
            </div>
            Relation Patient
          </h1>
          <p className="text-xs text-gray-400 mt-1 ml-12">
            Axe 3 • Certification Périodique
          </p>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-3">
        {PATIENT_THEMES.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            onOpen={setSelectedTheme}
          />
        ))}

        {/* Info Axe 3 */}
        <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mt-6">
          <p className="text-xs text-amber-700 leading-relaxed">
            <strong>Axe 3 — Relation avec le patient :</strong> Communication,
            consentement, éthique et gestion des situations difficiles.
            Minimum 2 actions à valider sur 6 ans.
          </p>
        </div>
      </main>
    </>
  )
}
