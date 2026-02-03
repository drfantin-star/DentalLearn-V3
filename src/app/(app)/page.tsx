'use client'

import { useState } from 'react'
import { HeartPulse } from 'lucide-react'
import ThemeCard, { type Theme } from '@/components/ui/ThemeCard'
import ThemeDetail from '@/components/shared/ThemeDetail'

// ============================================
// DONNÉES — Thèmes Santé Pro (Axe 4)
// ============================================

const SANTE_THEMES: Theme[] = [
  {
    id: 'ergonomie',
    emoji: '🧘',
    title: 'Ergonomie au cabinet',
    description: 'Postures de travail et aménagement du poste',
    color: '#EC4899',
    bgLight: 'bg-pink-50',
    contents: [
      { type: 'Formation gamifiée', icon: '🎮', status: 'available', tag: 'cp' },
      { type: 'Auto-évaluation', icon: '📊', status: 'available', tag: 'cp' },
      { type: 'EPP - Audit clinique', icon: '📋', status: 'coming', tag: 'cp' },
      { type: 'Programme exercices', icon: '🏋️', status: 'available', tag: 'bonus' },
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
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming', tag: 'cp' },
      { type: 'Fiche pratique', icon: '📄', status: 'available', tag: 'bonus' },
      { type: 'Programme exercices', icon: '🏋️', status: 'available', tag: 'bonus' },
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
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming', tag: 'cp' },
      { type: 'Auto-évaluation', icon: '📊', status: 'coming', tag: 'cp' },
      { type: 'Fiche pratique', icon: '📄', status: 'coming', tag: 'bonus' },
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
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming', tag: 'cp' },
      { type: 'Action réflexive', icon: '🪞', status: 'coming', tag: 'cp' },
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
      { type: 'Fiche pratique', icon: '📄', status: 'coming', tag: 'bonus' },
      { type: 'Action réflexive', icon: '🪞', status: 'coming', tag: 'cp' },
    ],
  },
]

// ============================================
// PAGE
// ============================================

export default function SantePage() {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)

  if (selectedTheme) {
    return (
      <ThemeDetail
        theme={selectedTheme}
        accentColor="#EC4899"
        onBack={() => setSelectedTheme(null)}
      />
    )
  }

  return (
    <>
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
