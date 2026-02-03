'use client'

import React, { useState } from 'react'
import {
  GraduationCap,
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Trophy,
} from 'lucide-react'
import { axisIcons } from '@/lib/constants/axis'
import type { AxisWithProgress } from '@/lib/hooks/useAxes'

// Questions temporaires — sera Supabase
const quizQuestions = [
  {
    id: 1,
    text: 'Le détartrage peut être coté 3 fois par an pour un patient diabétique en ALD ?',
    isTrue: true,
    explanation:
      'Vrai. Depuis 2026, la fréquence passe à 3 fois par an pour les patients en ALD diabète.',
    source: 'Convention 2026',
  },
  {
    id: 2,
    text: 'La télé-expertise est opposable pour tous les patients depuis 2026 ?',
    isTrue: false,
    explanation:
      "Faux. Elle reste conditionnée aux patients dépendants ou en EHPAD.",
    source: 'Avenant 3',
  },
  {
    id: 3,
    text: "L'inlay-core fibré bénéficie d'une revalorisation de 12% ?",
    isTrue: true,
    explanation:
      'Vrai. Cette revalorisation encourage les restaurations conservatrices.',
    source: 'CCAM v72',
  },
  {
    id: 4,
    text: 'Le code HBJD001 inclut explicitement le polissage ?',
    isTrue: false,
    explanation: 'Faux. Le libellé reste inchangé.',
    source: 'CCAM v72',
  },
]

interface QuizModalProps {
  axis: AxisWithProgress
  onClose: () => void
  onComplete: (score: number) => void
}

export default function QuizModal({
  axis,
  onClose,
  onComplete,
}: QuizModalProps) {
  const [current, setCurrent] = useState(0)
  const [score, setScore] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [finished, setFinished] = useState(false)

  const Icon = axisIcons[axis.id] || GraduationCap
  const q = quizQuestions[current]

  const answer = (val: boolean) => {
    const correct = val === q.isTrue
    setIsCorrect(correct)
    if (correct) setScore((s) => s + 1)
    setShowFeedback(true)
  }

  const next = () => {
    setShowFeedback(false)
    if (current < quizQuestions.length - 1) setCurrent((c) => c + 1)
    else setFinished(true)
  }

  // Écran de résultat
  if (finished) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center relative overflow-hidden">
          {/* Confetti */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(12)].map((_, i) => (
              <div
                key={i}
                className="absolute w-2 h-2 rounded-full animate-bounce"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 40}%`,
                  backgroundColor: [
                    axis.color,
                    '#00D1C1',
                    '#F59E0B',
                    '#EC4899',
                  ][i % 4],
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`,
                }}
              />
            ))}
          </div>

          <div className="relative z-10">
            <div
              className="w-20 h-20 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{ backgroundColor: `${axis.color}20` }}
            >
              <Trophy size={40} style={{ color: axis.color }} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Bravo !</h2>
            <p className="text-gray-500 mb-6">
              Quiz complété •{' '}
              <span className="font-bold" style={{ color: axis.color }}>
                +1 point
              </span>{' '}
              {axis.short_name}
            </p>
            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
              <div
                className="text-3xl font-black"
                style={{ color: axis.color }}
              >
                {score}/{quizQuestions.length}
              </div>
              <div className="text-xs text-gray-400 mt-1">bonnes réponses</div>
            </div>
            <button
              onClick={() => onComplete(score)}
              className="w-full py-3.5 bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
            >
              Retour à l&apos;accueil
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Écran de quiz
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${((current + 1) / quizQuestions.length) * 100}%`,
              backgroundColor: axis.color,
            }}
          />
        </div>

        {/* Header */}
        <div className="p-4 pb-0 flex justify-between items-start">
          <div>
            <div
              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-bold mb-2"
              style={{
                backgroundColor: `${axis.color}15`,
                color: axis.color,
              }}
            >
              <Icon size={14} />
              {axis.short_name}
            </div>
            <div className="text-xs text-gray-400">
              Question {current + 1}/{quizQuestions.length}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Question */}
        <div className="px-6 pb-6 pt-4">
          <h3 className="text-lg font-bold text-gray-900 leading-snug mb-6 min-h-[60px]">
            {q.text}
          </h3>

          {!showFeedback ? (
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => answer(true)}
                className="h-24 rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex flex-col items-center justify-center gap-2 hover:bg-emerald-100 hover:border-emerald-300 hover:scale-[1.02] transition-all active:scale-95"
              >
                <CheckCircle2 size={28} className="text-emerald-600" />
                <span className="text-lg font-black text-emerald-700">
                  VRAI
                </span>
              </button>
              <button
                onClick={() => answer(false)}
                className="h-24 rounded-2xl bg-red-50 border-2 border-red-100 flex flex-col items-center justify-center gap-2 hover:bg-red-100 hover:border-red-300 hover:scale-[1.02] transition-all active:scale-95"
              >
                <X size={28} className="text-red-600" />
                <span className="text-lg font-black text-red-700">FAUX</span>
              </button>
            </div>
          ) : (
            <div
              className={`rounded-2xl p-5 ${
                isCorrect
                  ? 'bg-emerald-50 border border-emerald-100'
                  : 'bg-red-50 border border-red-100'
              }`}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className={`p-2 rounded-full ${
                    isCorrect
                      ? 'bg-emerald-200 text-emerald-700'
                      : 'bg-red-200 text-red-700'
                  }`}
                >
                  {isCorrect ? (
                    <CheckCircle2 size={20} />
                  ) : (
                    <AlertCircle size={20} />
                  )}
                </div>
                <span
                  className={`text-lg font-bold ${
                    isCorrect ? 'text-emerald-800' : 'text-red-800'
                  }`}
                >
                  {isCorrect ? 'Exact !' : 'À retenir'}
                </span>
              </div>
              <p className="text-sm text-gray-700 mb-3 leading-relaxed">
                {q.explanation}
              </p>
              {q.source && (
                <p className="text-[11px] text-gray-400 italic mb-4">
                  {q.source}
                </p>
              )}
              <button
                onClick={next}
                className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
              >
                {current < quizQuestions.length - 1
                  ? 'Suivant'
                  : 'Voir mon score'}
                <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
