import React from 'react'
import { ChevronRight } from 'lucide-react'

export interface ThemeContent {
  type: string
  icon: string
  status: 'available' | 'coming'
  tag: 'cp' | 'bonus'
}

export interface Theme {
  id: string
  emoji: string
  title: string
  description: string
  color: string
  bgLight: string
  contents: ThemeContent[]
}

interface ThemeCardProps {
  theme: Theme
  onOpen: (theme: Theme) => void
}

export default function ThemeCard({ theme, onOpen }: ThemeCardProps) {
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
