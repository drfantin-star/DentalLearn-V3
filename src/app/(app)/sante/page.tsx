'use client'

import React, { useState } from 'react'
import { ChevronRight, ChevronLeft, Play } from 'lucide-react'
import { CATEGORIES } from '@/lib/supabase/types'

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

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 min-h-screen" style={{ background: '#0F0F0F' }}>
        <h2 className="text-xl font-black text-white mb-4">
          🔍 Explorer par thème
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {axe4Categories.map((cat) => {
            const theme = SANTE_THEMES.find((t) => t.id === cat.id)
            return (
              <button
                key={cat.id}
                onClick={() => theme && setSelectedTheme(theme)}
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
            )
          })}
        </div>
      </main>
    </>
  )
}
