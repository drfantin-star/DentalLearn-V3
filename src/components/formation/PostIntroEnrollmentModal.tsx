'use client'

import React from 'react'
import { GraduationCap } from 'lucide-react'
import EnrollmentCTA, { type IntroSessionResult } from './EnrollmentCTA'

interface Props {
  isOpen: boolean
  onClose: () => void
  formationId: string
  formationTitle: string
  onEnrolled: () => void
  gradient?: { from: string; to: string }
  introSessionResult?: IntroSessionResult | null
}

export default function PostIntroEnrollmentModal({
  isOpen,
  onClose,
  formationId,
  formationTitle,
  onEnrolled,
  gradient,
  introSessionResult,
}: Props) {
  if (!isOpen) return null

  const grad = gradient || { from: '#8B5CF6', to: '#A78BFA' }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl p-6 text-center animate-in fade-in zoom-in duration-300"
        style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center"
          style={{ background: `linear-gradient(135deg, ${grad.from}, ${grad.to})` }}
        >
          <GraduationCap size={32} className="text-white" />
        </div>

        <h2 className="text-xl font-extrabold text-[#e5e5e5] mb-2">
          Continuer votre parcours ?
        </h2>

        <p className="text-sm text-[#a3a3a3] mb-5 leading-relaxed">
          Vous venez de découvrir l&apos;introduction de{' '}
          <span className="font-semibold text-[#e5e5e5]">{formationTitle}</span>.
          Inscrivez-vous gratuitement pour débloquer l&apos;ensemble de la formation
          et progresser à votre rythme.
        </p>

        <EnrollmentCTA
          formationId={formationId}
          formationTitle={formationTitle}
          onSuccess={onEnrolled}
          variant="inline"
          gradient={grad}
          label="S'inscrire et continuer"
          introSessionResult={introSessionResult}
        />

        <button
          onClick={onClose}
          className="mt-3 w-full py-2 text-sm text-[#a3a3a3] hover:text-[#e5e5e5] transition-colors"
        >
          Plus tard
        </button>
      </div>
    </div>
  )
}
