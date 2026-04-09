import React from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'
import { getCategoryConfig } from '@/lib/supabase/types'
import type { DemarcheEnCours } from '@/lib/hooks/useDemarches'

interface DemarcheCardProps {
  demarche: DemarcheEnCours
}

export default function DemarcheCard({ demarche }: DemarcheCardProps) {
  // --- Formation cards: simplified layout ---
  if (demarche.type === 'formation') {
    const catConfig = getCategoryConfig(demarche.category ?? null)
    const categoryColor = catConfig.gradient.from

    return (
      <div className="rounded-2xl overflow-hidden shadow-sm bg-white">
        {/* Image cover — si disponible */}
        {demarche.coverImageUrl ? (
          <div className="w-full h-36 overflow-hidden">
            <img
              src={demarche.coverImageUrl}
              alt={demarche.title}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          /* Fallback — fond coloré avec emoji catégorie */
          <div
            className="w-full h-36 flex items-center justify-center text-5xl"
            style={{ background: `linear-gradient(135deg, ${categoryColor}33, ${categoryColor}66)` }}
          >
            {catConfig.emoji}
          </div>
        )}

        {/* Contenu bas de card */}
        <div className="p-4 flex items-center justify-between gap-3">
          <p className="font-semibold text-gray-900 text-sm leading-snug flex-1">
            {demarche.title}
          </p>
          <Link
            href={demarche.ctaUrl}
            className="flex-shrink-0 px-4 py-2 rounded-xl text-white text-sm font-semibold"
            style={{ background: `linear-gradient(135deg, #2D1B96, #3D2BB6)` }}
          >
            Continuer →
          </Link>
        </div>
      </div>
    )
  }

  // --- EPP / other cards: existing layout preserved ---
  return (
    <div
      className={`bg-white rounded-2xl p-4 shadow-sm border ${demarche.accentColor} hover:shadow-md transition-all`}
      style={{ borderWidth: '0.5px' }}
    >
      {/* Badge */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={`text-[10px] font-bold uppercase px-2 py-0.5 text-white rounded-full ${demarche.badgeColor}`}
        >
          {demarche.badge}
        </span>
      </div>

      {/* Titre + icone */}
      <div className="mb-1">
        <h3 className="font-semibold text-gray-900 text-sm leading-snug">
          {demarche.icon && <span className="mr-1">{demarche.icon}</span>}
          {demarche.title}
        </h3>
      </div>

      {/* Sous-titre */}
      <p className="text-[11px] text-gray-400 mb-3">{demarche.subtitle}</p>

      {/* Barre de progression (si definie) */}
      {demarche.progress !== undefined && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#8B5CF6] rounded-full transition-all duration-700"
              style={{ width: `${demarche.progress}%` }}
            />
          </div>
          {demarche.progressLabel && (
            <span className="text-[10px] font-bold text-gray-400">
              {demarche.progressLabel}
            </span>
          )}
        </div>
      )}

      {/* Bouton CTA */}
      <Link
        href={demarche.ctaUrl}
        className={`w-full flex items-center justify-center gap-2 py-2.5 text-white rounded-xl text-sm font-bold hover:shadow-md transition-all active:scale-[0.98] ${
          demarche.type === 'epp'
            ? 'bg-[#0F7B6C] hover:bg-[#0d6b5e]'
            : 'bg-gradient-to-r from-[#2D1B96] to-[#3D2BB6]'
        }`}
      >
        <Play size={14} /> {demarche.ctaLabel}
      </Link>
    </div>
  )
}
