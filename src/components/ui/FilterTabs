'use client'

import React from 'react'

export type FilterTab = 'tous' | 'toutes' | 'cp' | 'bonus'

interface FilterTabItem {
  key: FilterTab
  label: string
  emoji?: string
}

interface FilterTabsProps {
  tabs?: FilterTabItem[]
  active: FilterTab
  onChange: (tab: FilterTab) => void
}

const defaultTabs: FilterTabItem[] = [
  { key: 'tous', label: 'Tous' },
  { key: 'cp', label: 'Certif. Périodique', emoji: '🏅' },
  { key: 'bonus', label: 'Bonus', emoji: '🎁' },
]

export default function FilterTabs({
  tabs = defaultTabs,
  active,
  onChange,
}: FilterTabsProps) {
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
