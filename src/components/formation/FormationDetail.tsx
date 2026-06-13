'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  ChevronLeft,
  Check,
  Lock,
  Play,
  Loader2,
  Star,
  Trophy,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
} from 'lucide-react'
import {
  useFormation,
  useUserFormationProgress,
  usePremiumAccess,
  useFormationPoints,
  useFormationCompletion,
  useBlocAcquisitionStatus,
  isSequenceAccessible,
  getCategoryConfig,
  type Sequence,
  type BlocAcquisitionStatus,
} from '@/lib/supabase'
import { useEnrollmentStatus } from '@/lib/hooks/useEnrollmentStatus'
import { useAudio } from '@/context/AudioContext'
import EnrollmentCTA from '@/components/formation/EnrollmentCTA'
import PostIntroEnrollmentModal from '@/components/formation/PostIntroEnrollmentModal'
import { GenerateAttestationButton } from '@/components/attestations/GenerateAttestationButton'
import { ColdSurveyEligibilityBadge } from '@/components/satisfaction/ColdSurveyEligibilityBadge'
import { ValidationFooter } from '@/components/editorial/ValidationFooter'
import UpcomingEvents from '@/components/UpcomingEvents'

// ============================================
// TYPES
// ============================================

interface FormationDetailProps {
  formationId: string
  onBack: () => void
  onStartSequence: (sequence: Sequence) => void
  triggerPostIntroModal?: boolean
  onPostIntroModalClose?: () => void
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
  // Verrou inter-bloc (PARTIE_A_v4 §2.4) : le bloc précédent n'est pas acquis.
  const isBlocLocked = accessibility.reason === 'bloc_locked'

  // Styles conditionnels
  let bgColor = '#1e1e1e'
  let borderColor = '#333'

  if (isCompleted) {
    bgColor = '#052e16'
    borderColor = '#86EFAC'
  } else if (isCurrent && !isCompleted) {
    bgColor = '#242424'
    borderColor = gradient.from
  } else if (isLocked || isNotUnlocked || isBlocLocked) {
    bgColor = '#1a1a1a'
    borderColor = '#333'
  }

  // Couleur du badge numéro
  let badgeBg = '#333'
  let badgeColor = '#a3a3a3'

  if (isCompleted) {
    badgeBg = '#22C55E'
    badgeColor = 'white'
  } else if (isCurrent && !isCompleted) {
    badgeBg = gradient.from
    badgeColor = 'white'
  } else if (isLocked || isNotUnlocked || isBlocLocked) {
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
        opacity: isNotUnlocked || isBlocLocked ? 0.5 : 1,
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
          ) : isLocked || isBlocLocked ? (
            <Lock size={14} />
          ) : (
            sequence.sequence_number
          )}
        </div>

        {/* Titre uniquement */}
        <div className="flex-1 min-w-0">
          <p
            className={`font-semibold text-[15px] leading-snug ${
              isLocked || isNotUnlocked || isBlocLocked ? 'text-gray-400' : 'text-[#e5e5e5]'
            }`}
          >
            {sequence.title}
          </p>
        </div>

        {/* badge premium supprimé */}
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
  onClose,
  gradient,
}: {
  formation: { title: string; instructor_name: string }
  earnedPoints: number
  totalPoints: number
  onClose: () => void
  gradient: { from: string; to: string }
}) {
  const scorePercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="rounded-3xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in duration-300" style={{ background: '#242424' }}>
        {/* Confettis / Trophy */}
        <div className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${gradient.from}, ${gradient.to})` }}>
          <Trophy size={40} className="text-white" />
        </div>

        {/* Titre */}
        <h2 className="text-xl font-extrabold text-[#e5e5e5] mb-1">
          🎉 Formation terminée !
        </h2>
        <p className="text-sm text-[#6b7280] mb-4">{formation.title}</p>

        {/* Score */}
        <div className="rounded-2xl p-4 mb-4" style={{ background: '#2a2010' }}>
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star size={20} className="text-amber-500 fill-amber-500" />
            <span className="text-2xl font-extrabold text-[#e5e5e5]">{earnedPoints}</span>
            <span className="text-[#6b7280] font-medium">/ {totalPoints} pts</span>
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
  triggerPostIntroModal,
  onPostIntroModalClose,
}: FormationDetailProps) {
  const { formation, sequences, loading, error } = useFormation(formationId)
  const { currentSequence, completedSequenceIds, refresh: refetchProgress } = useUserFormationProgress(formationId)
  const { isPremium } = usePremiumAccess()
  const { totalPoints, earnedPoints } = useFormationPoints(formationId)
  const { completionPercent } = useFormationCompletion(formationId, sequences, completedSequenceIds)
  const {
    isEnrolled,
    loading: enrollmentLoading,
    refetch: refetchEnrollment,
  } = useEnrollmentStatus(formationId)

  // MiniPlayer global (`(app)/layout.tsx`) flotte à `bottom-20` (z-40) dès
  // qu'un audio est chargé dans le contexte. On surveille `state.audioUrl`
  // pour décaler le CTA fixe au-dessus et éviter qu'il soit recouvert et
  // donc inatteignable au clic.
  const { state: audioState } = useAudio()
  const isMiniPlayerVisible = !!audioState.audioUrl

  const [showCompletionModal, setShowCompletionModal] = useState(false)
  const [showPostIntroModal, setShowPostIntroModal] = useState(false)

  useEffect(() => {
    if (triggerPostIntroModal && !isEnrolled && !enrollmentLoading) {
      setShowPostIntroModal(true)
    }
  }, [triggerPostIntroModal, isEnrolled, enrollmentLoading])

  const closePostIntroModal = () => {
    setShowPostIntroModal(false)
    onPostIntroModalClose?.()
  }

  const handleEnrolled = () => {
    refetchEnrollment()
    refetchProgress()
    closePostIntroModal()
  }

  // Modèle d'acquisition par bloc (PARTIE_A_v4 §2.4) : uniquement formations CP.
  const isCpFormation = formation?.axe_cp != null
  const { blocs: blocStatus } = useBlocAcquisitionStatus(formationId, isCpFormation)
  const blocStatusMap = useMemo(() => {
    const m = new Map<number, BlocAcquisitionStatus>()
    blocStatus.forEach(b => m.set(b.bloc_number, b))
    return m
  }, [blocStatus])

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
    
    // Chercher la première séquence accessible et non complétée. Pour les
    // formations CP, on saute les séquences d'un bloc verrouillé (PARTIE_A §2.4).
    for (const seq of sequences) {
      const access = isSequenceAccessible(seq, currentSequence, completedSequenceIds, isPremium)
      if (!access.accessible || access.reason === 'completed') continue
      if (isCpFormation && blocStatusMap.get(seq.bloc_number ?? 1)?.is_locked) continue
      return seq
    }

    // Si toutes complétées, retourner null (formation terminée)
    return null
  }, [sequences, currentSequence, completedSequenceIds, isPremium, isCpFormation, blocStatusMap])

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
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
    <div
      className={`${isMiniPlayerVisible ? 'pb-44' : 'pb-24'} min-h-screen`}
      style={{ background: '#0F0F0F' }}
    >
      {/* Modal de fin */}
      {showCompletionModal && (
        <CompletionModal
          formation={formation}
          earnedPoints={earnedPoints}
          totalPoints={totalPoints}
          onClose={() => setShowCompletionModal(false)}
          gradient={categoryConfig.gradient}
        />
      )}

      {/* Header gradient — compact */}
      <div
        className="pt-4 pb-5 px-4 rounded-b-[28px] relative"
        style={{
          background: `linear-gradient(135deg, ${categoryConfig.gradient.from}, ${categoryConfig.gradient.to})`,
        }}
      >
        {/* Bouton retour + Titre sur la même ligne */}
        <div className="flex items-start gap-3 mb-2">
          <button
            onClick={onBack}
            className="p-2 rounded-xl text-white hover:bg-white/20 transition-colors shrink-0 mt-0.5"
            style={{ background: 'rgba(255,255,255,0.2)' }}
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-xl font-extrabold text-white leading-tight">
            {formation.title}
          </h1>
          {formation.biblio_pdf_url && (
            <a
              href={formation.biblio_pdf_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm font-semibold hover:bg-white/20 transition-colors"
              style={{ background: 'rgba(255,255,255,0.2)' }}
            >
              <BookOpen size={18} />
              Biblio
            </a>
          )}
        </div>

        {/* Descriptif court — indenté sous le titre */}
        {formation.description_short && (
          <p className="text-white/85 text-[13px] leading-relaxed" style={{ paddingLeft: '44px' }}>
            {formation.description_short}
          </p>
        )}
      </div>

      {/* Statistiques de progression */}
      <div className="px-4 pt-4">
        <div className="rounded-2xl p-4" style={{ background: '#242424', border: '0.5px solid #333' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-[#e5e5e5]">Ta progression</span>
            <span className="text-sm text-[#a3a3a3]">{completedInFormation}/{sequences.length} séquences</span>
          </div>

          {/* Barre de progression */}
          <div className="w-full h-2.5 bg-[#333] rounded-full overflow-hidden mb-3">
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
              <div className="w-9 h-9 rounded-lg bg-amber-900/30 flex items-center justify-center shrink-0">
                <Star size={20} className="text-amber-500" fill="#F59E0B" />
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm text-[#a3a3a3]">Points gagnés</p>
                <p className="text-sm font-bold text-[#e5e5e5]">{earnedPoints} <span className="text-sm text-[#a3a3a3] font-normal">/ {totalPoints}</span></p>
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

      {/* Description déplacée dans le header */}

      {/* Prochaines dates présentielles */}
      <UpcomingEvents formationId={formationId} />

      {/* Liste des séquences */}
      <div className="px-4 pt-5">
        <h3 className="text-[15px] font-bold text-[#e5e5e5] mb-4">
          Séquences ({sequences.length})
        </h3>

        {isCpFormation && blocStatus.length > 0 ? (
          Array.from(new Set(sequences.map(s => s.bloc_number ?? 1)))
            .sort((a, b) => a - b)
            .map((blocNum) => {
              const b = blocStatusMap.get(blocNum)
              const blocSeqs = sequences.filter(s => (s.bloc_number ?? 1) === blocNum)
              const locked = !!b?.is_locked
              const complete = !!b?.is_complete
              const needsRemediation = !!b && !b.is_locked && !b.is_complete && b.failed_questions > 0

              let statusLabel = 'En cours'
              let statusColor = '#a3a3a3'
              let statusBg = '#242424'
              let StatusIcon = Play
              if (locked) {
                statusLabel = 'Verrouillé'
                statusColor = '#a3a3a3'
                statusBg = '#1a1a1a'
                StatusIcon = Lock
              } else if (complete) {
                statusLabel = 'Acquis'
                statusColor = '#86EFAC'
                statusBg = 'rgba(34,197,94,0.14)'
                StatusIcon = CheckCircle2
              } else if (needsRemediation) {
                statusLabel = 'Remédiation requise'
                statusColor = '#FBBF24'
                statusBg = 'rgba(245,158,11,0.14)'
                StatusIcon = AlertTriangle
              }

              return (
                <div key={`bloc-${blocNum}`} className="mb-4">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-baseline gap-2 min-w-0">
                      <span className="text-[13px] font-bold text-[#e5e5e5] shrink-0">Bloc {blocNum}</span>
                      {b && b.total_questions > 0 && (
                        <span className="text-[11px] text-[#a3a3a3] truncate">
                          {b.acquired_questions}/{b.total_questions} questions acquises
                        </span>
                      )}
                    </div>
                    <span
                      className="flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full shrink-0"
                      style={{ background: statusBg, color: statusColor }}
                    >
                      <StatusIcon size={12} />
                      {statusLabel}
                    </span>
                  </div>

                  {blocSeqs.map((seq) => {
                    const base = isSequenceAccessible(seq, currentSequence, completedSequenceIds, isPremium)
                    const accessibility = locked
                      ? { accessible: false, reason: 'bloc_locked' }
                      : base
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
                </div>
              )
            })
        ) : (
          sequences.map((seq) => {
            const accessibility = isSequenceAccessible(seq, currentSequence, completedSequenceIds, isPremium)

            return (
              <SequenceCard
                key={seq.id}
                sequence={seq}
                accessibility={accessibility}
                gradient={categoryConfig.gradient}
                onStart={() => onStartSequence(seq)}
              />
            )
          })
        )}

        {sequences.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">
            Aucune séquence disponible
          </p>
        )}
      </div>

      {/* Footer Qualiopi #21 + IA Act Article 50 §4 */}
      <div className="px-4">
        <ValidationFooter formationId={formation.id} />
      </div>

      {/* CTA fixe en bas — décalé au-dessus du MiniPlayer global s'il est
          présent, sinon collé juste au-dessus de la BottomNav. */}
      <div
        className={`fixed ${isMiniPlayerVisible ? 'bottom-40' : 'bottom-20'} left-0 right-0 p-4 shadow-lg z-50`}
        style={{ background: '#1a1a1a', borderTop: '0.5px solid #2a2a2a' }}
      >
        <div className="max-w-lg mx-auto">
          {completedInFormation >= sequences.length && sequences.length > 0 && (
            <div className="mb-3 space-y-3">
              <div className="flex justify-center">
                <ColdSurveyEligibilityBadge formationId={formation.id} />
              </div>
              <GenerateAttestationButton
                type="formation_online"
                sourceId={formation.id}
                label="Obtenir mon attestation de formation"
              />
            </div>
          )}
          {!enrollmentLoading && !isEnrolled ? (
            <EnrollmentCTA
              formationId={formation.id}
              formationTitle={formation.title}
              onSuccess={handleEnrolled}
              variant="fixed-bottom"
              gradient={categoryConfig.gradient}
            />
          ) : nextSequence ? (
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
                : `Continuer — ${
                    nextSequence.sequence_number === 0
                      ? 'Intro'
                      : nextSequence.sequence_number === sequences.length - 1
                      ? 'Conclusion'
                      : `Séquence ${nextSequence.sequence_number}`
                  }`}
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

      {/* Modal d'inscription post-intro */}
      <PostIntroEnrollmentModal
        isOpen={showPostIntroModal}
        onClose={closePostIntroModal}
        formationId={formation.id}
        formationTitle={formation.title}
        onEnrolled={handleEnrolled}
        gradient={categoryConfig.gradient}
      />
    </div>
  )
}
