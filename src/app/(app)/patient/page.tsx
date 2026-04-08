'use client'

import { useState } from 'react'
import { HeartHandshake } from 'lucide-react'
import ThemeCard, { type Theme } from '@/components/ui/ThemeCard'
import ThemeDetail from '@/components/shared/ThemeDetail'

// ============================================
// DONNÉES — Thèmes Patient (Axe 3)
// ============================================

const PATIENT_THEMES: Theme[] = [
  {
    id: 'communication',
    emoji: '🗣️',
    title: 'Communication patient',
    description: 'Techniques de communication et écoute active',
    color: '#F59E0B',
    bgLight: 'bg-amber-50',
    contents: [
      { type: 'Écoute active & Communication', icon: '🎮', status: 'available', tag: 'cp', slug: 'communication-relation-therapeutique' },
      { type: 'Auto-évaluation', icon: '📊', status: 'available', tag: 'cp' },
      { type: 'EPP - Audit clinique', icon: '📋', status: 'coming', tag: 'cp' },
      { type: 'Fiche pratique', icon: '📄', status: 'available', tag: 'bonus' },
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
      { type: 'Formation gamifiée', icon: '🎮', status: 'available', tag: 'cp' },
      { type: 'EPP - Audit clinique', icon: '📋', status: 'coming', tag: 'cp' },
      { type: 'Fiche pratique', icon: '📄', status: 'available', tag: 'bonus' },
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
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming', tag: 'cp' },
      { type: 'Fiche pratique', icon: '📄', status: 'coming', tag: 'bonus' },
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
      { type: 'Formation gamifiée', icon: '🎮', status: 'coming', tag: 'cp' },
      { type: 'Action réflexive', icon: '🪞', status: 'coming', tag: 'cp' },
    ],
  },
]

// ============================================
// PAGE
// ============================================

export default function PatientPage() {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)

  if (selectedTheme) {
    return (
      <ThemeDetail
        theme={selectedTheme}
        accentColor="#F59E0B"
        onBack={() => setSelectedTheme(null)}
      />
    )
  }

  return (
    <>
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-4">
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

      <main className="max-w-lg mx-auto md:max-w-2xl lg:max-w-4xl xl:max-w-6xl px-4 md:px-6 lg:px-8 py-6 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {PATIENT_THEMES.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              onOpen={setSelectedTheme}
            />
          ))}
        </div>

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
