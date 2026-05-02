'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Square,
  CheckSquare,
  Trophy,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface NewsQuizQuestion {
  id: string
  question_text: string
  options: unknown
  feedback_correct: string | null
  feedback_incorrect: string | null
  points: number
  question_type: string
  display_title: string | null
  specialite: string | null
}

interface StandardOption {
  id: string
  text: string
  correct: boolean
}

interface Props {
  specialite: string
  specialiteLabel: string
  onClose: () => void
}

function parseStandardOptions(options: unknown): StandardOption[] {
  if (!options) return []
  if (Array.isArray(options)) return options as StandardOption[]
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options)
      if (Array.isArray(parsed)) return parsed as StandardOption[]
    } catch { /* ignore */ }
  }
  if (typeof options === 'object' && options !== null) {
    const o = options as Record<string, unknown>
    if ('choices' in o && Array.isArray(o.choices)) {
      return (o.choices as { id: string; text: string; is_correct?: boolean; correct?: boolean }[])
        .map((c) => ({
          id: c.id,
          text: c.text,
          correct: c.correct ?? c.is_correct ?? false,
        }))
    }
  }
  return []
}

function normalizeType(t: string): 'mcq' | 'true_false' | 'checkbox' | 'unknown' {
  if (t === 'mcq' || t === 'qcm') return 'mcq'
  if (t === 'true_false') return 'true_false'
  if (t === 'checkbox') return 'checkbox'
  return 'unknown'
}

export default function QuizActuModal({
  specialite,
  specialiteLabel,
  onClose,
}: Props) {
  const [questions, setQuestions] = useState<NewsQuizQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [current, setCurrent] = useState(0)
  const [score, setScore] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [finished, setFinished] = useState(false)

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const fetchQuestions = async () => {
      const supabase = createClient()
      const { data, error: rpcError } = await supabase.rpc(
        'get_news_quiz_by_specialite',
        { p_specialite: specialite, p_limit: 5 }
      )
      if (cancelled) return
      if (rpcError) {
        setError(rpcError.message)
        setLoading(false)
        return
      }
      setQuestions((data ?? []) as NewsQuizQuestion[])
      setLoading(false)
    }

    fetchQuestions()
    return () => {
      cancelled = true
    }
  }, [specialite])

  const q = questions[current]
  const progress = questions.length > 0 ? ((current + 1) / questions.length) * 100 : 0
  const normalized = q ? normalizeType(q.question_type) : 'unknown'

  const resetQuestionState = () => {
    setSelectedAnswer(null)
    setSelectedAnswers([])
    setShowFeedback(false)
    setIsCorrect(false)
    setPointsEarned(0)
  }

  const evaluate = (correct: boolean, points: number) => {
    setIsCorrect(correct)
    setPointsEarned(points)
    if (correct) setScore((s) => s + 1)
    setTotalPoints((p) => p + points)
    setShowFeedback(true)
  }

  const handleSingleAnswer = (answerId: string) => {
    if (showFeedback || selectedAnswer || !q) return
    setSelectedAnswer(answerId)
    const opts = parseStandardOptions(q.options)
    const selected = opts.find((o) => o.id === answerId)
    const correct = selected?.correct || false
    evaluate(correct, correct ? q.points : 0)
  }

  const handleCheckboxValidate = () => {
    if (showFeedback || !q || selectedAnswers.length === 0) return
    const opts = parseStandardOptions(q.options)
    const correctIds = opts.filter((o) => o.correct).map((o) => o.id)
    const correctSelected = selectedAnswers.filter((a) => correctIds.includes(a)).length
    const incorrectSelected = selectedAnswers.filter((a) => !correctIds.includes(a)).length
    const ratio = correctIds.length === 0
      ? 0
      : Math.max(0, (correctSelected - incorrectSelected) / correctIds.length)
    const correct = ratio === 1
    const points = Math.round(ratio * q.points)
    evaluate(correct, points)
  }

  const next = () => {
    if (!q) return
    if (current < questions.length - 1) {
      resetQuestionState()
      setCurrent((c) => c + 1)
    } else {
      setFinished(true)
    }
  }

  const standardOptions = useMemo(
    () => (q ? parseStandardOptions(q.options) : []),
    [q]
  )

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm">
        <div
          className="w-full max-w-sm rounded-3xl p-8 text-center"
          style={{ background: '#1a1a1a' }}
        >
          <Loader2 className="w-10 h-10 animate-spin text-[#2D1B96] mx-auto mb-4" />
          <p className="font-medium" style={{ color: '#a3a3a3' }}>
            Chargement du quiz Actu…
          </p>
        </div>
      </div>
    )
  }

  if (error || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
        <div
          className="w-full max-w-sm rounded-3xl p-6 text-center"
          style={{ background: '#1a1a1a' }}
        >
          <AlertCircle className="w-12 h-12 text-amber-400 mx-auto mb-4" />
          <p className="font-medium mb-2" style={{ color: '#e5e5e5' }}>
            {error
              ? 'Erreur de chargement'
              : `Aucune question disponible pour ${specialiteLabel}`}
          </p>
          {error ? (
            <p className="text-sm mb-6" style={{ color: '#a3a3a3' }}>
              {error}
            </p>
          ) : (
            <p className="text-sm mb-6" style={{ color: '#a3a3a3' }}>
              Revenez plus tard, de nouvelles synthèses arriveront bientôt.
            </p>
          )}
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-sm"
            style={{ background: '#242424', color: '#e5e5e5' }}
          >
            Fermer
          </button>
        </div>
      </div>
    )
  }

  if (finished) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
        <div
          className="w-full max-w-sm rounded-3xl p-6 text-center"
          style={{ background: '#1a1a1a' }}
        >
          <div
            className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #2D1B96, #00D1C1)' }}
          >
            <Trophy size={36} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold mb-1" style={{ color: '#e5e5e5' }}>
            {score === questions.length
              ? 'Parfait !'
              : score >= Math.ceil(questions.length * 0.6)
                ? 'Bravo !'
                : 'Bien joué !'}
          </h2>
          <p className="text-sm mb-5" style={{ color: '#a3a3a3' }}>
            Quiz Actu — {specialiteLabel}
          </p>

          <div
            className="rounded-2xl p-5 mb-3 text-center"
            style={{ background: 'linear-gradient(135deg, #2D1B96, #00D1C1)' }}
          >
            <div className="text-5xl font-black text-white mb-1">
              {score}
              <span className="text-2xl font-bold opacity-70">
                /{questions.length}
              </span>
            </div>
            <div className="text-sm text-white/70">bonnes réponses</div>
            <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-center gap-2">
              <span className="text-2xl">⭐</span>
              <p className="text-xs text-white/60">Score</p>
              <p className="text-xl font-black text-white">+{totalPoints}</p>
            </div>
          </div>

          <p className="text-[11px] text-gray-500 mb-4">
            Mode exploration — points non comptabilisés en DPC.
          </p>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-gradient-to-r from-[#2D1B96] to-[#00D1C1]
                       text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
          >
            Terminer
          </button>
        </div>
      </div>
    )
  }

  if (!q) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0F0F0F' }}>
      <div className="flex-shrink-0">
        <div className="h-1.5" style={{ background: '#242424' }}>
          <div
            className="h-full bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div
          className="px-4 py-3 flex items-center justify-between"
          style={{ background: '#1a1a1a', borderBottom: '0.5px solid #2a2a2a' }}
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold" style={{ color: '#e5e5e5' }}>
              {current + 1}/{questions.length}
            </span>
            <span
              className="px-2 py-0.5 rounded-full text-[11px] font-medium"
              style={{ background: '#242424', color: '#a3a3a3' }}
            >
              {specialiteLabel}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#2D1B96]">
              {totalPoints} pts
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="p-2 rounded-full"
              style={{ color: '#6b7280' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium mb-3"
          style={{ background: 'rgba(45,27,150,0.3)', color: '#a78bfa' }}
        >
          📰 Actu scientifique
        </div>
        {q.display_title ? (
          <p className="text-xs text-gray-400 mb-3 italic line-clamp-2">
            {q.display_title}
          </p>
        ) : null}

        <h3
          className="text-lg font-bold leading-snug mb-6"
          style={{ color: '#e5e5e5' }}
        >
          {q.question_text}
        </h3>

        {!showFeedback ? (
          <>
            {(normalized === 'mcq' || normalized === 'true_false') && (
              <div className="flex flex-col gap-2.5">
                {standardOptions.map((opt, i) => {
                  const isSelected = selectedAnswer === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => handleSingleAnswer(opt.id)}
                      disabled={selectedAnswer !== null}
                      className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                      style={{
                        background: isSelected ? 'rgba(45,27,150,0.25)' : '#242424',
                        border: `2px solid ${isSelected ? '#2D1B96' : '#333'}`,
                        cursor: selectedAnswer ? 'default' : 'pointer',
                      }}
                    >
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                        style={{
                          background: isSelected ? '#2D1B96' : '#333',
                          color: isSelected ? 'white' : '#a3a3a3',
                        }}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span
                        className="flex-1 font-semibold text-sm"
                        style={{ color: '#e5e5e5' }}
                      >
                        {opt.text}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}

            {normalized === 'checkbox' && (
              <>
                <div className="flex flex-col gap-2.5">
                  {standardOptions.map((opt, i) => {
                    const checked = selectedAnswers.includes(opt.id)
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setSelectedAnswers((prev) =>
                            prev.includes(opt.id)
                              ? prev.filter((id) => id !== opt.id)
                              : [...prev, opt.id]
                          )
                        }
                        className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                        style={{
                          background: checked ? 'rgba(45,27,150,0.25)' : '#242424',
                          border: `2px solid ${checked ? '#2D1B96' : '#333'}`,
                        }}
                      >
                        {checked ? (
                          <CheckSquare size={22} className="text-[#2D1B96] shrink-0" />
                        ) : (
                          <Square size={22} className="text-gray-500 shrink-0" />
                        )}
                        <span
                          className="flex-1 font-semibold text-sm"
                          style={{ color: '#e5e5e5' }}
                        >
                          {String.fromCharCode(65 + i)}. {opt.text}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleCheckboxValidate}
                  disabled={selectedAnswers.length === 0}
                  className="w-full mt-5 py-3.5 rounded-xl font-bold text-white
                             bg-gradient-to-r from-[#2D1B96] to-[#00D1C1]
                             disabled:opacity-50"
                >
                  Valider
                </button>
              </>
            )}

            {normalized === 'unknown' && (
              <p className="text-sm text-gray-400">
                Type de question non supporté ({q.question_type}).
              </p>
            )}
          </>
        ) : (
          <div
            className="rounded-2xl p-5"
            style={{
              background: isCorrect ? 'rgba(6,78,59,0.3)' : 'rgba(69,10,10,0.3)',
              border: `1px solid ${isCorrect ? '#059669' : '#ef4444'}`,
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              {isCorrect ? (
                <CheckCircle2 size={22} className="text-emerald-400" />
              ) : (
                <X size={22} className="text-red-400" />
              )}
              <span
                className={`text-sm font-bold ${
                  isCorrect ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {isCorrect ? 'Bonne réponse' : 'Mauvaise réponse'}
              </span>
              {pointsEarned > 0 ? (
                <span className="ml-auto text-xs font-bold text-[#a78bfa]">
                  +{pointsEarned} pts
                </span>
              ) : null}
            </div>
            <p className="text-sm whitespace-pre-line" style={{ color: '#e5e5e5' }}>
              {isCorrect ? q.feedback_correct : q.feedback_incorrect}
            </p>
            <button
              type="button"
              onClick={next}
              className="w-full mt-5 py-3.5 rounded-xl font-bold text-white
                         bg-gradient-to-r from-[#2D1B96] to-[#00D1C1]
                         flex items-center justify-center gap-2"
            >
              {current < questions.length - 1 ? 'Question suivante' : 'Voir mon score'}
              <ArrowRight size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
