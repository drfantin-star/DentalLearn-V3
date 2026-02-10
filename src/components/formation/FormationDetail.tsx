'use client'

import React, { useMemo, useState } from 'react'
import {
  ChevronLeft,
  Check,
  Lock,
  Play,
  Loader2,
  Heart,
  Star,
  Trophy,
  Sparkles,
} from 'lucide-react'
import {
  useFormation,
  useUserFormationProgress,
  usePremiumAccess,
  usePreviewMode,
  useFormationLike,
  useFormationPoints,
  useFormationCompletion,
  isSequenceAccessible,
  getCategoryConfig,
  type Sequence,
} from '@/lib/supabase'

// ============================================
// TYPES
// ============================================

interface FormationDetailProps {
  formationId: string
  onBack: () => void
  onStartSequence: (sequence: Sequence) => void
}

// ============================================
// COMPOSANT — Carte séquence
// ============================================

function SequenceCard({
  sequence,
  accessibility,
  gradient,
  onStart,
}: {
  sequence: Sequence
  accessibility: { accessible: boolean; reason: string }
  gradient: { from: string; to: string }
  onStart: () => void
}) {
  const isFree = sequence.is_intro || sequence.access_level === 'free'
  const isCompleted = accessibility.reason === 'completed'
  const isCurrent = accessibility.reason === 'unlocked' || accessibility.reason === 'free'
  const isLocked = accessibility.reason === 'premium_required'
  const isNotUnlocked = accessibility.reason === 'not_unlocked'

  // Styles conditionnels
  let bgColor = '#FAFAFF'
  let borderColor = '#E8E5F5'

  if (isCompleted) {
    bgColor = '#F0FDF4'
    borderColor = '#86EFAC'
  } else if (isCurrent && !isCompleted) {
    bgColor = 'white'
    borderColor = gradient.from
  } else if (isLocked || isNotUnlocked) {
    bgColor = '#FAFAFA'
    borderColor = '#E8E5F5'
  }

  // Couleur du badge numéro
  let badgeBg = '#E2E8F0'
  let badgeColor = '#64748B'

  if (isCompleted) {
    badgeBg = '#22C55E'
    badgeColor = 'white'
  } else if (isCurrent && !isCompleted) {
    badgeBg = gradient.from
    badgeColor = 'white'
  } else if (isLocked || isNotUnlocked) {
    badgeBg = '#CBD5E1'
    badgeColor = 'white'
  }

  const canClick = accessibility.accessible

  // Durée affichée
  const duration = sequence.estimated_duration_minutes || 4
  const hasMedia = !!sequence.course_media_url

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
        opacity: isNotUnlocked ? 0.5 : 1,
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
                isLocked || isNotUnlocked ? 'text-gray-400' : 'text-gray-800'
              }`}
            >
              {sequence.title}
            </p>
            {isFree && (
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                GRATUIT
              </span>
            )}
            {sequence.is_evaluation && (
              <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                ÉVALUATION
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {hasMedia && (
              <span className="text-[10px] text-gray-500">
                {sequence.course_media_type === 'audio' ? '🎧' : '📹'} {sequence.course_duration_seconds ? Math.round(sequence.course_duration_seconds / 60) : duration} min
              </span>
            )}
            <span className="text-[10px] text-gray-500">
              📝 4Q
            </span>
            <span className="text-[10px] text-gray-500">
              ⏱️ {duration} min
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
// COMPOSANT — Modal de fin de formation
// ============================================

function CompletionModal({
  formation,
  earnedPoints,
  totalPoints,
  isLiked,
  onToggleLike,
  onClose,
  gradient,
}: {
  formation: { title: string; instructor_name: string }
  earnedPoints: number
  totalPoints: number
  isLiked: boolean
  onToggleLike: () => void
  onClose: () => void
  gradient: { from: string; to: string }
}) {
  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-300">
        {/* Confettis / Trophy */}
        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}>
          <Trophy size={40} className="text-white" />
        </div>

        {/* Titre */}
        <h2 className="text-xl font-extrabold text-gray-900 mb-1">
          🎉 Formation terminée !
        </h2>
        <p className="text-sm text-gray-500 mb-4">{formation.title}</p>

        {/* Score */}
        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star size={20} className="text-amber-500 fill-amber-500" />
            <span className="text-2xl font-extrabold text-gray-900">{earnedPoints}</span>
            <span className="text-gray-500 font-medium">/ {totalPoints} pts</span>
          </div>
          <div className="w-full h-2 bg-amber-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-yellow-400 rounded-full transition-all"
              style={{ width: `${scorePercent}%` }}
            />
          </div>
          <p className="text-xs text-amber-700 mt-2 font-medium">
            {scorePercent >= 80 ? '🏆 Excellent !' : scorePercent >= 60 ? '👍 Bien joué !' : '💪 Continue !'}
          </p>
        </div>

        {/* Like */}
        <p className="text-sm text-gray-600 mb-3">
          Cette formation vous a plu ?
        </p>
        <button
          onClick={onToggleLike}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl font-bold text-sm transition-all ${
            isLiked
              ? 'bg-pink-100 text-pink-600'
              : 'bg-gray-100 text-gray-600 hover:bg-pink-50 hover:text-pink-500'
          }`}
        >
          <Heart size={20} className={isLiked ? 'fill-pink-500' : ''} />
          {isLiked ? 'Merci pour votre like !' : 'Liker cette formation'}
        </button>

        {/* Fermer */}
        <button
          onClick={onClose}
          className="w-full mt-4 py-3 rounded-2xl font-bold text-white"
          style={{ background: gradient.from }}
        >
          Continuer
        </button>
      </div>
    </div>
  )
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function FormationDetail({
  formationId,
  onBack,
  onStartSequence,
}: FormationDetailProps) {
  const { formation, sequences, loading, error } = useFormation(formationId)
  const { currentSequence, completedSequenceIds } = useUserFormationProgress(formationId)
  const { isPremium } = usePremiumAccess()
  const { isPreview } = usePreviewMode()
  const { isLiked, likesCount, toggleLike } = useFormationLike(formationId)
  const { totalPoints, earnedPoints } = useFormationPoints(formationId)
  const { completionPercent } = useFormationCompletion(formationId, sequences, completedSequenceIds)

  const [showCompletionModal, setShowCompletionModal] = useState(false)

  const categoryConfig = useMemo(() => {
    return getCategoryConfig(formation?.category || null)
  }, [formation?.category])

  // Compter les séquences complétées dans cette formation
  const completedInFormation = useMemo(() => {
    return sequences.filter(seq => completedSequenceIds.includes(seq.id)).length
  }, [sequences, completedSequenceIds])

  // Trouver la prochaine séquence à faire
  const nextSequence = useMemo(() => {
    if (!sequences.length) return null
    
    // Chercher la première séquence accessible et non complétée
    for (const seq of sequences) {
      const access = isSequenceAccessible(seq, currentSequence, completedSequenceIds, isPremium, isPreview)
      if (access.accessible && access.reason !== 'completed') {
        return seq
      }
    }
    
    // Si toutes complétées, retourner null (formation terminée)
    return null
  }, [sequences, currentSequence, completedSequenceIds, isPremium, isPreview])

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
        <button onClick={onBack} className="mb-4 text-gray-500 flex items-center gap-1">
          <ChevronLeft size={18} /> Retour
        </button>
        <p className="text-red-500">
          Erreur : {error?.message || 'Formation non trouvée'}
        </p>
      </div>
    )
  }

  return (
    <div className="pb-24">
      {/* Modal de fin */}
      {showCompletionModal && (
        <CompletionModal
          formation={formation}
          earnedPoints={earnedPoints}
          totalPoints={totalPoints}
          isLiked={isLiked}
          onToggleLike={toggleLike}
          onClose={() => setShowCompletionModal(false)}
          gradient={categoryConfig.gradient}
        />
      )}

      {/* Header gradient */}
      <div
        className="pt-14 pb-6 px-4 rounded-b-[28px] relative"
        style={{
          background: `linear-gradient(135deg, ${categoryConfig.gradient.from}, ${categoryConfig.gradient.to})`,
        }}
      >
        {/* Bouton retour + Like */}
        <div className="flex justify-between items-center mb-3">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-white hover:bg-white/20 transition-colors"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <ChevronLeft size={20} />
          </button>
          
          {/* Bouton Like */}
          <button
            onClick={toggleLike}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl transition-all"
            style={{ background: isLiked ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.2)' }}
          >
            <Heart
              size={18}
              className={isLiked ? 'text-pink-500 fill-pink-500' : 'text-white'}
            />
            <span className={`text-sm font-bold ${isLiked ? 'text-pink-500' : 'text-white'}`}>
              {likesCount}
            </span>
          </button>
        </div>

        {/* Titre */}
        <h1 className="text-xl font-extrabold text-white leading-tight mb-1">
          {formation.title}
        </h1>

        {/* Instructeur */}
        <p className="text-white/85 text-[13px] mb-3">{formation.instructor_name}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className="bg-white/20 text-white px-3 py-1 rounded-xl text-xs">
            {sequences.length} séquences
          </span>
          {formation.cp_eligible ? (
            <span className="bg-white/25 text-white px-3 py-1 rounded-xl text-xs font-bold">
              🏅 CP validante
            </span>
          ) : (
            <span className="bg-white/25 text-white px-3 py-1 rounded-xl text-xs font-bold">
              💼 Bonus
            </span>
          )}
          {formation.dpc_hours && (
            <span className="bg-white/20 text-white px-3 py-1 rounded-xl text-xs">
              {formation.dpc_hours}h DPC
            </span>
          )}
        </div>
      </div>

      {/* Statistiques de progression */}
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-gray-700">Votre progression</span>
            <span className="text-xs text-gray-500">{completedInFormation}/{sequences.length} séquences</span>
          </div>
          
          {/* Barre de progression */}
          <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mb-3">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${completionPercent}%`,
                background: `linear-gradient(90deg, ${categoryConfig.gradient.from}, ${categoryConfig.gradient.to})`,
              }}
            />
          </div>

          {/* Points */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
                <Star size={16} className="text-amber-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Points gagnés</p>
                <p className="font-bold text-gray-900">{earnedPoints} <span className="text-gray-400 font-normal">/ {totalPoints}</span></p>
              </div>
            </div>
            
            {completedInFormation === sequences.length && sequences.length > 0 && (
              <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl">
                <Sparkles size={14} />
                <span className="text-xs font-bold">Terminée !</span>
              </div>
            )}
          </div>
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

      {/* Mode Preview Banner */}
      {isPreview && (
        <div className="mx-4 mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
          <p className="text-xs text-blue-700">
            🔓 <strong>Mode Preview</strong> — Toutes les séquences sont accessibles pour tester. 
            La progression n&apos;est pas sauvegardée.
          </p>
        </div>
      )}

      {/* Liste des séquences */}
      <div className="px-4 pt-5">
        <h3 className="text-[15px] font-bold text-gray-800 mb-4">
          Séquences ({sequences.length})
        </h3>

        {sequences.map((seq) => {
          const accessibility = isSequenceAccessible(seq, currentSequence, completedSequenceIds, isPremium, isPreview)
          
          return (
            <SequenceCard
              key={seq.id}
              sequence={seq}
              accessibility={accessibility}
              gradient={categoryConfig.gradient}
              onStart={() => onStartSequence(seq)}
            />
          )
        })}

        {sequences.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">
            Aucune séquence disponible
          </p>
        )}
      </div>

      {/* CTA fixe en bas */}
      <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg z-20">
        <div className="max-w-lg mx-auto">
          {nextSequence ? (
            <button
              onClick={() => onStartSequence(nextSequence)}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${categoryConfig.gradient.from}, ${categoryConfig.gradient.to})`,
              }}
            >
              <Play size={18} />
              {completedInFormation === 0
                ? 'Commencer la formation'
                : `Continuer — Séquence ${nextSequence.sequence_number}`}
            </button>
          ) : completedInFormation === sequences.length && sequences.length > 0 ? (
            <button
              onClick={() => setShowCompletionModal(true)}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg"
              style={{
                background: `linear-gradient(135deg, #22C55E, #16A34A)`,
              }}
            >
              <Trophy size={18} />
              Voir mes résultats
            </button>
          ) : (
            <button
              onClick={() => sequences[0] && onStartSequence(sequences[0])}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg"
              style={{
                background: `linear-gradient(135deg, ${categoryConfig.gradient.from}, ${categoryConfig.gradient.to})`,
              }}
            >
              <Play size={18} />
              Recommencer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
