'use client'

import React, { useState, useEffect, useCallback } from 'react'
import {
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Trophy,
  Loader2,
  Clock,
  Square,
  CheckSquare,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface StandardOption {
  id: string
  text: string
  correct: boolean
}

interface FillBlankBlank {
  id: string
  correctAnswer: string
  alternatives?: string[]
}

interface FillBlankOptions {
  blanks: FillBlankBlank[]
  wordBank: string[]
}

interface OrderingOption {
  id: string
  text: string
  correctPosition: number
}

interface MatchingPair {
  id: string
  left: string
  right: string
}

interface DailyQuestion {
  id: string
  question_text: string
  options: unknown
  image_url?: string | null
  feedback_correct: string
  feedback_incorrect: string
  points: number
  formation_title: string | null
  question_type: string
}

interface DailyQuizModalProps {
  userId: string
  onClose: () => void
  onComplete: (score: number, totalPoints: number) => void
}

// ============================================
// PARSERS (adapted from SequencePlayer)
// ============================================

function parseStandardOptions(options: unknown): StandardOption[] {
  if (!options) return []
  if (Array.isArray(options)) return options as StandardOption[]
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options)
      if (Array.isArray(parsed)) return parsed as StandardOption[]
    } catch { /* ignore */ }
  }
  // Handle { choices: [...] } format from API
  if (typeof options === 'object' && options !== null) {
    const o = options as Record<string, unknown>
    if ('choices' in o && Array.isArray(o.choices)) {
      return (o.choices as { id: string; text: string; is_correct?: boolean; correct?: boolean }[]).map(c => ({
        id: c.id,
        text: c.text,
        correct: c.correct ?? c.is_correct ?? false,
      }))
    }
  }
  return []
}

function parseFillBlankOptions(options: unknown): FillBlankOptions | null {
  if (!options) return null
  let opts = options
  if (typeof options === 'string') {
    try { opts = JSON.parse(options) } catch { return null }
  }
  if (typeof opts === 'object' && opts !== null) {
    const o = opts as Record<string, unknown>
    if ('blanks' in o && Array.isArray(o.blanks)) {
      return {
        blanks: o.blanks as FillBlankBlank[],
        wordBank: 'wordBank' in o && Array.isArray(o.wordBank) ? o.wordBank as string[] : [],
      }
    }
  }
  return null
}

function parseOrderingOptions(options: unknown): OrderingOption[] {
  if (!options) return []
  let opts = options
  if (typeof options === 'string') {
    try { opts = JSON.parse(options) } catch { return [] }
  }
  if (typeof opts === 'object' && !Array.isArray(opts) && opts !== null) {
    const o = opts as Record<string, unknown>
    if ('ordering' in o && Array.isArray(o.ordering)) return o.ordering as OrderingOption[]
    if ('items' in o && Array.isArray(o.items)) return o.items as OrderingOption[]
  }
  if (Array.isArray(opts) && opts.length > 0 && 'correctPosition' in (opts[0] as Record<string, unknown>)) {
    return opts as OrderingOption[]
  }
  return []
}

function parseMatchingOptions(options: unknown): MatchingPair[] {
  if (!options) return []
  let opts = options
  if (typeof options === 'string') {
    try { opts = JSON.parse(options) } catch { return [] }
  }
  if (typeof opts === 'object' && !Array.isArray(opts) && opts !== null) {
    const o = opts as Record<string, unknown>
    if ('pairs' in o && Array.isArray(o.pairs)) return o.pairs as MatchingPair[]
  }
  return []
}

// ============================================
// HELPERS
// ============================================

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}

const typeLabels: Record<string, string> = {
  mcq: 'QCM',
  true_false: 'Vrai/Faux',
  qcm: 'QCM',
  qcm_image: 'QCM Image',
  mcq_image: 'QCM Image',
  checkbox: 'Choix multiples',
  fill_blank: 'Compléter',
  highlight: 'Barrer les intrus',
  ordering: 'Ordonnancement',
  matching: 'Association',
}

const GRADIENT_FROM = '#2D1B96'

// ============================================
// COMPONENT
// ============================================

export default function DailyQuizModal({
  userId,
  onClose,
  onComplete,
}: DailyQuizModalProps) {
  const [questions, setQuestions] = useState<DailyQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [current, setCurrent] = useState(0)
  const [score, setScore] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [pointsEarned, setPointsEarned] = useState(0)
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)

  // Single-select state (mcq, true_false, mcq_image)
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)

  // Multi-select state (checkbox, highlight)
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])

  // Fill blank state
  const [fillBlankAnswers, setFillBlankAnswers] = useState<Record<string, string>>({})

  // Ordering state
  const [orderingOrder, setOrderingOrder] = useState<string[]>([])

  // Matching state
  const [matchingMatches, setMatchingMatches] = useState<Record<string, string>>({})
  const [selectedLeftMatching, setSelectedLeftMatching] = useState<string | null>(null)
  const [shuffledMatchingRights, setShuffledMatchingRights] = useState<MatchingPair[]>([])

  // Timer per question
  const [timeLeft, setTimeLeft] = useState(60)

  useEffect(() => {
    fetchQuestions()
  }, [])

  // Question timer
  useEffect(() => {
    if (loading || finished || showFeedback || questions.length === 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [current, loading, finished, showFeedback, questions.length])

  // Initialize ordering when question changes
  useEffect(() => {
    if (questions.length === 0) return
    const q = questions[current]
    if (!q) return

    if (q.question_type === 'ordering' && orderingOrder.length === 0) {
      const opts = parseOrderingOptions(q.options)
      if (opts.length > 0) {
        let shuffled = shuffleArray(opts.map(o => o.id))
        let attempts = 0
        while (
          shuffled.every((id, idx) => {
            const opt = opts.find(o => o.id === id)
            return opt?.correctPosition === idx + 1
          }) &&
          attempts < 10
        ) {
          shuffled = shuffleArray(opts.map(o => o.id))
          attempts++
        }
        setOrderingOrder(shuffled)
      }
    }
  }, [current, questions, orderingOrder.length])

  // Initialize matching when question changes
  useEffect(() => {
    if (questions.length === 0) return
    const q = questions[current]
    if (!q) return

    if (q.question_type === 'matching' && shuffledMatchingRights.length === 0) {
      const pairs = parseMatchingOptions(q.options)
      if (pairs.length > 0) {
        let shuffled = shuffleArray([...pairs])
        let attempts = 0
        while (shuffled.every((p, i) => p.id === pairs[i].id) && attempts < 10) {
          shuffled = shuffleArray([...pairs])
          attempts++
        }
        setShuffledMatchingRights(shuffled)
      }
    }
  }, [current, questions, shuffledMatchingRights.length])

  const fetchQuestions = async () => {
    try {
      const response = await fetch(`/api/daily-quiz?user_id=${userId}`)
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.error || 'Erreur de chargement')
      }
      const data = await response.json()
      setQuestions(data.questions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  const resetQuestionState = () => {
    setSelectedAnswer(null)
    setSelectedAnswers([])
    setFillBlankAnswers({})
    setOrderingOrder([])
    setMatchingMatches({})
    setSelectedLeftMatching(null)
    setShuffledMatchingRights([])
    setShowFeedback(false)
    setIsCorrect(false)
    setPointsEarned(0)
    setTimeLeft(60)
  }

  const handleTimeout = useCallback(() => {
    if (showFeedback) return
    setIsCorrect(false)
    setPointsEarned(0)
    setShowFeedback(true)
  }, [showFeedback])

  // ============================================
  // VALIDATION HANDLERS
  // ============================================

  const evaluateAnswer = (correct: boolean, points: number) => {
    setIsCorrect(correct)
    setPointsEarned(points)
    if (correct) setScore(s => s + 1)
    setTotalPoints(p => p + points)
    setShowFeedback(true)
  }

  // MCQ / True-False / MCQ Image
  const handleSingleAnswer = (answerId: string) => {
    if (showFeedback || selectedAnswer) return
    setSelectedAnswer(answerId)

    const q = questions[current]
    const qType = q.question_type

    // Handle true_false with correct_answer format from API
    if (qType === 'true_false') {
      const opts = parseStandardOptions(q.options)
      if (opts.length > 0) {
        const selected = opts.find(o => o.id === answerId)
        const correct = selected?.correct || false
        evaluateAnswer(correct, correct ? q.points : 0)
        return
      }
      // Fallback for { correct_answer: boolean } format
      const optObj = q.options as Record<string, unknown>
      if ('correct_answer' in optObj) {
        const val = answerId === 'true'
        const correct = val === optObj.correct_answer
        evaluateAnswer(correct, correct ? q.points : 0)
        return
      }
    }

    const opts = parseStandardOptions(q.options)
    const selected = opts.find(o => o.id === answerId)
    const correct = selected?.correct || false
    evaluateAnswer(correct, correct ? q.points : 0)
  }

  // Checkbox
  const handleCheckboxValidate = () => {
    if (showFeedback || selectedAnswers.length === 0) return
    const q = questions[current]
    const opts = parseStandardOptions(q.options)
    const correctIds = opts.filter(o => o.correct).map(o => o.id)

    const correctSelected = selectedAnswers.filter(a => correctIds.includes(a)).length
    const incorrectSelected = selectedAnswers.filter(a => !correctIds.includes(a)).length
    const ratio = Math.max(0, (correctSelected - incorrectSelected) / correctIds.length)
    const correct = ratio === 1
    const points = Math.round(ratio * q.points)

    evaluateAnswer(correct, points)
  }

  // Highlight
  const handleHighlightValidate = () => {
    if (showFeedback || selectedAnswers.length === 0) return
    const q = questions[current]
    const opts = parseStandardOptions(q.options)
    const intrusIds = opts.filter(o => !o.correct).map(o => o.id)

    const intrusBarred = selectedAnswers.filter(a => intrusIds.includes(a)).length
    const correctBarred = selectedAnswers.filter(a => !intrusIds.includes(a)).length
    const ratio = intrusIds.length > 0 ? Math.max(0, (intrusBarred - correctBarred) / intrusIds.length) : 0
    const correct = ratio === 1
    const points = Math.round(ratio * q.points)

    evaluateAnswer(correct, points)
  }

  // Fill Blank
  const handleFillBlankValidate = () => {
    const q = questions[current]
    const opts = parseFillBlankOptions(q.options)
    if (!opts) return

    let correctCount = 0
    for (const blank of opts.blanks) {
      const userAnswer = (fillBlankAnswers[blank.id] || '').toLowerCase().trim()
      const correctAnswer = blank.correctAnswer.toLowerCase().trim()
      const alternatives = blank.alternatives?.map(a => a.toLowerCase().trim()) || []
      if (userAnswer === correctAnswer || alternatives.includes(userAnswer)) {
        correctCount++
      }
    }

    const ratio = opts.blanks.length > 0 ? correctCount / opts.blanks.length : 0
    const correct = ratio === 1
    const points = Math.round(ratio * q.points)

    evaluateAnswer(correct, points)
  }

  // Ordering
  const handleOrderingValidate = () => {
    const q = questions[current]
    const opts = parseOrderingOptions(q.options)

    let correctCount = 0
    orderingOrder.forEach((itemId, index) => {
      const opt = opts.find(o => o.id === itemId)
      if (opt && opt.correctPosition === index + 1) correctCount++
    })

    const ratio = opts.length > 0 ? correctCount / opts.length : 0
    const correct = ratio === 1
    const points = Math.round(ratio * q.points)

    evaluateAnswer(correct, points)
  }

  // Matching
  const handleMatchingValidate = () => {
    const q = questions[current]
    const pairs = parseMatchingOptions(q.options)

    let correctCount = 0
    for (const pair of pairs) {
      if (matchingMatches[pair.id] === pair.id) correctCount++
    }

    const ratio = pairs.length > 0 ? correctCount / pairs.length : 0
    const correct = ratio === 1
    const points = Math.round(ratio * q.points)

    evaluateAnswer(correct, points)
  }

  // ============================================
  // NAVIGATION
  // ============================================

  const next = async () => {
    if (current < questions.length - 1) {
      resetQuestionState()
      setCurrent(c => c + 1)
    } else {
      setFinished(true)
      await saveResults()
    }
  }

  const saveResults = async () => {
    setSaving(true)
    try {
      const perfectBonus = score === questions.length ? 50 : 0

      await fetch('/api/daily-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          score,
          total_questions: questions.length,
          total_points: totalPoints + perfectBonus,
          question_ids: questions.map(q => q.id),
        }),
      })
    } catch (err) {
      console.error('Error saving quiz results:', err)
    } finally {
      setSaving(false)
    }
  }

  // ============================================
  // RENDER: LOADING / ERROR / RESULTS
  // ============================================

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl p-8 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-[#2D1B96] mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Chargement du quiz...</p>
        </div>
      </div>
    )
  }

  if (error || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-gray-700 font-medium mb-2">
            {error || 'Aucune question disponible'}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Revenez plus tard ou contactez le support.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    )
  }

  // Results screen
  if (finished) {
    const finalScore = score
    const isPerfect = finalScore === questions.length
    const bonusPoints = isPerfect ? 50 : 0

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
        <div className="bg-white w-full max-w-sm rounded-3xl p-6 text-center relative overflow-hidden">
          {isPerfect && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(16)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 rounded-full animate-bounce"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 50}%`,
                    backgroundColor: ['#2D1B96', '#00D1C1', '#F59E0B', '#EC4899'][i % 4],
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${1 + Math.random()}s`,
                  }}
                />
              ))}
            </div>
          )}

          <div className="relative z-10">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#2D1B96]/10 to-[#00D1C1]/10 flex items-center justify-center">
              <Trophy size={40} className="text-[#2D1B96]" />
            </div>

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              {isPerfect ? 'Parfait !' : finalScore >= 7 ? 'Bravo !' : 'Bien joue !'}
            </h2>

            <p className="text-gray-500 mb-6">Quiz du jour termine</p>

            <div className="bg-gray-50 rounded-2xl p-4 mb-4">
              <div className="text-3xl font-black text-[#2D1B96]">
                {finalScore}/{questions.length}
              </div>
              <div className="text-xs text-gray-400 mt-1">bonnes reponses</div>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-3 mb-6 text-left space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Points gagnes</span>
                <span className="font-bold text-amber-700">+{totalPoints} pts</span>
              </div>
              {isPerfect && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Bonus 100%</span>
                  <span className="font-bold text-emerald-600">+{bonusPoints} pts</span>
                </div>
              )}
            </div>

            <button
              onClick={() => onComplete(finalScore, totalPoints + bonusPoints)}
              disabled={saving}
              className="w-full py-3.5 bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                "Retour a l'accueil"
              )}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: QUIZ SCREEN
  // ============================================

  const q = questions[current]
  const progress = ((current + 1) / questions.length) * 100
  const qType = q.question_type

  // Normalize type names (API may use 'qcm' instead of 'mcq')
  const normalizedType = qType === 'qcm' ? 'mcq' : qType === 'qcm_image' ? 'mcq_image' : qType

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0">
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-700">
              {current + 1}/{questions.length}
            </span>
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                timeLeft <= 10
                  ? 'bg-red-100 text-red-600'
                  : timeLeft <= 30
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              <Clock size={12} />
              {timeLeft}s
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#2D1B96]">
              {totalPoints} pts
            </span>
            <button
              onClick={onClose}
              className="p-2 text-gray-300 hover:text-gray-500 hover:bg-gray-50 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Question content - scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {/* Formation tag */}
        {q.formation_title && (
          <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#2D1B96]/10 text-[#2D1B96] text-xs font-medium mb-3">
            {q.formation_title}
          </div>
        )}

        {/* Type badge */}
        <span className="inline-block bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[11px] font-semibold mb-3 ml-1">
          {typeLabels[qType] || qType.toUpperCase()}
        </span>

        {/* Image */}
        {q.image_url && (
          <div className="mb-4">
            <img src={q.image_url} alt="Question" className="w-full rounded-xl border border-gray-200" />
          </div>
        )}

        {/* Question text */}
        <h3 className="text-lg font-bold text-gray-900 leading-snug mb-6">
          {q.question_text}
        </h3>

        {!showFeedback ? (
          <>
            {/* === MCQ / MCQ_IMAGE === */}
            {(normalizedType === 'mcq' || normalizedType === 'mcq_image') && (() => {
              const opts = parseStandardOptions(q.options)
              return (
                <div className="flex flex-col gap-2.5">
                  {opts.map((opt, i) => {
                    const isSelected = selectedAnswer === opt.id
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSingleAnswer(opt.id)}
                        disabled={selectedAnswer !== null}
                        className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                        style={{
                          background: isSelected ? '#F1F5F9' : '#FAFAFF',
                          border: `2px solid ${isSelected ? '#94A3B8' : '#E2E8F0'}`,
                          cursor: selectedAnswer ? 'default' : 'pointer',
                        }}
                      >
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                          style={{
                            background: isSelected ? '#475569' : '#E2E8F0',
                            color: isSelected ? 'white' : '#64748B',
                          }}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1 font-semibold text-sm text-gray-800">{opt.text}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {/* === TRUE_FALSE === */}
            {normalizedType === 'true_false' && (() => {
              const opts = parseStandardOptions(q.options)
              // If options are standard format with id/text/correct, render as buttons
              if (opts.length >= 2) {
                return (
                  <div className="grid grid-cols-2 gap-4">
                    {opts.map(opt => {
                      const isVrai = opt.text.toLowerCase().includes('vrai') || opt.text.toLowerCase() === 'true'
                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSingleAnswer(opt.id)}
                          disabled={selectedAnswer !== null}
                          className={`h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-all active:scale-95 ${
                            isVrai
                              ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100 hover:border-emerald-300'
                              : 'bg-red-50 border-red-100 hover:bg-red-100 hover:border-red-300'
                          }`}
                        >
                          {isVrai ? (
                            <CheckCircle2 size={28} className="text-emerald-600" />
                          ) : (
                            <X size={28} className="text-red-600" />
                          )}
                          <span className={`text-lg font-black ${isVrai ? 'text-emerald-700' : 'text-red-700'}`}>
                            {opt.text}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              }
              // Fallback: hardcoded VRAI/FAUX buttons for { correct_answer } format
              return (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleSingleAnswer('true')}
                    disabled={selectedAnswer !== null}
                    className="h-24 rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex flex-col items-center justify-center gap-2 hover:bg-emerald-100 hover:border-emerald-300 hover:scale-[1.02] transition-all active:scale-95"
                  >
                    <CheckCircle2 size={28} className="text-emerald-600" />
                    <span className="text-lg font-black text-emerald-700">VRAI</span>
                  </button>
                  <button
                    onClick={() => handleSingleAnswer('false')}
                    disabled={selectedAnswer !== null}
                    className="h-24 rounded-2xl bg-red-50 border-2 border-red-100 flex flex-col items-center justify-center gap-2 hover:bg-red-100 hover:border-red-300 hover:scale-[1.02] transition-all active:scale-95"
                  >
                    <X size={28} className="text-red-600" />
                    <span className="text-lg font-black text-red-700">FAUX</span>
                  </button>
                </div>
              )
            })()}

            {/* === CHECKBOX === */}
            {normalizedType === 'checkbox' && (() => {
              const opts = parseStandardOptions(q.options)
              return (
                <>
                  <p className="text-xs text-blue-600 mb-3">Plusieurs reponses possibles — cochez puis validez</p>
                  <div className="flex flex-col gap-2.5">
                    {opts.map(opt => {
                      const isSelected = selectedAnswers.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setSelectedAnswers(prev =>
                            prev.includes(opt.id)
                              ? prev.filter(a => a !== opt.id)
                              : [...prev, opt.id]
                          )}
                          className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                          style={{
                            background: isSelected ? '#F1F5F9' : '#FAFAFF',
                            border: `2px solid ${isSelected ? '#94A3B8' : '#E2E8F0'}`,
                          }}
                        >
                          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                            {isSelected
                              ? <CheckSquare size={24} style={{ color: GRADIENT_FROM }} />
                              : <Square size={24} className="text-gray-400" />
                            }
                          </span>
                          <span className="flex-1 font-semibold text-sm text-gray-800">{opt.text}</span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={handleCheckboxValidate}
                    disabled={selectedAnswers.length === 0}
                    className="w-full mt-4 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40"
                    style={{ background: GRADIENT_FROM }}
                  >
                    Valider ({selectedAnswers.length} selectionnee{selectedAnswers.length > 1 ? 's' : ''})
                  </button>
                </>
              )
            })()}

            {/* === HIGHLIGHT === */}
            {normalizedType === 'highlight' && (() => {
              const opts = parseStandardOptions(q.options)
              return (
                <>
                  <p className="text-xs text-rose-600 mb-3">Barrez les intrus en les selectionnant</p>
                  <div className="flex flex-col gap-2.5">
                    {opts.map(opt => {
                      const isSelected = selectedAnswers.includes(opt.id)
                      return (
                        <button
                          key={opt.id}
                          onClick={() => setSelectedAnswers(prev =>
                            prev.includes(opt.id)
                              ? prev.filter(a => a !== opt.id)
                              : [...prev, opt.id]
                          )}
                          className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                          style={{
                            background: isSelected ? '#FEF2F2' : '#FAFAFF',
                            border: `2px solid ${isSelected ? '#FCA5A5' : '#E2E8F0'}`,
                          }}
                        >
                          <span
                            className="flex-1 font-semibold text-sm"
                            style={{
                              color: isSelected ? '#DC2626' : '#334155',
                              textDecoration: isSelected ? 'line-through' : 'none',
                            }}
                          >
                            {opt.text}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={handleHighlightValidate}
                    disabled={selectedAnswers.length === 0}
                    className="w-full mt-4 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40"
                    style={{ background: GRADIENT_FROM }}
                  >
                    Valider mes choix
                  </button>
                </>
              )
            })()}

            {/* === FILL_BLANK === */}
            {normalizedType === 'fill_blank' && (() => {
              const opts = parseFillBlankOptions(q.options)
              if (!opts) return <p className="text-gray-500">Format de question non supporte</p>

              const hasWordBank = opts.wordBank && opts.wordBank.length > 0
              const usedWords = Object.values(fillBlankAnswers)
              const allFilled = opts.blanks.every(b => fillBlankAnswers[b.id])

              return (
                <>
                  <p className="text-xs text-indigo-600 mb-3">
                    {hasWordBank ? 'Selectionnez un mot de la banque pour chaque blanc' : 'Tapez votre reponse'}
                  </p>

                  <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 mb-4 space-y-3">
                    {opts.blanks.map((blank, idx) => {
                      const answer = fillBlankAnswers[blank.id]
                      return (
                        <div key={blank.id} className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm text-gray-600 font-medium">
                            {opts.blanks.length > 1 ? `Blanc ${idx + 1}:` : 'Reponse:'}
                          </span>

                          {hasWordBank ? (
                            <button
                              onClick={() => setFillBlankAnswers(prev => {
                                const next = { ...prev }
                                delete next[blank.id]
                                return next
                              })}
                              className="min-w-[100px] px-4 py-2 rounded-xl border-2 border-dashed text-sm font-semibold transition-all"
                              style={{
                                borderColor: answer ? GRADIENT_FROM : '#CBD5E1',
                                background: answer ? `${GRADIENT_FROM}10` : 'white',
                                color: '#334155',
                              }}
                            >
                              {answer || '________'}
                            </button>
                          ) : (
                            <input
                              type="text"
                              value={answer || ''}
                              onChange={e => setFillBlankAnswers(prev => ({ ...prev, [blank.id]: e.target.value }))}
                              placeholder="Tapez votre reponse..."
                              className="flex-1 min-w-[150px] px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all outline-none"
                              style={{ borderColor: '#CBD5E1', background: 'white', color: '#334155' }}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {hasWordBank && (
                    <div className="flex flex-wrap gap-2 mb-4">
                      {opts.wordBank.map((word, i) => {
                        const isUsed = usedWords.includes(word)
                        return (
                          <button
                            key={`${word}-${i}`}
                            onClick={() => {
                              if (isUsed) return
                              const emptyBlank = opts.blanks.find(b => !fillBlankAnswers[b.id])
                              if (emptyBlank) {
                                setFillBlankAnswers(prev => ({ ...prev, [emptyBlank.id]: word }))
                              }
                            }}
                            disabled={isUsed}
                            className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                            style={{
                              background: isUsed ? '#E2E8F0' : GRADIENT_FROM,
                              color: isUsed ? '#94A3B8' : 'white',
                              opacity: isUsed ? 0.5 : 1,
                            }}
                          >
                            {word}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <button
                    onClick={handleFillBlankValidate}
                    disabled={!allFilled}
                    className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40"
                    style={{ background: GRADIENT_FROM }}
                  >
                    Valider {hasWordBank ? 'mes reponses' : 'ma reponse'}
                  </button>
                </>
              )
            })()}

            {/* === ORDERING === */}
            {normalizedType === 'ordering' && (() => {
              const opts = parseOrderingOptions(q.options)
              if (opts.length === 0) return <p className="text-gray-500">Format de question non supporte</p>

              const moveItem = (from: number, to: number) => {
                if (to < 0 || to >= orderingOrder.length) return
                const newOrder = [...orderingOrder]
                const [moved] = newOrder.splice(from, 1)
                newOrder.splice(to, 0, moved)
                setOrderingOrder(newOrder)
              }

              return (
                <>
                  <p className="text-xs text-amber-600 mb-3">Utilisez les fleches pour reordonner</p>
                  <div className="flex flex-col gap-2">
                    {orderingOrder.map((itemId, index) => {
                      const item = opts.find(o => o.id === itemId)
                      if (!item) return null
                      return (
                        <div
                          key={itemId}
                          className="flex items-center gap-2 p-3 rounded-2xl border-2 transition-all"
                          style={{ background: '#FAFAFF', borderColor: '#E2E8F0' }}
                        >
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                            style={{ background: GRADIENT_FROM }}
                          >
                            {index + 1}
                          </span>
                          <span className="flex-1 text-sm font-semibold text-gray-700">{item.text}</span>
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveItem(index, index - 1)}
                              disabled={index === 0}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                            >
                              <ChevronUp size={16} className="text-gray-500" />
                            </button>
                            <button
                              onClick={() => moveItem(index, index + 1)}
                              disabled={index === orderingOrder.length - 1}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                            >
                              <ChevronDown size={16} className="text-gray-500" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={handleOrderingValidate}
                    className="w-full mt-4 py-3.5 rounded-2xl font-bold text-[15px] text-white"
                    style={{ background: GRADIENT_FROM }}
                  >
                    Valider l&apos;ordre
                  </button>
                </>
              )
            })()}

            {/* === MATCHING === */}
            {normalizedType === 'matching' && (() => {
              const pairs = parseMatchingOptions(q.options)
              if (pairs.length === 0) return <p className="text-gray-500">Format de question non supporte</p>

              return (
                <>
                  <p className="text-xs text-teal-600 mb-3">Cliquez sur un element gauche puis son correspondant a droite</p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Left column */}
                    <div className="flex flex-col gap-2">
                      {pairs.map(pair => {
                        const isSelected = selectedLeftMatching === pair.id
                        const isMatched = !!matchingMatches[pair.id]
                        return (
                          <button
                            key={pair.id}
                            onClick={() => !isMatched && setSelectedLeftMatching(pair.id)}
                            disabled={isMatched}
                            className="p-3 rounded-xl border-2 text-left text-sm font-semibold transition-all"
                            style={{
                              background: isSelected ? `${GRADIENT_FROM}15` : isMatched ? '#F1F5F9' : '#FAFAFF',
                              borderColor: isSelected ? GRADIENT_FROM : isMatched ? '#94A3B8' : '#E2E8F0',
                              color: '#334155',
                              opacity: isMatched ? 0.7 : 1,
                            }}
                          >
                            {pair.left}
                          </button>
                        )
                      })}
                    </div>
                    {/* Right column */}
                    <div className="flex flex-col gap-2">
                      {(shuffledMatchingRights.length > 0 ? shuffledMatchingRights : pairs).map(pair => {
                        const isMatched = Object.values(matchingMatches).includes(pair.id)
                        return (
                          <button
                            key={pair.id}
                            onClick={() => {
                              if (isMatched || !selectedLeftMatching) return
                              setMatchingMatches(prev => ({ ...prev, [selectedLeftMatching]: pair.id }))
                              setSelectedLeftMatching(null)
                            }}
                            disabled={isMatched}
                            className="p-3 rounded-xl border-2 text-left text-sm font-semibold transition-all"
                            style={{
                              background: isMatched ? '#F1F5F9' : selectedLeftMatching ? `${GRADIENT_FROM}10` : '#FAFAFF',
                              borderColor: isMatched ? '#94A3B8' : '#E2E8F0',
                              opacity: isMatched ? 0.6 : 1,
                            }}
                          >
                            {pair.right}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <button
                    onClick={handleMatchingValidate}
                    disabled={Object.keys(matchingMatches).length < pairs.length}
                    className="w-full mt-4 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40"
                    style={{ background: GRADIENT_FROM }}
                  >
                    Valider les associations
                  </button>
                </>
              )
            })()}

            {/* === UNSUPPORTED TYPE === */}
            {!['mcq', 'true_false', 'mcq_image', 'checkbox', 'highlight', 'fill_blank', 'ordering', 'matching'].includes(normalizedType) && (
              <div className="text-center py-8">
                <AlertCircle size={48} className="text-amber-500 mx-auto mb-3" />
                <p className="text-gray-600 mb-4">Type &quot;{qType}&quot; non supporte</p>
                <button
                  onClick={next}
                  className="px-6 py-3 rounded-xl text-white font-bold"
                  style={{ background: GRADIENT_FROM }}
                >
                  Passer cette question
                </button>
              </div>
            )}
          </>
        ) : (
          /* ============================================ */
          /* FEEDBACK SECTION                            */
          /* ============================================ */
          <FeedbackPanel
            q={q}
            normalizedType={normalizedType}
            isCorrect={isCorrect}
            pointsEarned={pointsEarned}
            selectedAnswer={selectedAnswer}
            selectedAnswers={selectedAnswers}
            fillBlankAnswers={fillBlankAnswers}
            orderingOrder={orderingOrder}
            matchingMatches={matchingMatches}
            current={current}
            total={questions.length}
            onNext={next}
          />
        )}
      </div>
    </div>
  )
}

// ============================================
// FEEDBACK PANEL (extracted for readability)
// ============================================

interface FeedbackPanelProps {
  q: DailyQuestion
  normalizedType: string
  isCorrect: boolean
  pointsEarned: number
  selectedAnswer: string | null
  selectedAnswers: string[]
  fillBlankAnswers: Record<string, string>
  orderingOrder: string[]
  matchingMatches: Record<string, string>
  current: number
  total: number
  onNext: () => void
}

function FeedbackPanel({
  q,
  normalizedType,
  isCorrect,
  pointsEarned,
  selectedAnswer,
  selectedAnswers,
  fillBlankAnswers,
  orderingOrder,
  matchingMatches,
  current,
  total,
  onNext,
}: FeedbackPanelProps) {

  // Show detailed feedback for types that benefit from it
  const renderDetailedFeedback = () => {
    switch (normalizedType) {
      case 'mcq':
      case 'mcq_image': {
        const opts = parseStandardOptions(q.options)
        return (
          <div className="flex flex-col gap-2 mb-4">
            {opts.map((opt, i) => {
              const isSelected = selectedAnswer === opt.id
              const optCorrect = opt.correct
              let bg = '#FAFAFF', border = '#E2E8F0', textColor = '#94A3B8'
              if (optCorrect) { bg = '#F0FDF4'; border = '#4ADE80'; textColor = '#334155' }
              else if (isSelected) { bg = '#FEF2F2'; border = '#FCA5A5'; textColor = '#334155' }
              return (
                <div key={opt.id} className="w-full p-3 rounded-2xl flex items-center gap-3"
                  style={{ background: bg, border: `2px solid ${border}` }}>
                  <span className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                    style={{
                      background: optCorrect ? '#22C55E' : isSelected ? '#EF4444' : '#E2E8F0',
                      color: optCorrect || isSelected ? 'white' : '#64748B',
                    }}>
                    {optCorrect ? '\u2713' : isSelected ? '\u2717' : String.fromCharCode(65 + i)}
                  </span>
                  <span className="flex-1 font-semibold text-sm" style={{ color: textColor }}>{opt.text}</span>
                </div>
              )
            })}
          </div>
        )
      }

      case 'checkbox': {
        const opts = parseStandardOptions(q.options)
        return (
          <div className="flex flex-col gap-2 mb-4">
            {opts.map(opt => {
              const isSelected = selectedAnswers.includes(opt.id)
              const optCorrect = opt.correct
              let bg = '#FAFAFF', border = '#E2E8F0', textColor = '#94A3B8'
              if (optCorrect) { bg = '#F0FDF4'; border = '#4ADE80'; textColor = '#334155' }
              else if (isSelected) { bg = '#FEF2F2'; border = '#FCA5A5'; textColor = '#334155' }
              return (
                <div key={opt.id} className="w-full p-3 rounded-2xl flex items-center gap-3"
                  style={{ background: bg, border: `2px solid ${border}` }}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                    {optCorrect ? <CheckSquare size={22} className="text-emerald-500" />
                      : isSelected ? <X size={22} className="text-red-500" />
                      : <Square size={22} className="text-gray-300" />}
                  </span>
                  <span className="flex-1 font-semibold text-sm" style={{ color: textColor }}>{opt.text}</span>
                </div>
              )
            })}
          </div>
        )
      }

      case 'highlight': {
        const opts = parseStandardOptions(q.options)
        return (
          <div className="flex flex-col gap-2 mb-4">
            {opts.map(opt => {
              const isIntrus = !opt.correct
              const isSelected = selectedAnswers.includes(opt.id)
              let bg = '#F0FDF4', border = '#4ADE80', textColor = '#334155', textDeco = 'none'
              if (isIntrus) { bg = '#FEF2F2'; border = '#FCA5A5'; textDeco = 'line-through'; textColor = '#DC2626' }
              else if (isSelected) { bg = '#FEF2F2'; border = '#EF4444'; textColor = '#EF4444' }
              return (
                <div key={opt.id} className="w-full p-3 rounded-2xl flex items-center gap-3"
                  style={{ background: bg, border: `2px solid ${border}` }}>
                  <span className="flex-1 font-semibold text-sm" style={{ color: textColor, textDecoration: textDeco }}>
                    {opt.text}
                  </span>
                  {isIntrus && <span className="text-xs font-bold text-rose-500">INTRUS</span>}
                </div>
              )
            })}
          </div>
        )
      }

      case 'fill_blank': {
        const opts = parseFillBlankOptions(q.options)
        if (!opts) return null
        return (
          <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 mb-4 space-y-3">
            {opts.blanks.map((blank, idx) => {
              const answer = fillBlankAnswers[blank.id] || ''
              const correct = answer.toLowerCase().trim() === blank.correctAnswer.toLowerCase().trim() ||
                (blank.alternatives?.some(a => a.toLowerCase().trim() === answer.toLowerCase().trim()) ?? false)
              return (
                <div key={blank.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm text-gray-600 font-medium">
                    {opts.blanks.length > 1 ? `Blanc ${idx + 1}:` : 'Reponse:'}
                  </span>
                  <span className="px-3 py-1.5 rounded-xl border-2 text-sm font-semibold"
                    style={{
                      borderColor: correct ? '#4ADE80' : '#FCA5A5',
                      background: correct ? '#F0FDF4' : '#FEF2F2',
                      color: correct ? '#16A34A' : '#DC2626',
                    }}>
                    {answer || '(vide)'}
                  </span>
                  {!correct && (
                    <span className="text-xs text-emerald-600 font-medium">&rarr; {blank.correctAnswer}</span>
                  )}
                </div>
              )
            })}
          </div>
        )
      }

      case 'ordering': {
        const opts = parseOrderingOptions(q.options)
        return (
          <div className="flex flex-col gap-2 mb-4">
            {orderingOrder.map((itemId, index) => {
              const item = opts.find(o => o.id === itemId)
              if (!item) return null
              const isCorrectPos = item.correctPosition === index + 1
              return (
                <div key={itemId} className="flex items-center gap-2 p-3 rounded-2xl border-2 transition-all"
                  style={{
                    background: isCorrectPos ? '#F0FDF4' : '#FEF2F2',
                    borderColor: isCorrectPos ? '#4ADE80' : '#FCA5A5',
                  }}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: isCorrectPos ? '#22C55E' : '#EF4444' }}>
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-gray-700">{item.text}</span>
                  {!isCorrectPos && <span className="text-xs text-emerald-600">&rarr; Pos. {item.correctPosition}</span>}
                </div>
              )
            })}
          </div>
        )
      }

      case 'matching': {
        const pairs = parseMatchingOptions(q.options)
        return (
          <div className="flex flex-col gap-2 mb-4">
            {pairs.map(pair => {
              const matchedRightId = matchingMatches[pair.id]
              const matchedRight = pairs.find(p => p.id === matchedRightId)
              const correct = matchedRightId === pair.id
              return (
                <div key={pair.id} className="flex items-center gap-2 p-3 rounded-2xl border-2"
                  style={{
                    background: correct ? '#F0FDF4' : '#FEF2F2',
                    borderColor: correct ? '#4ADE80' : '#FCA5A5',
                  }}>
                  <span className="text-sm font-semibold text-gray-700">{pair.left}</span>
                  <span className="text-gray-400 mx-1">&rarr;</span>
                  <span className="text-sm font-semibold" style={{ color: correct ? '#16A34A' : '#DC2626' }}>
                    {matchedRight?.right || '?'}
                  </span>
                  {!correct && <span className="text-xs text-emerald-600 ml-auto">&rarr; {pair.right}</span>}
                </div>
              )
            })}
          </div>
        )
      }

      default:
        return null
    }
  }

  return (
    <div>
      {/* Detailed answer review */}
      {renderDetailedFeedback()}

      {/* Feedback card */}
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
            {isCorrect ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          </div>
          <div>
            <span
              className={`text-lg font-bold ${
                isCorrect ? 'text-emerald-800' : 'text-red-800'
              }`}
            >
              {isCorrect ? 'Exact !' : 'Incorrect'}
            </span>
            {pointsEarned > 0 && (
              <span className="ml-2 text-sm text-emerald-600">+{pointsEarned} pts</span>
            )}
          </div>
        </div>
        <p className="text-sm text-gray-700 leading-relaxed mb-4">
          {isCorrect ? q.feedback_correct : q.feedback_incorrect}
        </p>
        <button
          onClick={onNext}
          className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
        >
          {current < total - 1 ? 'Suivant' : 'Voir mon score'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
