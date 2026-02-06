import React from 'react'
import Link from 'next/link'
import { Heart, Play } from 'lucide-react'
import { getCategoryConfig } from '@/lib/supabase/types'

export interface FormationEnCours {
  id: string
  title: string
  category: string
  currentSequence: number
  totalSequences: number
  progressPercent: number
  likes: number
  isCP: boolean
  badge?: 'NOUVEAU' | 'POPULAIRE'
}

interface FormationCardProps {
  formation: FormationEnCours
}

export default function FormationCard({ formation }: FormationCardProps) {
  const catConfig = getCategoryConfig(formation.category)

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
      {/* Header : badge + likes */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {formation.isCP && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full">
              CP
            </span>
          )}
          {formation.badge && (
            <span
              className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                formation.badge === 'NOUVEAU'
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'bg-orange-50 text-orange-600'
              }`}
            >
              {formation.badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <Heart size={12} className="text-red-400 fill-red-400" />
          <span className="text-[11px] font-medium">{formation.likes}</span>
        </div>
      </div>

      {/* Icône catégorie + Titre */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-[50px] h-[50px] rounded-[14px] flex items-center justify-center shrink-0 ${catConfig.bgColor}`}
        >
          <span className="text-2xl leading-none">{catConfig.emoji}</span>
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1">
            {formation.title}
          </h3>
          <p className="text-[10px] text-gray-400">{formation.category}</p>
        </div>
      </div>

      {/* Barre de progression continue */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#8B5CF6] rounded-full transition-all duration-700"
            style={{ width: `${formation.progressPercent}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-gray-400">
          {formation.currentSequence}/{formation.totalSequences}
        </span>
      </div>

      {/* Bouton Continuer */}
      <Link
        href={`/formation?formationId=${formation.id}`}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#2D1B96] to-[#3D2BB6] text-white rounded-xl text-sm font-bold hover:shadow-md transition-all active:scale-[0.98]"
      >
        <Play size={14} /> Continuer
      </Link>
    </div>
  )
}
