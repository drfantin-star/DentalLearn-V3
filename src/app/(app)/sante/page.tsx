'use client'

import React, { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { CATEGORIES } from '@/lib/supabase/types'
import ThemeDetail from '@/components/shared/ThemeDetail'
import type { Theme } from '@/components/ui/ThemeCard'

// Thèmes Santé Pro — basé sur le prototype V5
const SANTE_THEMES: Theme[] = [
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

export default function SantePage() {
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null)
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const themeId = searchParams.get('theme')
    if (themeId) {
      const found = SANTE_THEMES.find(t => t.id === themeId)
      if (found) setSelectedTheme(found)
    }
  }, [])

  if (selectedTheme) {
    return (
      <ThemeDetail
        theme={selectedTheme}
        accentColor="#EC4899"
        onBack={() => setSelectedTheme(null)}
        fromPage="/sante"
      />
    )
  }

  const axe4Categories = CATEGORIES.filter((c) => c.type === 'axe4')

  return (
    <>
      <header className="bg-gradient-to-br from-[#EC4899] to-[#A78BFA] px-4 py-4">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => router.push('/')}
            className="p-2 -ml-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
          <h1 className="text-2xl font-black text-white">Santé Praticien</h1>
        </div>
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
