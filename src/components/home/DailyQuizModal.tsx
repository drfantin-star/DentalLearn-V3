'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
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
import NewsModal from '@/components/news/NewsModal'
import PostVictoryPushPrompt from '@/components/push/PostVictoryPushPrompt'
import CaseStudyQuestion from '@/components/questions/CaseStudyQuestion'
import FillBlankSentence from '@/components/questions/FillBlankSentence'
import { parseCaseStudyData } from '@/lib/questions/parseCaseStudyData'
import LeaderboardModal from '@/components/leaderboard/LeaderboardModal'

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
  news_synthesis_id?: string | null
  news_source_title?: string | null
}

interface DailyQuizModalProps {
  userId: string
  onClose: () => void
  onComplete: (score: number, totalPoints: number) => void
}

interface MatchingPairAssignment {
  leftKey: string
  rightId: string
  pairIndex: number
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

// NEW format only (post-migration 20260527e).
// Shape : { pairs: [{left, rightId}], options: [{id, text}], correctAnswers: ["i-id"] }.
// Tout payload OLD déclenche un warn explicite et retourne null (la question ne s'affiche pas).
function parseMatchingData(options: unknown, questionId?: string): ParsedMatchingData | null {
  if (!options) return null
  let opts = options
  if (typeof options === 'string') {
    try { opts = JSON.parse(options) } catch { return null }
  }
  if (typeof opts !== 'object' || opts === null) return null
  const o = opts as Record<string, unknown>

  if (!Array.isArray(o.pairs) || !Array.isArray(o.options) || !Array.isArray(o.correctAnswers)) {
    console.warn(
      '[matching] Legacy OLD format detected for question',
      questionId ?? '<unknown>',
      '— should not happen after migration 20260527e'
    )
    return null
  }

  const pairs = o.pairs as { left: string; rightId: string }[]
  const rightOptions = o.options as { id: string; text: string }[]
  const correctAnswers = o.correctAnswers as string[]

  return {
    leftItems: pairs.map((p, i) => ({
      index: i,
      left: p.left,
      correctRightId: p.rightId,
    })),
    rightOptions,
    correctAnswers,
  }
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

// Palette cyclique pour les paires associées en matching (badge numéroté + halo).
// Toutes les classes sont littérales pour que Tailwind JIT les détecte.
// Contraste (P-fix) : le libelle passe en text-white pour ne jamais etre dans la
// meme famille de teinte que le fond translucide. L'identite de la paire reste
// portee par bg + border + badge (numerote) colores.
const MATCHING_PAIR_COLORS = [
  { bg: 'bg-violet-500/15',  border: 'border-violet-500',  text: 'text-white',  badge: 'bg-violet-500' },
  { bg: 'bg-emerald-500/15', border: 'border-emerald-500', text: 'text-white', badge: 'bg-emerald-500' },
  { bg: 'bg-amber-500/15',   border: 'border-amber-500',   text: 'text-white',   badge: 'bg-amber-500' },
  { bg: 'bg-pink-500/15',    border: 'border-pink-500',    text: 'text-white',    badge: 'bg-pink-500' },
  { bg: 'bg-cyan-500/15',    border: 'border-cyan-500',    text: 'text-white',    badge: 'bg-cyan-500' },
  { bg: 'bg-orange-500/15',  border: 'border-orange-500',  text: 'text-white',  badge: 'bg-orange-500' },
]

function colorForPairIndex(pairIndex: number) {
  return MATCHING_PAIR_COLORS[(pairIndex - 1) % MATCHING_PAIR_COLORS.length]
}

function nextPairIndex(matches: MatchingPairAssignment[]): number {
  return matches.length > 0 ? Math.max(...matches.map(m => m.pairIndex)) + 1 : 1
}

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
  const [showLeaderboard, setShowLeaderboard] = useState(false)

  // Source news (carte « titre · Voir l'article ») — meme mecanique que le
  // quizz par theme : ouvre NewsModal sur la cle news_synthesis_id.
  const [articleNewsId, setArticleNewsId] = useState<string | null>(null)

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

  // Matching state — array preserves association order so we can attribute
  // a stable monotonic pairIndex (badge number + color) to each match.
  const [matchingMatches, setMatchingMatches] = useState<MatchingPairAssignment[]>([])
  const [selectedLeftMatching, setSelectedLeftMatching] = useState<string | null>(null)
  const [shuffledMatchingRights, setShuffledMatchingRights] = useState<MatchingRightOption[]>([])

  // Ref to keep matchingMatches fresh for the timeout handler (avoids stale closure)
  const matchingMatchesRef = useRef<MatchingPairAssignment[]>([])
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
      const data = parseMatchingData(q.options, q.id)
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
    setMatchingMatches([])
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

    // For matching, parseMatchingData handles both DB formats: old `{pairs:[{id,left,right}]}`
    // and new `{pairs:[{left,rightId}], options:[{id,text}]}`. Matches store rightOption.id.
    if (q.question_type === 'matching') {
      const data = parseMatchingData(q.options, q.id)
      if (data && data.leftItems.length > 0) {
        const lookup = new Map(matchingMatchesRef.current.map(m => [m.leftKey, m.rightId]))
        const correctCount = data.leftItems.filter(li => lookup.get(li.left) === li.correctRightId).length
        const ratio = correctCount / data.leftItems.length
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

  // Case study — le composant <CaseStudyQuestion> remonte le choix ; le scoring
  // reste ici. useCallback stable (deps métier, hors timer) pour éviter de
  // re-rendre / dégeler le composant mémoïsé à chaque tick du chrono.
  const handleCaseStudySelect = useCallback((choiceId: string) => {
    const q = questions[current]
    if (!q) return
    const parsed = parseCaseStudyData(q.options)
    if (!parsed) return
    const subQ = parsed.questions[caseStudyCurrentQ]
    if (!subQ) return
    if (showFeedback || caseStudyAnswers[subQ.id]) return

    setCaseStudyAnswers({ ...caseStudyAnswers, [subQ.id]: choiceId })

    const isLastSubQ = caseStudyCurrentQ >= parsed.questions.length - 1
    if (!isLastSubQ) return // l'avance de sous-question est pilotée par le composant

    const choice = subQ.choices.find(c => c.id === choiceId)
    const correct = !!choice?.correct
    setIsCorrect(correct)
    setPointsEarned(correct ? q.points : 0)
    if (correct) { setScore(s => s + 1); setTotalPoints(p => p + q.points) }
    setShowFeedback(true)
  }, [questions, current, caseStudyCurrentQ, caseStudyAnswers, showFeedback])

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
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
        <div className="glass-panel w-full max-w-sm mx-4 rounded-3xl p-8 text-center">
          <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto mb-4" />
          <p className="text-white/70 font-medium">Chargement du quiz...</p>
        </div>
      </div>
    )
  }

  if (error || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
        <div className="glass-panel w-full max-w-sm rounded-3xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-white/40 mx-auto mb-4" />
          <p className="text-white font-semibold mb-2">
            {error || 'Aucune question disponible'}
          </p>
          <p className="text-white/50 text-sm mb-6">
            Revenez plus tard ou contactez le support.
          </p>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-sm bg-white/10 text-white transition-premium hover:bg-white/20"
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
      <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
        <Confetti active={true} />
        <div className="glass-panel w-full max-w-sm rounded-3xl p-6 text-center relative overflow-hidden">

          <div className="relative z-10">
            {/* Trophée */}
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl flex items-center justify-center bg-gradient-to-br from-primary to-accent">
              <Trophy size={36} className="text-white" />
            </div>

            {/* Titre */}
            <h2 className="text-2xl font-bold mb-1 text-white">
              {isPerfect ? 'Parfait !' : finalScore >= 7 ? 'Bravo !' : 'Bien joué !'}
            </h2>
            <p className="text-sm mb-5 text-white/50">Quiz du jour terminé</p>

            {/* Score card */}
            <div className="rounded-2xl p-5 mb-3 text-center bg-gradient-to-br from-primary to-accent">
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
              onClick={() => setShowLeaderboard(true)}
              disabled={saving}
              className="w-full py-3.5 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin mx-auto" />
              ) : (
                "Voir le classement"
              )}
            </button>

            {/* Prompt post-victoire push (auto-gaté, mobile only, une fois) */}
            <PostVictoryPushPrompt />
          </div>
        </div>
      </div>

      {/* Classement hebdo par-dessus l'écran de résultat. z-[60] pour passer
          au-dessus du z-50 de l'écran de fin. À la fermeture : onComplete
          démonte le flux quiz et rafraîchit la home (stats/streak/classement). */}
      {showLeaderboard && (
        <div className="relative z-[60]">
          <LeaderboardModal
            open={showLeaderboard}
            onClose={() => onComplete(finalScore, totalPoints + bonusPoints)}
            userId={userId}
          />
        </div>
      )}
      </>
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

  // case_study : choix sélectionné de la sous-question courante (STRUCTURED +
  // LEGACY_ARRAY gérés par le composant partagé).
  const caseStudyParsed = q.question_type === 'case_study' ? parseCaseStudyData(q.options) : null
  const caseStudySubQId = caseStudyParsed?.questions[caseStudyCurrentQ]?.id ?? ''
  const caseStudySelectedId = caseStudyAnswers[caseStudySubQId] ?? null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0F0F0F]">
      {/* Top bar */}
      <div className="flex-shrink-0">
        <div className="h-1.5 bg-white/10">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="px-4 py-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-white">
              {current + 1}/{questions.length}
            </span>
            <div
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                timeLeft <= 10
                  ? 'bg-red-900/40 text-red-400'
                  : timeLeft <= 30
                    ? 'bg-amber-900/40 text-amber-400'
                    : 'bg-white/10 text-white/70'
              }`}
            >
              <Clock size={12} />
              {timeLeft}s
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-accent">
              {totalPoints} pts
            </span>
            <button
              onClick={onClose}
              className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-premium"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Question content - scrollable */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Formation tag */}
        {q.formation_title && (
          <div className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium mb-3 bg-primary/30 text-violet-400">
            {q.formation_title}
          </div>
        )}

        {/* Type badge */}
        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold mb-3 ml-1 bg-white/10 text-white/60">
          {typeLabels[qType] || qType.toUpperCase()}
        </span>

        {/* Source news — carte « titre · Voir l'article » (reutilise le meme
            pattern que ThemeQuizModal ; ouvre NewsModal sur news_synthesis_id). */}
        {q.news_source_title && (
          <div className="mb-4 rounded-xl glass-card px-3 py-2.5 flex items-start gap-2.5">
            <span aria-hidden className="mt-0.5">📄</span>
            <div className="flex-1 min-w-0">
              <p className="text-white/85 text-sm font-medium leading-snug">{q.news_source_title}</p>
              {q.news_synthesis_id && (
                <button
                  type="button"
                  onClick={() => setArticleNewsId(q.news_synthesis_id!)}
                  className="mt-1 text-accent text-xs font-semibold hover:underline transition-premium"
                >
                  Voir l&apos;article
                </button>
              )}
            </div>
          </div>
        )}

        {/* Layout wrapper — side by side on desktop when image present */}
        <div className={q.image_url ? "flex flex-col md:flex-row md:gap-8 md:items-start" : ""}>
          {/* Image — left side on desktop */}
          {q.image_url && (
            <div className="w-full md:w-1/2 md:max-w-lg md:sticky md:top-4 mb-4 md:mb-0 shrink-0">
              <img src={q.image_url} alt="Question" className="w-full rounded-xl max-h-[50vh] md:max-h-[60vh] object-contain" />
            </div>
          )}

          {/* Question + Options — right side on desktop when image present */}
          <div className={q.image_url ? "w-full md:w-1/2" : ""}>
            {/* Question text — fill_blank : slots inline visibles (composant
                partage) au lieu du token « ________ » noye dans la phrase. */}
            {normalizedType === 'fill_blank' ? (
              <h3 className="text-lg font-bold text-white leading-relaxed mb-6">
                <FillBlankSentence
                  questionText={q.question_text}
                  blanks={parseFillBlankOptions(q.options)?.blanks ?? []}
                  answers={fillBlankAnswers}
                  showFeedback={showFeedback}
                  onClearBlank={id => setFillBlankAnswers(prev => { const n = { ...prev }; delete n[id]; return n })}
                />
              </h3>
            ) : (
              <h3 className="text-lg font-bold text-white leading-snug mb-6">
                {q.question_text}
              </h3>
            )}

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
                        className={`w-full p-3.5 rounded-2xl text-left transition-premium flex items-center gap-3 border-2 ${isSelected ? 'bg-primary/20 border-primary' : 'bg-white/[0.07] border-white/15'}`}
                        style={{ cursor: selectedAnswer ? 'default' : 'pointer' }}
                      >
                        <span
                          className={`w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0 ${isSelected ? 'bg-primary text-white' : 'bg-white/10 text-white/60'}`}
                        >
                          {String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1 font-semibold text-sm text-white">{opt.text}</span>
                      </button>
                    )
                  })}
                </div>
              )
            })()}

            {/* === TRUE_FALSE === */}
            {/* P2 : neutre (gris) avant reponse — pas de vert/rouge ni d'icone
                ✓/✗ tant que l'user n'a pas repondu (le detail colore s'affiche
                ensuite dans le FeedbackPanel). Aligne sur le quizz de sequence. */}
            {normalizedType === 'true_false' && (() => {
              const opts = parseStandardOptions(q.options)
              // If options are standard format with id/text/correct, render as buttons
              if (opts.length >= 2) {
                return (
                  <div className="grid grid-cols-2 gap-4">
                    {opts.map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => handleSingleAnswer(opt.id)}
                        disabled={selectedAnswer !== null}
                        className="h-24 rounded-2xl border-2 border-white/15 bg-white/[0.07] flex items-center justify-center hover:scale-[1.02] transition-premium active:scale-95"
                      >
                        <span className="text-lg font-black text-white">{opt.text}</span>
                      </button>
                    ))}
                  </div>
                )
              }
              // Fallback: VRAI/FAUX buttons for { correct_answer } format
              return (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleSingleAnswer('true')}
                    disabled={selectedAnswer !== null}
                    className="h-24 rounded-2xl border-2 border-white/15 bg-white/[0.07] flex items-center justify-center hover:scale-[1.02] transition-premium active:scale-95"
                  >
                    <span className="text-lg font-black text-white">VRAI</span>
                  </button>
                  <button
                    onClick={() => handleSingleAnswer('false')}
                    disabled={selectedAnswer !== null}
                    className="h-24 rounded-2xl border-2 border-white/15 bg-white/[0.07] flex items-center justify-center hover:scale-[1.02] transition-premium active:scale-95"
                  >
                    <span className="text-lg font-black text-white">FAUX</span>
                  </button>
                </div>
              )
            })()}

            {/* === CASE STUDY (STRUCTURED + LEGACY_ARRAY) === */}
            {q.question_type === 'case_study' && (
              <CaseStudyQuestion
                options={q.options}
                showFeedback={showFeedback}
                selectedChoiceId={caseStudySelectedId}
                onSelectChoice={handleCaseStudySelect}
                currentSubQ={caseStudyCurrentQ}
                onSubQChange={setCaseStudyCurrentQ}
              />
            )}

            {/* === CHECKBOX === */}
            {normalizedType === 'checkbox' && (() => {
              const opts = parseStandardOptions(q.options)
              return (
                <>
                  <p className="text-xs text-blue-400 mb-3">Plusieurs reponses possibles — cochez puis validez</p>
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
                          className={`w-full p-3.5 rounded-2xl text-left transition-premium flex items-center gap-3 border-2 ${isSelected ? 'bg-primary/20 border-primary' : 'bg-white/[0.07] border-white/15'}`}
                        >
                          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                            {isSelected
                              ? <CheckSquare size={24} className="text-primary" />
                              : <Square size={24} className="text-white/40" />
                            }
                          </span>
                          <span className="flex-1 font-semibold text-sm text-white">{opt.text}</span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={handleCheckboxValidate}
                    disabled={selectedAnswers.length === 0}
                    className="w-full mt-4 py-3.5 rounded-2xl font-bold text-sm text-white bg-primary/60 hover:bg-primary/80 transition-premium disabled:opacity-40"
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
                  <p className="text-xs text-rose-400 mb-3">Barrez les intrus en les selectionnant</p>
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
                          className={`w-full p-3.5 rounded-2xl text-left transition-premium flex items-center gap-3 border-2 ${isSelected ? 'bg-red-500/15 border-red-400' : 'bg-white/[0.07] border-white/15'}`}
                        >
                          <span className={`flex-1 font-semibold text-sm ${isSelected ? 'text-red-300 line-through' : 'text-white'}`}>
                            {opt.text}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    onClick={handleHighlightValidate}
                    disabled={selectedAnswers.length === 0}
                    className="w-full mt-4 py-3.5 rounded-2xl font-bold text-sm text-white bg-primary/60 hover:bg-primary/80 transition-premium disabled:opacity-40"
                  >
                    Valider mes choix
                  </button>
                </>
              )
            })()}

            {/* === FILL_BLANK === */}
            {normalizedType === 'fill_blank' && (() => {
              const opts = parseFillBlankOptions(q.options)
              if (!opts) return <p className="text-white/55">Format de question non supporte</p>

              const hasWordBank = opts.wordBank && opts.wordBank.length > 0
              const usedWords = Object.values(fillBlankAnswers)
              const allFilled = opts.blanks.every(b => fillBlankAnswers[b.id])

              return (
                <>
                  <p className="text-xs text-white/50 mb-3">
                    {hasWordBank ? 'Selectionne un mot de la banque pour chaque trou' : 'Tape ta reponse'}
                  </p>

                  {/* Cas saisie libre (aucune question en base aujourd'hui) : inputs.
                      Le cas wordBank saisit directement dans les slots inline du
                      texte de la question (composant FillBlankSentence). */}
                  {!hasWordBank && (
                    <div className="p-4 rounded-2xl border-2 border-white/15 bg-white/[0.04] mb-4 space-y-3">
                      {opts.blanks.map((blank, idx) => (
                        <div key={blank.id} className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white/60">
                            {opts.blanks.length > 1 ? `Trou ${idx + 1}:` : 'Reponse:'}
                          </span>
                          <input
                            type="text"
                            value={fillBlankAnswers[blank.id] || ''}
                            onChange={e => setFillBlankAnswers(prev => ({ ...prev, [blank.id]: e.target.value }))}
                            placeholder="Tape ta reponse..."
                            className="flex-1 min-w-[150px] px-4 py-2 rounded-xl border-2 border-white/15 bg-white/[0.07] text-white text-sm font-semibold transition-premium outline-none focus:border-accent"
                          />
                        </div>
                      ))}
                    </div>
                  )}

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
                            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-premium ${isUsed ? 'bg-white/10 text-white/30 opacity-60' : 'bg-primary text-white hover:bg-primary/80'}`}
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
                    className="w-full py-3.5 rounded-2xl font-bold text-sm text-white bg-primary/60 hover:bg-primary/80 transition-premium disabled:opacity-40"
                  >
                    Valider {hasWordBank ? 'mes reponses' : 'ma reponse'}
                  </button>
                </>
              )
            })()}

            {/* === ORDERING === */}
            {normalizedType === 'ordering' && (() => {
              const opts = parseOrderingOptions(q.options)
              if (opts.length === 0) return <p className="text-white/55">Format de question non supporte</p>

              const moveItem = (from: number, to: number) => {
                if (to < 0 || to >= orderingOrder.length) return
                const newOrder = [...orderingOrder]
                const [moved] = newOrder.splice(from, 1)
                newOrder.splice(to, 0, moved)
                setOrderingOrder(newOrder)
              }

              return (
                <>
                  <p className="text-xs text-amber-400 mb-3">Utilisez les fleches pour reordonner</p>
                  <div className="flex flex-col gap-2">
                    {orderingOrder.map((itemId, index) => {
                      const item = opts.find(o => o.id === itemId)
                      if (!item) return null
                      return (
                        <div
                          key={itemId}
                          className="flex items-center gap-2 p-3 rounded-2xl border-2 border-white/15 bg-white/[0.07] transition-premium"
                        >
                          <span
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white bg-primary"
                          >
                            {index + 1}
                          </span>
                          <span className="flex-1 text-sm font-semibold text-white">{item.text}</span>
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveItem(index, index - 1)}
                              disabled={index === 0}
                              className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                            >
                              <ChevronUp size={16} className="text-white/60" />
                            </button>
                            <button
                              onClick={() => moveItem(index, index + 1)}
                              disabled={index === orderingOrder.length - 1}
                              className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                            >
                              <ChevronDown size={16} className="text-white/60" />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <button
                    onClick={handleOrderingValidate}
                    className="w-full mt-4 py-3.5 rounded-2xl font-bold text-sm text-white bg-primary/60 hover:bg-primary/80 transition-premium"
                  >
                    Valider l&apos;ordre
                  </button>
                </>
              )
            })()}

            {/* === MATCHING === */}
            {q.question_type === 'matching' && (() => {
              const data = parseMatchingData(q.options, q.id)
              if (!data || data.leftItems.length === 0) {
                return <p className="text-white/55">Format de question non supporte</p>
              }
              const rights = shuffledMatchingRights.length > 0 ? shuffledMatchingRights : data.rightOptions
              const matchByLeft = new Map(matchingMatches.map(m => [m.leftKey, m]))
              const matchByRight = new Map(matchingMatches.map(m => [m.rightId, m]))
              const allMatched = matchingMatches.length >= data.leftItems.length

              return (
                <div className="space-y-4">
                  <p className="text-xs font-medium text-white/50">
                    Cliquez sur un élément gauche puis son correspondant à droite. Re-cliquez sur un élément déjà associé pour défaire la paire.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {/* Colonne gauche */}
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">À associer</p>
                      {data.leftItems.map((li) => {
                        const match = matchByLeft.get(li.left)
                        const color = match ? colorForPairIndex(match.pairIndex) : null
                        const isSelected = selectedLeftMatching === li.left
                        const isCorrectMatch = showFeedback && match && match.rightId === li.correctRightId
                        const isWrongMatch = showFeedback && match && match.rightId !== li.correctRightId
                        const usePairColor = !!match && !showFeedback
                        // Etat -> classes tokens (jamais de hex). En pairing, les
                        // classes de paire (color.*) portent bg/bordure/texte.
                        const stateClasses = usePairColor && color
                          ? `${color.bg} ${color.border} ${color.text}`
                          : isCorrectMatch ? 'bg-emerald-500/15 border-emerald-400 text-white'
                          : isWrongMatch ? 'bg-red-500/15 border-red-400 text-white'
                          : isSelected ? 'bg-indigo-500/25 border-indigo-500 text-white'
                          : 'bg-white/[0.07] border-white/15 text-white'

                        return (
                          <button key={li.left}
                            onClick={() => {
                              if (showFeedback) return
                              if (match) {
                                setMatchingMatches(prev => prev.filter(m => m.leftKey !== li.left))
                                if (isSelected) setSelectedLeftMatching(null)
                              } else {
                                setSelectedLeftMatching(isSelected ? null : li.left)
                              }
                            }}
                            disabled={showFeedback}
                            className={`w-full p-2.5 rounded-xl text-left text-xs font-bold transition-premium flex items-center gap-3 border-2 ${stateClasses}`}>
                            {match && (
                              <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${color?.badge ?? 'bg-gray-500'}`}>
                                {match.pairIndex}
                              </span>
                            )}
                            <span className="flex-1">{li.left}</span>
                          </button>
                        )
                      })}
                    </div>
                    {/* Colonne droite */}
                    <div className="flex flex-col gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-white/40">Options</p>
                      {rights.map((ro) => {
                        const match = matchByRight.get(ro.id)
                        const color = match ? colorForPairIndex(match.pairIndex) : null
                        const usePairColor = !!match && !showFeedback
                        // Etat « selectionnable » (gauche choisi, droite libre) : highlight accent.
                        const isSelectable = !usePairColor && !match && !!selectedLeftMatching
                        const stateClasses = usePairColor && color
                          ? `${color.bg} ${color.border} ${color.text}`
                          : match ? 'bg-white/10 border-white/20 text-white/70'
                          : isSelectable ? 'bg-accent/15 border-accent text-white'
                          : 'bg-white/[0.07] border-white/15 text-white'

                        return (
                          <button key={ro.id}
                            onClick={() => {
                              if (showFeedback || !selectedLeftMatching || match) return
                              setMatchingMatches(prev => [...prev, { leftKey: selectedLeftMatching, rightId: ro.id, pairIndex: nextPairIndex(prev) }])
                              setSelectedLeftMatching(null)
                            }}
                            disabled={showFeedback || !!match}
                            className={`w-full p-2.5 rounded-xl text-left text-xs font-semibold transition-premium flex items-center gap-3 border-2 ${stateClasses}`}>
                            {match && (
                              <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold text-white ${color?.badge ?? 'bg-gray-500'}`}>
                                {match.pairIndex}
                              </span>
                            )}
                            <span className="flex-1">{ro.text}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Bouton valider */}
                  {!showFeedback && (
                    <button
                      onClick={() => {
                        const correct = data.leftItems.every(li => matchByLeft.get(li.left)?.rightId === li.correctRightId)
                        const points = correct ? q.points : 0
                        setIsCorrect(correct)
                        setPointsEarned(points)
                        if (correct) { setScore(s => s + 1); setTotalPoints(p => p + q.points) }
                        setShowFeedback(true)
                      }}
                      disabled={!allMatched}
                      className={`w-full py-3 rounded-2xl font-bold text-sm text-white disabled:opacity-40 transition-premium ${allMatched ? 'bg-gradient-to-br from-indigo-500 to-accent' : 'bg-white/10'}`}>
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
                <p className="text-white/55 mb-4">Type &quot;{qType}&quot; non supporte</p>
                <button
                  onClick={next}
                  className="px-6 py-3 rounded-xl text-white font-bold bg-primary"
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
      <NewsModal newsId={articleNewsId} onClose={() => setArticleNewsId(null)} />
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
  orderingOrder: string[]
  matchingMatches: MatchingPairAssignment[]
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
  orderingOrder,
  matchingMatches,
  current,
  total,
  onNext,
}: FeedbackPanelProps) {

  // Detail des reponses (tokens uniquement). Le cas fill_blank n'est plus
  // affiche ici : les slots inline du texte de question (FillBlankSentence)
  // montrent deja le resultat en feedback.
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
              return (
                <div key={opt.id} className={`w-full p-3 rounded-2xl flex items-center gap-3 border-2 ${optCorrect ? 'bg-emerald-500/15 border-emerald-400' : isSelected ? 'bg-red-500/15 border-red-400' : 'bg-white/[0.04] border-white/10'}`}>
                  <span className={`w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 text-white ${optCorrect ? 'bg-emerald-500' : isSelected ? 'bg-red-500' : 'bg-white/10'}`}>
                    {optCorrect ? '\u2713' : isSelected ? '\u2717' : String.fromCharCode(65 + i)}
                  </span>
                  <span className={`flex-1 font-semibold text-sm ${optCorrect || isSelected ? 'text-white' : 'text-white/70'}`}>{opt.text}</span>
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
              return (
                <div key={opt.id} className={`w-full p-3 rounded-2xl flex items-center gap-3 border-2 ${optCorrect ? 'bg-emerald-500/15 border-emerald-400' : isSelected ? 'bg-red-500/15 border-red-400' : 'bg-white/[0.04] border-white/10'}`}>
                  <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                    {optCorrect ? <CheckSquare size={22} className="text-emerald-400" />
                      : isSelected ? <X size={22} className="text-red-400" />
                      : <Square size={22} className="text-white/30" />}
                  </span>
                  <span className={`flex-1 font-semibold text-sm ${optCorrect || isSelected ? 'text-white' : 'text-white/70'}`}>{opt.text}</span>
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
              const wrong = isIntrus || isSelected
              return (
                <div key={opt.id} className={`w-full p-3 rounded-2xl flex items-center gap-3 border-2 ${wrong ? 'bg-red-500/15 border-red-400' : 'bg-emerald-500/15 border-emerald-400'}`}>
                  <span className={`flex-1 font-semibold text-sm ${isIntrus ? 'text-red-300 line-through' : isSelected ? 'text-red-300' : 'text-emerald-300'}`}>
                    {opt.text}
                  </span>
                  {isIntrus && <span className="text-xs font-bold text-rose-400">INTRUS</span>}
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
                <div key={itemId} className={`flex items-center gap-2 p-3 rounded-2xl border-2 transition-premium ${isCorrectPos ? 'bg-emerald-500/15 border-emerald-400' : 'bg-red-500/15 border-red-400'}`}>
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${isCorrectPos ? 'bg-emerald-500' : 'bg-red-500'}`}>
                    {index + 1}
                  </span>
                  <span className="flex-1 text-sm font-semibold text-white">{item.text}</span>
                  {!isCorrectPos && <span className="text-xs text-emerald-400">&rarr; Pos. {item.correctPosition}</span>}
                </div>
              )
            })}
          </div>
        )
      }

      case 'matching': {
        const data = parseMatchingData(q.options, q.id)
        if (!data) return null
        const rightLookup = new Map(data.rightOptions.map(r => [r.id, r.text]))
        const matchByLeft = new Map(matchingMatches.map(m => [m.leftKey, m.rightId]))

        return (
          <div className="flex flex-col gap-2 mb-4">
            {data.leftItems.map((li) => {
              const userAnswerId = matchByLeft.get(li.left)
              const correctText = rightLookup.get(li.correctRightId) ?? li.correctRightId
              const isCorrectMatch = !!userAnswerId && userAnswerId === li.correctRightId
              // Correction : on n'affiche PLUS la reponse fausse choisie. Deux
              // conteneurs de meme taille (flex-1, meme police) : gauche = terme
              // (fond emerald si juste, red sinon), droit = UNIQUEMENT la bonne
              // reponse. La bonne reponse doit dominer, jamais la fausse.
              return (
                <div key={li.left} className="flex items-stretch gap-2">
                  <span className={`flex-1 p-3 rounded-2xl border-2 text-sm font-semibold flex items-center ${isCorrectMatch ? 'bg-emerald-500/15 border-emerald-400 text-white' : 'bg-red-500/15 border-red-400 text-white'}`}>
                    {li.left}
                  </span>
                  <span aria-hidden className="self-center text-white/40 shrink-0">&rarr;</span>
                  <span className="flex-1 p-3 rounded-2xl border-2 bg-emerald-500/15 border-emerald-400 text-white text-sm font-semibold flex items-center">
                    {correctText}
                  </span>
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
        className={`rounded-2xl p-5 border ${isCorrect ? 'bg-emerald-500/10 border-emerald-500' : 'bg-red-500/10 border-red-500'}`}
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
              <span className="ml-2 text-sm text-emerald-400">+{pointsEarned} pts</span>
            )}
          </div>
        </div>
        <p className="text-sm leading-relaxed mb-4 text-white">
          {isCorrect ? q.feedback_correct : q.feedback_incorrect}
        </p>
        <button
          onClick={onNext}
          className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-premium bg-white text-[#0F0F0F] hover:bg-white/90"
        >
          {current < total - 1 ? 'Suivant' : 'Voir mon score'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
