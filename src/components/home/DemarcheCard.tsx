import React from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'
import type { DemarcheEnCours } from '@/lib/hooks/useDemarches'

interface DemarcheCardProps {
  demarche: DemarcheEnCours
}

export default function DemarcheCard({ demarche }: DemarcheCardProps) {
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
