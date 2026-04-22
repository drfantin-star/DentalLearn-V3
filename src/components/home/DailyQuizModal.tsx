'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
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
import Confetti from '@/components/Confetti'

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

interface MatchingRightOption {
  id: string
  text: string
}

interface ParsedMatchingData {
  leftItems: { index: number; left: string; correctRightId: string }[]
  rightOptions: MatchingRightOption[]
  correctAnswers: string[]
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
  recommended_time_seconds?: number
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

function parseMatchingData(options: unknown): ParsedMatchingData | null {
  if (!options) return null
  let opts = options
  if (typeof options === 'string') {
    try { opts = JSON.parse(options) } catch { return null }
  }
  if (typeof opts !== 'object' || opts === null) return null
  const o = opts as Record<string, unknown>

  // New DB format: { pairs: [{left, rightId}], options: [{id, text}], correctAnswers: [...] }
  if ('pairs' in o && Array.isArray(o.pairs) && 'options' in o && Array.isArray(o.options)) {
    const pairs = o.pairs as { left: string; rightId?: string }[]
    const rightOptions = o.options as { id: string; text: string }[]
    const correctAnswers = ('correctAnswers' in o && Array.isArray(o.correctAnswers))
      ? o.correctAnswers as string[]
      : pairs.map((p, i) => `${i + 1}-${p.rightId}`)
    return {
      leftItems: pairs.map((p, i) => ({
        index: i,
        left: p.left,
        correctRightId: p.rightId || '',
      })),
      rightOptions,
      correctAnswers,
    }
  }

  // Old format: { pairs: [{id?, left, right}] }
  // id may be missing — generate stable alphabetical IDs (A, B, C…) as fallback
  if ('pairs' in o && Array.isArray(o.pairs)) {
    const pairs = o.pairs as Partial<MatchingPair>[]
    return {
      leftItems: pairs.map((p, i) => ({
        index: i,
        left: p.left || '',
        correctRightId: p.id || String.fromCharCode(65 + i),
      })),
      rightOptions: pairs.map((p, i) => ({
        id: p.id || String.fromCharCode(65 + i),
        text: p.right || '',
      })),
      correctAnswers: pairs.map((p, i) =>
        `${i + 1}-${p.id || String.fromCharCode(65 + i)}`
      ),
    }
  }

  return null
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
  case_study: 'Cas clinique',
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
  const router = useRouter()
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

  // Case study state
  const [caseStudyAnswers, setCaseStudyAnswers] = useState<Record<string, string>>({})
  const [caseStudyCurrentQ, setCaseStudyCurrentQ] = useState(0)

  // Matching state
  const [matchingMatches, setMatchingMatches] = useState<Record<string, string>>({})
  const [selectedLeftMatching, setSelectedLeftMatching] = useState<string | null>(null)
  const [shuffledMatchingRights, setShuffledMatchingRights] = useState<MatchingRightOption[]>([])

  // Ref to keep matchingMatches fresh for the timeout handler (avoids stale closure)
  const matchingMatchesRef = useRef<Record<string, string>>({})
  useEffect(() => { matchingMatchesRef.current = matchingMatches }, [matchingMatches])

  // Timer per question
  const [timeLeft, setTimeLeft] = useState(60)

  useEffect(() => {
    fetchQuestions()
  }, [])

  // Initialize timer from question's recommended_time_seconds (fallback 60s)
  useEffect(() => {
    if (questions.length === 0) return
    const q = questions[current]
    if (!q) return
    setTimeLeft(q.recommended_time_seconds || 60)
  }, [current, questions])

  // Question timer countdown
  useEffect(() => {
    if (loading || finished || showFeedback || questions.length === 0) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
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
      const data = parseMatchingData(q.options)
      if (data && data.rightOptions.length > 0) {
        let shuffled = shuffleArray([...data.rightOptions])
        let attempts = 0
        while (shuffled.every((opt, i) => opt.id === data.rightOptions[i].id) && attempts < 10) {
          shuffled = shuffleArray([...data.rightOptions])
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
    setCaseStudyAnswers({})
    setCaseStudyCurrentQ(0)
    setMatchingMatches({})
    setSelectedLeftMatching(null)
    setShuffledMatchingRights([])
    setShowFeedback(false)
    setIsCorrect(false)
    setPointsEarned(0)
    // timeLeft is set by the timer init effect when `current` changes
  }

  // When timer reaches 0, validate matching with partial credit or mark wrong
  useEffect(() => {
    if (timeLeft !== 0 || showFeedback || loading || finished || questions.length === 0) return

    const q = questions[current]
    if (!q) return

    // For matching questions, validate partial associations using pair.left/pair.right
    if (q.question_type === 'matching') {
      let pairs: Array<{ left: string; right: string }> = []
      try {
        const raw = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
        if (raw?.pairs) pairs = raw.pairs
      } catch { /* ignore */ }
      if (pairs.length > 0) {
        const currentMatches = matchingMatchesRef.current
        const correctCount = pairs.filter(p => currentMatches[p.left] === p.right).length
        const ratio = correctCount / pairs.length
        const points = Math.round(ratio * q.points)

        setIsCorrect(ratio === 1)
        setPointsEarned(points)
        if (ratio === 1) setScore(s => s + 1)
        setTotalPoints(p => p + points)
        setShowFeedback(true)
        return
      }
    }

    // Default: mark as incorrect with 0 points
    setIsCorrect(false)
    setPointsEarned(0)
    setShowFeedback(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft])

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

  // ============================================
  // NAVIGATION
  // ============================================

  const next = async () => {
    if (current < questions.length - 1) {
      resetQuestionState()
      setTimeLeft(questions[current + 1]?.recommended_time_seconds || 60)
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

      // Sauvegarder les résultats du quiz
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

      // Mettre à jour le streak APRÈS la sauvegarde
      await fetch('/api/streaks/update', { method: 'POST' })

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
        <div className="w-full max-w-sm rounded-3xl p-8 text-center" style={{ background: '#1a1a1a' }}>
          <Loader2 className="w-10 h-10 animate-spin text-[#2D1B96] mx-auto mb-4" />
          <p className="font-medium" style={{ color: '#a3a3a3' }}>Chargement du quiz...</p>
        </div>
      </div>
    )
  }

  if (error || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-gray-900/70 backdrop-blur-sm">
        <div className="w-full max-w-sm rounded-3xl p-6 text-center" style={{ background: '#1a1a1a' }}>
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="font-medium mb-2" style={{ color: '#e5e5e5' }}>
            {error || 'Aucune question disponible'}
          </p>
          <p className="text-sm mb-6" style={{ color: '#a3a3a3' }}>
            Revenez plus tard ou contactez le support.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-sm transition-colors" style={{ background: '#242424', color: '#e5e5e5' }}
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
        <Confetti active={true} />
        <div className="w-full max-w-sm rounded-3xl p-6 text-center relative overflow-hidden" style={{ background: '#1a1a1a' }}>

          <div className="relative z-10">
            {/* Trophée */}
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #2D1B96, #00D1C1)' }}>
              <Trophy size={36} className="text-white" />
            </div>

            {/* Titre */}
            <h2 className="text-2xl font-bold mb-1" style={{ color: '#e5e5e5' }}>
              {isPerfect ? 'Parfait !' : finalScore >= 7 ? 'Bravo !' : 'Bien joué !'}
            </h2>
            <p className="text-sm mb-5" style={{ color: '#a3a3a3' }}>Quiz du jour terminé</p>

            {/* Score card */}
            <div className="rounded-2xl p-5 mb-3 text-center"
              style={{ background: 'linear-gradient(135deg, #2D1B96, #00D1C1)' }}>
              <div className="text-5xl font-black text-white mb-1">
                {finalScore}<span className="text-2xl font-bold opacity-70">/{questions.length}</span>
              </div>
              <div className="text-sm text-white/70">bonnes réponses</div>

              <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">⭐</span>
                  <p className="text-xs text-white/60">Points gagnés</p>
                  <p className="text-xl font-black text-white">+{totalPoints}</p>
                </div>
                {isPerfect && (
                  <div className="bg-white/20 rounded-xl px-3 py-2 text-center">
                    <p className="text-xs text-white/70">Bonus</p>
                    <p className="text-sm font-black text-white">+{bonusPoints} 🎯</p>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={async () => {
                await onComplete(finalScore, totalPoints + bonusPoints)
                router.push('/profil')
              }}
              disabled={saving}
              className="w-full py-3.5 bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                "Voir mes stats →"
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

  // Normalize type names (API may use 'qcm' instead of 'mcq', 'case_study' behaves like 'mcq')
  const normalizedType = qType === 'qcm' ? 'mcq' : qType === 'qcm_image' ? 'mcq_image' : qType

  // Détecter le sous-format case_study
  const isCaseStudyStructured = q.question_type === 'case_study' && (() => {
    try {
      const raw = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
      return raw && !Array.isArray(raw) && 'context' in raw && 'questions' in raw
    } catch { return false }
  })()
  const isCaseStudyLegacy = q.question_type === 'case_study' && !isCaseStudyStructured
  // Legacy = options est un tableau MCQ standard, question_text contient "CONTEXTE : ... QUESTION : ..."

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#0F0F0F' }}>
      {/* Top bar */}
      <div className="flex-shrink-0">
        <div className="h-1.5" style={{ background: '#242424' }}>
          <div
            className="h-full bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#1a1a1a', borderBottom: '0.5px solid #2a2a2a' }}>
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold" style={{ color: '#e5e5e5' }}>
              {current + 1}/{questions.length}
            </span>
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                timeLeft <= 10
                  ? 'bg-red-900/40 text-red-400'
                  : timeLeft <= 30
                    ? 'bg-amber-900/40 text-amber-400'
                    : 'text-[#a3a3a3]'
              }`}
              style={timeLeft > 30 ? { background: '#242424' } : undefined}
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
              className="p-2 rounded-full transition-colors" style={{ color: '#6b7280' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#242424')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
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
          <div className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium mb-3" style={{ background: 'rgba(45,27,150,0.3)', color: '#a78bfa' }}>
            {q.formation_title}
          </div>
        )}

        {/* Type badge */}
        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold mb-3 ml-1" style={{ background: '#242424', color: '#a3a3a3' }}>
          {typeLabels[qType] || qType.toUpperCase()}
        </span>

        {/* Layout wrapper — side by side on desktop when image present */}
        <div className={q.image_url ? "flex flex-col md:flex-row md:gap-8 md:items-start" : ""}>
          {/* Image — left side on desktop */}
          {q.image_url && (
            <div className="w-full md:w-1/2 md:max-w-lg md:sticky md:top-4 mb-4 md:mb-0 shrink-0">
              <img src={q.image_url} alt="Question" className="w-full rounded-xl border border-gray-200 max-h-[50vh] md:max-h-[60vh] object-contain" />
            </div>
          )}

          {/* Question + Options — right side on desktop when image present */}
          <div className={q.image_url ? "w-full md:w-1/2" : ""}>
            {/* Question text */}
            <h3 className="text-lg font-bold leading-snug mb-6" style={{ color: '#e5e5e5' }}>
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
                        <span className="flex-1 font-semibold text-sm" style={{ color: '#e5e5e5' }}>{opt.text}</span>
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
                          className="h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-all active:scale-95"
                          style={isVrai
                            ? { background: 'rgba(6,78,59,0.3)', borderColor: '#059669' }
                            : { background: 'rgba(69,10,10,0.3)', borderColor: '#ef4444' }}
                        >
                          {isVrai ? (
                            <CheckCircle2 size={28} className="text-emerald-600" />
                          ) : (
                            <X size={28} className="text-red-600" />
                          )}
                          <span className={`text-lg font-black ${isVrai ? 'text-emerald-400' : 'text-red-400'}`}>
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
                    className="h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-all active:scale-95" style={{ background: 'rgba(6,78,59,0.3)', borderColor: '#059669' }}
                  >
                    <CheckCircle2 size={28} className="text-emerald-600" />
                    <span className="text-lg font-black text-emerald-400">VRAI</span>
                  </button>
                  <button
                    onClick={() => handleSingleAnswer('false')}
                    disabled={selectedAnswer !== null}
                    className="h-24 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 hover:scale-[1.02] transition-all active:scale-95" style={{ background: 'rgba(69,10,10,0.3)', borderColor: '#ef4444' }}
                  >
                    <X size={28} className="text-red-600" />
                    <span className="text-lg font-black text-red-400">FAUX</span>
                  </button>
                </div>
              )
            })()}

            {/* === CASE STUDY LEGACY (Axe 1) — options = tableau MCQ, contexte dans question_text === */}
            {isCaseStudyLegacy && (() => {
              const opts = (() => {
                try {
                  const raw = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                  return Array.isArray(raw) ? raw as Array<{id: string; text: string; correct: boolean}> : []
                } catch { return [] }
              })()

              return (
                <div className="flex flex-col gap-2.5">
                  {opts.map((opt, i) => {
                    const isSelected = selectedAnswer === opt.id
                    const isCorrectOpt = opt.correct
                    let bg = '#242424', border = '#333', textColor = '#e5e5e5'
                    if (isSelected && !showFeedback) { bg = 'rgba(45,27,150,0.25)'; border = '#2D1B96' }
                    if (showFeedback) {
                      if (isCorrectOpt) { bg = '#F0FDF4'; border = '#4ADE80' }
                      else if (isSelected && !isCorrectOpt) { bg = '#FEF2F2'; border = '#FCA5A5' }
                      else { textColor = '#94A3B8' }
                    }
                    return (
                      <button
                        key={opt.id}
                        disabled={showFeedback}
                        onClick={() => {
                          if (showFeedback) return
                          setSelectedAnswer(opt.id)
                          const correct = opt.correct
                          setIsCorrect(correct)
                          if (correct) { setScore(s => s + 1); setTotalPoints(p => p + q.points) }
                          setShowFeedback(true)
                        }}
                        className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                        style={{ background: bg, border: `2px solid ${border}`, cursor: showFeedback ? 'default' : 'pointer' }}
                      >
                        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                          style={{ background: showFeedback && isCorrectOpt ? '#BBF7D0' : showFeedback && isSelected && !isCorrectOpt ? '#FECACA' : '#EEF2FF', color: showFeedback && isCorrectOpt ? '#166534' : showFeedback && isSelected && !isCorrectOpt ? '#991B1B' : '#4F46E5' }}>
                          {showFeedback && isCorrectOpt ? '✓' : showFeedback && isSelected && !isCorrectOpt ? '✗' : String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1 font-semibold text-sm" style={{ color: textColor }}>{opt.text}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {/* === CASE_STUDY === */}
            {isCaseStudyStructured && (() => {
              // Parser les options case_study
              let caseOpts: { context?: { history?: string; chief_complaint?: string }; questions?: Array<{ id: string; text: string; choices: Array<{ id: string; text: string; correct: boolean }>; feedback?: string; points?: number }> } | null = null
              try {
                const raw = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                if (raw && 'context' in raw && 'questions' in raw) caseOpts = raw
              } catch { caseOpts = null }

              if (!caseOpts) return <p className="text-gray-400 text-sm">Cas clinique non disponible</p>

              const subQ = caseOpts.questions?.[caseStudyCurrentQ]
              if (!subQ) return null

              return (
                <div className="space-y-4">
                  {/* Contexte clinique — affiché uniquement si plusieurs sous-questions */}
                  {caseOpts.questions && caseOpts.questions.length > 1 && caseOpts.context?.history && (
                    <div className="rounded-2xl p-4" style={{ background: '#0f172a', border: '1px solid #1e3a5f' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#60a5fa' }}>Contexte clinique</p>
                      <p className="text-sm leading-relaxed" style={{ color: '#e5e5e5' }}>{caseOpts.context.history}</p>
                      {caseOpts.context?.chief_complaint && <p className="text-sm mt-1 italic" style={{ color: '#a3a3a3' }}>{caseOpts.context.chief_complaint}</p>}
                    </div>
                  )}

                  {caseOpts.questions && caseOpts.questions.length > 1 && (
                    <p className="text-[11px] text-gray-400">Question {caseStudyCurrentQ + 1} / {caseOpts.questions.length}</p>
                  )}
                  <p className="font-bold text-[15px] leading-snug" style={{ color: '#e5e5e5' }}>{subQ.text}</p>

                  <div className="flex flex-col gap-2.5">
                    {subQ.choices.map((choice, i) => {
                      const isSelected = caseStudyAnswers[subQ.id] === choice.id
                      const isCorrectChoice = choice.correct
                      let bg = '#242424', border = '#333', textColor = '#e5e5e5'
                      if (isSelected && !showFeedback) { bg = 'rgba(45,27,150,0.25)'; border = '#2D1B96' }
                      if (showFeedback) {
                        if (isCorrectChoice) { bg = '#F0FDF4'; border = '#4ADE80' }
                        else if (isSelected && !isCorrectChoice) { bg = '#FEF2F2'; border = '#FCA5A5' }
                        else { textColor = '#94A3B8' }
                      }
                      return (
                        <button
                          key={choice.id}
                          disabled={showFeedback || !!caseStudyAnswers[subQ.id]}
                          onClick={() => {
                            if (showFeedback || caseStudyAnswers[subQ.id]) return
                            const newAnswers = { ...caseStudyAnswers, [subQ.id]: choice.id }
                            setCaseStudyAnswers(newAnswers)
                            const isLastSubQ = caseStudyCurrentQ >= (caseOpts!.questions!.length - 1)
                            if (isLastSubQ) {
                              const correct = choice.correct
                              setIsCorrect(correct)
                              setPointsEarned(correct ? q.points : 0)
                              if (correct) { setScore(s => s + 1); setTotalPoints(p => p + q.points) }
                              setShowFeedback(true)
                            } else {
                              setTimeout(() => setCaseStudyCurrentQ(c => c + 1), 600)
                            }
                          }}
                          className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                          style={{ background: bg, border: `2px solid ${border}`, cursor: showFeedback ? 'default' : 'pointer' }}
                        >
                          <span className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
                            style={{ background: showFeedback && isCorrectChoice ? '#BBF7D0' : showFeedback && isSelected && !isCorrectChoice ? '#FECACA' : '#EEF2FF', color: showFeedback && isCorrectChoice ? '#166534' : showFeedback && isSelected && !isCorrectChoice ? '#991B1B' : '#4F46E5' }}>
                            {showFeedback && isCorrectChoice ? '\u2713' : showFeedback && isSelected && !isCorrectChoice ? '\u2717' : String.fromCharCode(65 + i)}
                          </span>
                          <span className="flex-1 font-semibold text-sm" style={{ color: textColor }}>{choice.text}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })()}

            {/* === CHECKBOX === */}
            {normalizedType === 'checkbox' && (() => {
              const opts = parseStandardOptions(q.options)
              return (
                <>
                  <p className="text-xs mb-3" style={{ color: '#60a5fa' }}>Plusieurs reponses possibles — cochez puis validez</p>
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
                            background: isSelected ? 'rgba(45,27,150,0.25)' : '#242424',
                            border: `2px solid ${isSelected ? '#2D1B96' : '#333'}`,
                          }}
                        >
                          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                            {isSelected
                              ? <CheckSquare size={24} style={{ color: GRADIENT_FROM }} />
                              : <Square size={24} className="text-gray-400" />
                            }
                          </span>
                          <span className="flex-1 font-semibold text-sm" style={{ color: '#e5e5e5' }}>{opt.text}</span>
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
                  <p className="text-xs mb-3" style={{ color: '#fb7185' }}>Barrez les intrus en les selectionnant</p>
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
                            background: isSelected ? 'rgba(69,10,10,0.35)' : '#242424',
                            border: `2px solid ${isSelected ? '#ef4444' : '#333'}`,
                          }}
                        >
                          <span
                            className="flex-1 font-semibold text-sm"
                            style={{
                              color: isSelected ? '#f87171' : '#e5e5e5',
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

                  <div className="p-4 rounded-2xl border-2 mb-4 space-y-3" style={{ background: '#1a1a1a', borderColor: '#333' }}>
                    {opts.blanks.map((blank, idx) => {
                      const answer = fillBlankAnswers[blank.id]
                      return (
                        <div key={blank.id} className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium" style={{ color: '#a3a3a3' }}>
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
                                background: answer ? `${GRADIENT_FROM}30` : '#242424',
                                color: '#e5e5e5',
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
                              style={{ borderColor: '#333', background: '#242424', color: '#e5e5e5' }}
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
                          style={{ background: '#242424', borderColor: '#333' }}
                        >
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                            style={{ background: GRADIENT_FROM }}
                          >
                            {index + 1}
                          </span>
                          <span className="flex-1 text-sm font-semibold" style={{ color: '#e5e5e5' }}>{item.text}</span>
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveItem(index, index - 1)}
                              disabled={index === 0}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                            >
                              <ChevronUp size={16} style={{ color: '#a3a3a3' }} />
                            </button>
                            <button
                              onClick={() => moveItem(index, index + 1)}
                              disabled={index === orderingOrder.length - 1}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-30"
                            >
                              <ChevronDown size={16} style={{ color: '#a3a3a3' }} />
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
            {q.question_type === 'matching' && (() => {
              let pairs: Array<{ left: string; right: string }> = []
              try {
                const raw = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
                if (raw?.pairs) pairs = raw.pairs
              } catch { pairs = [] }

              const allMatched = pairs.length > 0 && pairs.every(p => matchingMatches[p.left])

              return (
                <div className="space-y-4">
                  <p className="text-xs font-medium" style={{ color: '#818cf8' }}>
                    Cliquez sur un élément gauche puis son correspondant à droite
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Colonne gauche */}
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>À associer</p>
                      {pairs.map((pair) => {
                        const isSelected = selectedLeftMatching === pair.left
                        const isMatched = !!matchingMatches[pair.left]
                        const isCorrectMatch = showFeedback && matchingMatches[pair.left] === pair.right
                        const isWrongMatch = showFeedback && isMatched && matchingMatches[pair.left] !== pair.right
                        return (
                          <button key={pair.left}
                            onClick={() => { if (showFeedback || isMatched) return; setSelectedLeftMatching(isSelected ? null : pair.left) }}
                            disabled={showFeedback || isMatched}
                            className="w-full p-2.5 rounded-xl text-left text-xs font-bold transition-all"
                            style={{
                              background: isCorrectMatch ? '#052e16' : isWrongMatch ? '#450a0a' : isSelected ? 'rgba(99,102,241,0.25)' : isMatched ? '#2a2a2a' : '#242424',
                              border: `2px solid ${isCorrectMatch ? '#4ADE80' : isWrongMatch ? '#FCA5A5' : isSelected ? '#6366F1' : isMatched ? '#444' : '#333'}`,
                              color: '#e5e5e5'
                            }}>
                            {pair.left}
                          </button>
                        )
                      })}
                    </div>
                    {/* Colonne droite */}
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: '#6b7280' }}>Options</p>
                      {pairs.map((pair) => {
                        const isAssignedTo = Object.entries(matchingMatches).find(([, v]) => v === pair.right)
                        return (
                          <button key={pair.right}
                            onClick={() => {
                              if (showFeedback || !selectedLeftMatching || !!isAssignedTo) return
                              setMatchingMatches(prev => ({ ...prev, [selectedLeftMatching]: pair.right }))
                              setSelectedLeftMatching(null)
                            }}
                            disabled={showFeedback || !!isAssignedTo}
                            className="w-full p-2.5 rounded-xl text-left text-xs font-semibold transition-all"
                            style={{
                              background: isAssignedTo ? '#2a2a2a' : selectedLeftMatching ? 'rgba(0,209,193,0.15)' : '#242424',
                              border: `2px solid ${isAssignedTo ? '#444' : selectedLeftMatching ? '#00D1C1' : '#333'}`,
                              color: '#e5e5e5'
                            }}>
                            {pair.right}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Bouton valider */}
                  {!showFeedback && (
                    <button
                      onClick={() => {
                        const correct = pairs.every(p => matchingMatches[p.left] === p.right)
                        const points = correct ? q.points : 0
                        setIsCorrect(correct)
                        setPointsEarned(points)
                        if (correct) { setScore(s => s + 1); setTotalPoints(p => p + q.points) }
                        setShowFeedback(true)
                      }}
                      disabled={!allMatched}
                      className="w-full py-3 rounded-2xl font-bold text-sm text-white disabled:opacity-40 transition-all"
                      style={{ background: allMatched ? 'linear-gradient(135deg, #6366F1, #00D1C1)' : '#333' }}>
                      Valider les associations
                    </button>
                  )}
                </div>
              )
            })()}

            {/* === UNSUPPORTED TYPE === */}
            {!['mcq', 'true_false', 'mcq_image', 'checkbox', 'highlight', 'fill_blank', 'ordering', 'matching', 'case_study'].includes(normalizedType) && (
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
          </div>{/* close question+options wrapper */}
        </div>{/* close flex layout wrapper */}
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
              let bg = '#1a1a1a', border = '#333', textColor = '#6b7280'
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
              let bg = '#1a1a1a', border = '#333', textColor = '#6b7280'
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
          <div className="p-4 rounded-2xl border-2 mb-4 space-y-3" style={{ background: '#1a1a1a', borderColor: '#333' }}>
            {opts.blanks.map((blank, idx) => {
              const answer = fillBlankAnswers[blank.id] || ''
              const correct = answer.toLowerCase().trim() === blank.correctAnswer.toLowerCase().trim() ||
                (blank.alternatives?.some(a => a.toLowerCase().trim() === answer.toLowerCase().trim()) ?? false)
              return (
                <div key={blank.id} className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium" style={{ color: '#a3a3a3' }}>
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
                  <span className="flex-1 text-sm font-semibold" style={{ color: '#e5e5e5' }}>{item.text}</span>
                  {!isCorrectPos && <span className="text-xs text-emerald-600">&rarr; Pos. {item.correctPosition}</span>}
                </div>
              )
            })}
          </div>
        )
      }

      case 'matching': {
        let pairs: Array<{ left: string; right: string }> = []
        try {
          const raw = typeof q.options === 'string' ? JSON.parse(q.options) : q.options
          if (raw?.pairs) pairs = raw.pairs
        } catch { pairs = [] }

        return (
          <div className="flex flex-col gap-2 mb-4">
            {pairs.map((pair) => {
              const userAnswer = matchingMatches[pair.left]
              const isCorrectMatch = userAnswer === pair.right
              return (
                <div key={pair.left} className="flex items-center gap-2 p-3 rounded-2xl border-2"
                  style={{
                    background: isCorrectMatch ? '#F0FDF4' : '#FEF2F2',
                    borderColor: isCorrectMatch ? '#4ADE80' : '#FCA5A5',
                  }}>
                  <span className="text-sm font-semibold" style={{ color: '#e5e5e5' }}>{pair.left}</span>
                  <span className="mx-1" style={{ color: '#6b7280' }}>&rarr;</span>
                  <span className="text-sm font-semibold" style={{ color: isCorrectMatch ? '#16A34A' : '#DC2626' }}>
                    {userAnswer || '?'}
                  </span>
                  {!isCorrectMatch && (
                    <span className="text-xs text-emerald-600 ml-auto">&rarr; {pair.right}</span>
                  )}
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
        className="rounded-2xl p-5"
        style={isCorrect
          ? { background: 'rgba(6,78,59,0.25)', border: '1px solid #059669' }
          : { background: 'rgba(69,10,10,0.25)', border: '1px solid #ef4444' }}
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
                isCorrect ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {isCorrect ? 'Exact !' : 'Incorrect'}
            </span>
            {pointsEarned > 0 && (
              <span className="ml-2 text-sm text-emerald-600">+{pointsEarned} pts</span>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed mb-4" style={{ color: '#e5e5e5' }}>
          {isCorrect ? q.feedback_correct : q.feedback_incorrect}
        </p>
        <button
          onClick={onNext}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors" style={{ background: '#e5e5e5', color: '#0F0F0F' }}
        >
          {current < total - 1 ? 'Suivant' : 'Voir mon score'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
