'use client'

import React, { useMemo } from 'react'
import {
  ChevronLeft,
  Check,
  Lock,
  Play,
  Loader2,
} from 'lucide-react'
import {
  useFormation,
  useUserFormationProgress,
  getCategoryConfig,
  type Sequence as DbSequence,
  type Formation,
} from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

// ============================================
// TYPES
// ============================================

interface FormationDetailProps {
  formationId: string
  isPremium: boolean
  onBack: () => void
  onStartSequence: (sequence: DbSequence) => void
}

// ============================================
// COMPOSANT — Carte séquence
// ============================================

function SequenceCard({
  sequence,
  formation,
  completedSequenceIds,
  currentSequence,
  isPremium,
  gradient,
  onStart,
}: {
  sequence: DbSequence
  formation: Formation
  completedSequenceIds: string[]
  currentSequence: number
  isPremium: boolean
  gradient: { from: string; to: string }
  onStart: () => void
}) {
  const isIntro = sequence.sequence_number === 0
  const isLocked = !isIntro && !isPremium && sequence.sequence_number > 0
  const isCompleted = completedSequenceIds.includes(sequence.id)
  const isCurrent = sequence.sequence_number === currentSequence
  const isAccessible = sequence.sequence_number <= currentSequence

  // Styles conditionnels
  let bgColor = '#FAFAFF'
  let borderColor = '#E8E5F5'

  if (isCompleted) {
    bgColor = '#F0FDF4'
    borderColor = '#86EFAC'
  } else if (isCurrent) {
    bgColor = 'white'
    borderColor = gradient.from
  } else if (isLocked) {
    bgColor = '#FAFAFA'
    borderColor = '#E8E5F5'
  }

  // Couleur du badge numéro
  let badgeBg = '#E2E8F0'
  let badgeColor = '#64748B'

  if (isCompleted) {
    badgeBg = '#22C55E'
    badgeColor = 'white'
  } else if (isCurrent) {
    badgeBg = gradient.from
    badgeColor = 'white'
  } else if (isLocked) {
    badgeBg = '#CBD5E1'
    badgeColor = 'white'
  }

  const canClick = !isLocked && isAccessible

  // Calculer la durée affichée
  const duration = sequence.estimated_duration_minutes || 4
  const durationStr = `${duration} min`

  return (
    <button
      onClick={() => canClick && onStart()}
      disabled={!canClick}
      className="w-full text-left mb-2 transition-all"
      style={{
        background: bgColor,
        border: `2px solid ${borderColor}`,
        borderRadius: 16,
        padding: '12px 14px',
        cursor: canClick ? 'pointer' : 'not-allowed',
        opacity: !isAccessible && !isLocked ? 0.5 : 1,
      }}
    >
      <div className="flex items-center gap-3">
        {/* Badge numéro / check / lock */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-bold"
          style={{ background: badgeBg, color: badgeColor }}
        >
          {isCompleted ? (
            <Check size={18} />
          ) : isLocked ? (
            <Lock size={14} />
          ) : (
            sequence.sequence_number
          )}
        </div>

        {/* Infos */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p
              className={`font-semibold text-[13px] leading-snug ${
                isLocked ? 'text-gray-400' : 'text-gray-800'
              }`}
            >
              {sequence.title}
            </p>
            {isIntro && (
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                GRATUIT
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] text-gray-500">
              ⏱️ {durationStr}
            </span>
            <span className="text-[10px] text-gray-500">
              📝 4Q
            </span>
          </div>
        </div>

        {/* Badge Premium */}
        {isLocked && (
          <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0">
            Premium
          </span>
        )}
      </div>
    </button>
  )
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function FormationDetailSupabase({
  formationId,
  isPremium,
  onBack,
  onStartSequence,
}: FormationDetailProps) {
  const { user } = useAuth()
  
  const { formation, sequences, loading, error } = useFormation(formationId)
  const { 
    userFormation, 
    completedSequences: completedSequenceIds 
  } = useUserFormationProgress(formationId, user?.id || null)

  const categoryConfig = useMemo(() => {
    return getCategoryConfig(formation?.category || null)
  }, [formation?.category])

  const currentSequence = userFormation?.current_sequence || 0

  // Trouver la prochaine séquence à faire
  const nextSequence = useMemo(() => {
    if (!sequences.length) return null
    return sequences.find(
      (s) => s.sequence_number === currentSequence && !completedSequenceIds.includes(s.id)
    ) || sequences.find((s) => s.sequence_number === currentSequence)
  }, [sequences, currentSequence, completedSequenceIds])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  // Error state
  if (error || !formation) {
    return (
      <div className="p-4">
        <button onClick={onBack} className="mb-4 text-gray-500">
          ← Retour
        </button>
        <p className="text-red-500">
          Erreur : {error?.message || 'Formation non trouvée'}
        </p>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Header gradient */}
      <div
        className="pt-14 pb-6 px-4 rounded-b-[28px]"
        style={{
          background: `linear-gradient(135deg, ${categoryConfig.gradient.from}, ${categoryConfig.gradient.to})`,
        }}
      >
        {/* Bouton retour */}
        <button
          onClick={onBack}
          className="mb-3 p-2 rounded-xl text-white hover:bg-white/20 transition-colors"
          style={{ background: 'rgba(255,255,255,0.2)' }}
        >
          <ChevronLeft size={20} />
        </button>

        {/* Titre */}
        <h1 className="text-xl font-extrabold text-white leading-tight mb-1">
          {formation.title}
        </h1>

        {/* Instructeur */}
        <p className="text-white/85 text-[13px] mb-3">{formation.instructor_name}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className="bg-white/20 text-white px-3 py-1 rounded-xl text-xs">
            {formation.total_sequences} séquences
          </span>
          {categoryConfig.isCP ? (
            <span className="bg-white/25 text-white px-3 py-1 rounded-xl text-xs font-bold">
              🏅 CP validante
            </span>
          ) : (
            <span className="bg-white/25 text-white px-3 py-1 rounded-xl text-xs font-bold">
              💼 Bonus
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {formation.description_short && (
        <div className="px-4 pt-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            {formation.description_short}
          </p>
        </div>
      )}

      {/* Liste des séquences */}
      <div className="px-4 pt-5">
        <h3 className="text-[15px] font-bold text-gray-800 mb-4">Séquences</h3>

        {sequences.map((seq) => (
          <SequenceCard
            key={seq.id}
            sequence={seq}
            formation={formation}
            completedSequenceIds={completedSequenceIds}
            currentSequence={currentSequence}
            isPremium={isPremium}
            gradient={categoryConfig.gradient}
            onStart={() => onStartSequence(seq)}
          />
        ))}

        {sequences.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">
            Aucune séquence disponible
          </p>
        )}
      </div>

      {/* CTA fixe en bas */}
      {nextSequence && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg z-20">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => onStartSequence(nextSequence)}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${categoryConfig.gradient.from}, ${categoryConfig.gradient.to})`,
              }}
            >
              <Play size={18} />
              {currentSequence === 0
                ? 'Commencer la formation'
                : `Continuer — Séquence ${currentSequence}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
