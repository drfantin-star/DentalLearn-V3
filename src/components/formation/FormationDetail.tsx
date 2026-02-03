'use client'

import React from 'react'
import {
  ChevronLeft,
  Check,
  Lock,
  Play,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

export interface Sequence {
  id: string
  number: number
  title: string
  isFree: boolean
  hasVideo: boolean
  hasPdf: boolean
  questionsCount: number
  points: number
  videoDuration?: string // ex: "8:00"
}

export interface FormationDetailData {
  id: string
  title: string
  instructor: string
  category: string
  categoryGradient: { from: string; to: string }
  categoryEmoji: string
  totalSequences: number
  totalPoints: number
  likes: number
  isCP: boolean
  sequences: Sequence[]
  userProgress: {
    currentSequence: number // dernière séquence débloquée
    completedSequences: number[]
    totalPoints: number
  } | null
}

interface FormationDetailProps {
  formation: FormationDetailData
  isPremium: boolean
  onBack: () => void
  onStartSequence: (sequence: Sequence) => void
}

// ============================================
// MOCK DATA — Formations de référence
// ============================================

const SEQUENCE_TITLES = [
  'Introduction — Découverte',
  'Bases scientifiques',
  'Mécanismes d\'action',
  'Protocole en cabinet',
  'Indications cliniques',
  'Contre-indications',
  'Gestion complications',
  'Cas clinique #1',
  'Techniques avancées',
  'Cas clinique #2',
  'Matériaux & produits',
  'Evidence-based',
  'Situations spéciales',
  'Synthèse pratique',
  'Cas clinique #3',
  'Évaluation finale',
]

export function generateMockSequences(count: number = 16): Sequence[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `seq-${i}`,
    number: i,
    title: i === 0 ? SEQUENCE_TITLES[0] : `Séquence ${i} — ${SEQUENCE_TITLES[i] || 'Contenu'}`,
    isFree: i === 0,
    hasVideo: i <= 3 || i === 7 || i === 14,
    hasPdf: i > 0,
    questionsCount: i === 0 ? 2 : 4,
    points: i === 0 ? 20 : 55,
    videoDuration: i === 0 ? '3:00' : i <= 3 ? '8:00' : '5:00',
  }))
}

export const mockFormationEclaircissement: FormationDetailData = {
  id: 'f1',
  title: 'Éclaircissements & Taches Blanches',
  instructor: 'Dr Laurent Elbeze',
  category: 'esthetique',
  categoryGradient: { from: '#8B5CF6', to: '#A78BFA' },
  categoryEmoji: '✨',
  totalSequences: 15,
  totalPoints: 825,
  likes: 142,
  isCP: true,
  sequences: generateMockSequences(16),
  userProgress: {
    currentSequence: 6,
    completedSequences: [0, 1, 2, 3, 4, 5],
    totalPoints: 280,
  },
}

export const mockFormationFelures: FormationDetailData = {
  id: 'f2',
  title: 'Fêlures : Diagnostic & Traitement',
  instructor: 'Dr Gauthier Weisrock',
  category: 'restauratrice',
  categoryGradient: { from: '#3B82F6', to: '#60A5FA' },
  categoryEmoji: '🦷',
  totalSequences: 15,
  totalPoints: 810,
  likes: 98,
  isCP: true,
  sequences: generateMockSequences(16),
  userProgress: {
    currentSequence: 1,
    completedSequences: [0],
    totalPoints: 20,
  },
}

// ============================================
// COMPOSANT — Carte séquence
// ============================================

function SequenceCard({
  sequence,
  formation,
  isPremium,
  onStart,
}: {
  sequence: Sequence
  formation: FormationDetailData
  isPremium: boolean
  onStart: () => void
}) {
  const currentSeq = formation.userProgress?.currentSequence || 0
  const completedSeqs = formation.userProgress?.completedSequences || []

  const isLocked = !sequence.isFree && !isPremium && sequence.number > 0
  const isCompleted = completedSeqs.includes(sequence.number)
  const isCurrent = sequence.number === currentSeq
  const isAccessible = sequence.number <= currentSeq

  // Styles conditionnels
  let bgColor = '#FAFAFF'
  let borderColor = '#E8E5F5'

  if (isCompleted) {
    bgColor = '#F0FDF4'
    borderColor = '#86EFAC'
  } else if (isCurrent) {
    bgColor = 'white'
    borderColor = formation.categoryGradient.from
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
    badgeBg = formation.categoryGradient.from
    badgeColor = 'white'
  } else if (isLocked) {
    badgeBg = '#CBD5E1'
    badgeColor = 'white'
  }

  const canClick = !isLocked && isAccessible

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
            sequence.number
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
            {sequence.isFree && (
              <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-lg text-[10px] font-bold">
                GRATUIT
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {sequence.hasVideo && (
              <span className="text-[10px] text-gray-500">
                📹 {sequence.videoDuration}
              </span>
            )}
            <span className="text-[10px] text-gray-500">
              📝 {sequence.questionsCount}Q
            </span>
            {sequence.hasPdf && (
              <span className="text-[10px] text-gray-500">📄 PDF</span>
            )}
            <span className="text-[10px] text-gray-500">
              ⭐ {sequence.points}
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

export default function FormationDetail({
  formation,
  isPremium,
  onBack,
  onStartSequence,
}: FormationDetailProps) {
  const currentSeq = formation.userProgress?.currentSequence || 0
  const completedSeqs = formation.userProgress?.completedSequences || []
  
  const nextSequence = formation.sequences.find(
    (s) => s.number === currentSeq && !completedSeqs.includes(s.number)
  ) || formation.sequences.find((s) => s.number === currentSeq)

  return (
    <div className="pb-24">
      {/* Header gradient */}
      <div
        className="pt-14 pb-6 px-4 rounded-b-[28px]"
        style={{
          background: `linear-gradient(135deg, ${formation.categoryGradient.from}, ${formation.categoryGradient.to})`,
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
        <p className="text-white/85 text-[13px] mb-3">{formation.instructor}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          <span className="bg-white/20 text-white px-3 py-1 rounded-xl text-xs">
            {formation.totalSequences} séquences
          </span>
          <span className="bg-white/20 text-white px-3 py-1 rounded-xl text-xs">
            {formation.totalPoints} points
          </span>
          {formation.isCP ? (
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

      {/* Liste des séquences */}
      <div className="px-4 pt-5">
        <h3 className="text-[15px] font-bold text-gray-800 mb-4">Séquences</h3>

        {formation.sequences.map((seq) => (
          <SequenceCard
            key={seq.id}
            sequence={seq}
            formation={formation}
            isPremium={isPremium}
            onStart={() => onStartSequence(seq)}
          />
        ))}
      </div>

      {/* CTA fixe en bas */}
      {nextSequence && (
        <div className="fixed bottom-20 left-0 right-0 p-4 bg-white border-t border-gray-100 shadow-lg z-20">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => onStartSequence(nextSequence)}
              className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${formation.categoryGradient.from}, ${formation.categoryGradient.to})`,
              }}
            >
              <Play size={18} />
              {currentSeq === 0
                ? 'Commencer la formation'
                : `Continuer — Séquence ${currentSeq}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
