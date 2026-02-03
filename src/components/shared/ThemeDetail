'use client'

import React, { useState } from 'react'
import { ChevronLeft, Play } from 'lucide-react'
import FilterTabs, { type FilterTab } from '@/components/ui/FilterTabs'
import type { Theme } from '@/components/ui/ThemeCard'

interface ThemeDetailProps {
  theme: Theme
  accentColor: string // couleur du Play button (#F59E0B pour Patient, #EC4899 pour Santé)
  onBack: () => void
}

export default function ThemeDetail({
  theme,
  accentColor,
  onBack,
}: ThemeDetailProps) {
  const [filter, setFilter] = useState<FilterTab>('tous')

  const hasCp = theme.contents.some((c) => c.tag === 'cp')
  const hasBonus = theme.contents.some((c) => c.tag === 'bonus')
  const showFilters = hasCp && hasBonus

  const filteredContents = theme.contents.filter((c) => {
    if (filter === 'cp') return c.tag === 'cp'
    if (filter === 'bonus') return c.tag === 'bonus'
    return true
  })

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
        <p className="text-sm text-gray-500 mb-2">{theme.description}</p>

        {/* Filtres CP / Bonus */}
        {showFilters && (
          <div className="pb-2">
            <FilterTabs active={filter} onChange={setFilter} />
          </div>
        )}

        {filteredContents.map((content, i) => {
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
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      {content.type}
                    </h3>
                    <span
                      className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${
                        content.tag === 'cp'
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-yellow-50 text-yellow-600 border-yellow-200'
                      }`}
                    >
                      {content.tag === 'cp' ? 'CP' : 'Bonus'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {isAvailable ? 'Disponible' : 'Prochainement'}
                  </p>
                </div>
                {isAvailable ? (
                  <Play
                    size={16}
                    className="shrink-0"
                    style={{ color: accentColor }}
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
