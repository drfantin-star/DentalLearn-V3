'use client'

import React, { useState, useMemo, useEffect } from 'react'
import {
  ChevronLeft,
  Check,
  X,
  Download,
  Lightbulb,
  Loader2,
  Square,
  CheckSquare,
  AlertCircle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import {
  useSequenceQuestions,
  useSubmitSequenceResult,
  type Sequence,
  type Question,
} from '@/lib/supabase'
import AudioPlayer from './AudioPlayer'

// ============================================
// TYPES (basés sur types/questions.ts)
// ============================================

interface SequencePlayerProps {
  sequence: Sequence
  categoryGradient: { from: string; to: string }
  onBack: () => void
  onComplete: (score: number, totalPoints: number) => void
}

type PlayerStep = 'video' | 'quiz' | 'pdf' | 'results'

interface StandardOption {
  id: string
  text: string
  correct: boolean
}

interface FillBlankBlank {
  id: string
  correctAnswer: string
  alternatives?: string[]
  position?: number
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

interface CaseStudyContext {
  patient: string
  chief_complaint: string
  history: string
  clinical_image?: string
}

interface CaseStudySubQuestion {
  id: string
  order: number
  text: string
  choices: StandardOption[]
  feedback: string
  points: number
}

interface CaseStudyOptions {
  context: CaseStudyContext
  questions: CaseStudySubQuestion[]
}

// ============================================
// PARSERS
// ============================================

function parseStandardOptions(options: unknown): StandardOption[] {
  if (!options) return []
  if (Array.isArray(options)) return options as StandardOption[]
  if (typeof options === 'string') {
    try {
      const parsed = JSON.parse(options)
      if (Array.isArray(parsed)) return parsed as StandardOption[]
    } catch (e) { /* ignore */ }
  }
  return []
}

function parseFillBlankOptions(options: unknown): FillBlankOptions | null {
  if (!options) return null
  
  let opts = options
  if (typeof options === 'string') {
    try {
      opts = JSON.parse(options)
    } catch (e) { return null }
  }
  
  if (typeof opts === 'object' && opts !== null) {
    const o = opts as Record<string, unknown>
    // Format avec ou sans wordBank
    if ('blanks' in o && Array.isArray(o.blanks)) {
      return {
        blanks: o.blanks as FillBlankOptions['blanks'],
        wordBank: 'wordBank' in o && Array.isArray(o.wordBank) ? o.wordBank as string[] : []
      }
    }
  }
  return null
}

function parseOrderingOptions(options: unknown): OrderingOption[] {
  if (!options) return []
  
  let opts = options
  if (typeof options === 'string') {
    try { opts = JSON.parse(options) } catch (e) { return [] }
  }
  
  // Format: { ordering: [...] } ou { items: [...] }
  if (typeof opts === 'object' && !Array.isArray(opts) && opts !== null) {
    const o = opts as Record<string, unknown>
    if ('ordering' in o && Array.isArray(o.ordering)) return o.ordering as OrderingOption[]
    if ('items' in o && Array.isArray(o.items)) return o.items as OrderingOption[]
  }
  
  // Format: [{ id, text, correctPosition }, ...]
  if (Array.isArray(opts) && opts.length > 0 && 'correctPosition' in opts[0]) {
    return opts as OrderingOption[]
  }
  return []
}

function parseMatchingOptions(options: unknown): MatchingPair[] {
  if (!options) return []
  
  let opts = options
  if (typeof options === 'string') {
    try { opts = JSON.parse(options) } catch (e) { return [] }
  }
  
  if (typeof opts === 'object' && !Array.isArray(opts) && opts !== null) {
    const o = opts as Record<string, unknown>
    if ('pairs' in o && Array.isArray(o.pairs)) return o.pairs as MatchingPair[]
  }
  return []
}

// Helpers pour drag_drop (peut être matching ou ordering)
function isDragDropMatching(options: unknown): boolean {
  if (!options) return false
  let opts = options
  if (typeof options === 'string') {
    try { opts = JSON.parse(options) } catch (e) { return false }
  }
  if (typeof opts === 'object' && !Array.isArray(opts) && opts !== null) {
    const o = opts as Record<string, unknown>
    // Format matching: { pairs: [...] } sans ordering
    if ('pairs' in o && Array.isArray(o.pairs) && !('ordering' in o)) return true
  }
  return false
}

function isDragDropOrdering(options: unknown): boolean {
  if (!options) return false
  let opts = options
  if (typeof options === 'string') {
    try { opts = JSON.parse(options) } catch (e) { return false }
  }
  if (typeof opts === 'object' && !Array.isArray(opts) && opts !== null) {
    const o = opts as Record<string, unknown>
    // Format ordering: { ordering: [...] } ou { items: [...] }
    if ('ordering' in o && Array.isArray(o.ordering)) return true
    if ('items' in o && Array.isArray(o.items)) return true
  }
  // Ou tableau avec correctPosition
  if (Array.isArray(opts) && opts.length > 0 && 'correctPosition' in opts[0]) return true
  return false
}

function parseCaseStudyOptions(options: unknown): CaseStudyOptions | null {
  if (!options) return null
  
  let opts = options
  if (typeof options === 'string') {
    try { opts = JSON.parse(options) } catch (e) { return null }
  }
  
  if (typeof opts === 'object' && opts !== null) {
    const o = opts as Record<string, unknown>
    if ('context' in o && 'questions' in o) {
      return o as unknown as CaseStudyOptions
    }
  }
  return null
}

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function SequencePlayer({
  sequence,
  categoryGradient,
  onBack,
  onComplete,
}: SequencePlayerProps) {
  const { questions, loading: loadingQuestions, error } = useSequenceQuestions(sequence.id)
  const { submit: submitResult, loading: submitting } = useSubmitSequenceResult()

  const hasMedia = !!sequence.course_media_url
  const hasPdf = !!sequence.infographic_url
  const mediaType = sequence.course_media_type || 'video' // défaut vidéo
  const isAudio = mediaType === 'audio'

  // Mode démo : toujours afficher les 3 étapes pour tester l'interface
  const demoMode = true // Mettre à false en production
  const showVideo = demoMode || hasMedia
  const showPdf = demoMode || hasPdf

  const [playerStep, setPlayerStep] = useState<PlayerStep>(showVideo ? 'video' : 'quiz')
  const [courseCompleted, setCourseCompleted] = useState(false)
  const [courseProgress, setCourseProgress] = useState(0)
  const [currentQ, setCurrentQ] = useState(0)
  
  // États pour différents types
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  const [fillBlankAnswers, setFillBlankAnswers] = useState<Record<string, string>>({})
  const [orderingOrder, setOrderingOrder] = useState<string[]>([])
  const [matchingMatches, setMatchingMatches] = useState<Record<string, string>>({})
  const [caseStudyAnswers, setCaseStudyAnswers] = useState<Record<string, string>>({})
  const [caseStudyCurrentQ, setCaseStudyCurrentQ] = useState(0)
  const [selectedLeftMatching, setSelectedLeftMatching] = useState<string | null>(null)
  const [shuffledMatchingRights, setShuffledMatchingRights] = useState<MatchingPair[]>([])
  
  const [showFeedback, setShowFeedback] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [totalPoints, setTotalPoints] = useState(0)
  const [showOverlay, setShowOverlay] = useState(false)
  const [overlayData, setOverlayData] = useState<{
    isCorrect: boolean
    points: number
    feedback: string
    isLast: boolean
  } | null>(null)
  const [answersLog, setAnswersLog] = useState<{
    question_id: string
    selected_option: string
    is_correct: boolean
    points_earned: number
  }[]>([])
  const [startTime] = useState(Date.now())

  const steps: PlayerStep[] = useMemo(() => {
    const s: PlayerStep[] = []
    if (showVideo) s.push('video')
    s.push('quiz')
    if (showPdf) s.push('pdf')
    return s
  }, [showVideo, showPdf])

  const currentStepIdx = steps.indexOf(playerStep === 'results' ? 'quiz' : playerStep)
  const currentQuestion = questions[currentQ]

  // Fisher-Yates shuffle - mélange aléatoire fiable
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    return shuffled
  }

  // Vérifier si un tableau d'IDs est dans l'ordre correct (1, 2, 3, 4...)
  const isCorrectOrder = (order: string[], opts: OrderingOption[]): boolean => {
    return order.every((id, idx) => {
      const opt = opts.find(o => o.id === id)
      return opt?.correctPosition === idx + 1
    })
  }

  // Initialiser ordering - s'assurer que l'ordre initial n'est PAS la solution
  useEffect(() => {
    const isOrdering = currentQuestion?.question_type === 'ordering' || 
      (currentQuestion?.question_type === 'drag_drop' && isDragDropOrdering(currentQuestion.options))
    
    if (isOrdering && orderingOrder.length === 0) {
      const opts = parseOrderingOptions(currentQuestion.options)
      if (opts.length > 0) {
        let shuffled = shuffleArray(opts.map(o => o.id))
        // Re-mélanger si on tombe sur l'ordre correct (peu probable mais possible)
        let attempts = 0
        while (isCorrectOrder(shuffled, opts) && attempts < 10) {
          shuffled = shuffleArray(opts.map(o => o.id))
          attempts++
        }
        setOrderingOrder(shuffled)
      }
    }
  }, [currentQuestion, orderingOrder.length])

  // Initialiser matching - mélanger la colonne de droite
  useEffect(() => {
    const isMatching = currentQuestion?.question_type === 'matching' || 
      (currentQuestion?.question_type === 'drag_drop' && isDragDropMatching(currentQuestion.options))
    
    if (isMatching && shuffledMatchingRights.length === 0) {
      const pairs = parseMatchingOptions(currentQuestion.options)
      if (pairs.length > 0) {
        // Mélanger pour que les droites ne correspondent pas aux gauches
        let shuffled = shuffleArray([...pairs])
        // Re-mélanger si par hasard l'ordre est identique (id gauche = position droite)
        let attempts = 0
        while (shuffled.every((p, i) => p.id === pairs[i].id) && attempts < 10) {
          shuffled = shuffleArray([...pairs])
          attempts++
        }
        setShuffledMatchingRights(shuffled)
      }
    }
  }, [currentQuestion, shuffledMatchingRights.length])

  const resetQuestionState = () => {
    setSelectedAnswer(null)
    setSelectedAnswers([])
    setFillBlankAnswers({})
    setOrderingOrder([])
    setMatchingMatches({})
    setCaseStudyAnswers({})
    setCaseStudyCurrentQ(0)
    setSelectedLeftMatching(null)
    setShuffledMatchingRights([])
    setShowFeedback(false)
  }

  // ============================================
  // ÉVALUATION
  // ============================================

  const evaluateAndShowFeedback = (isCorrect: boolean, points: number, feedback: string) => {
    if (isCorrect) setCorrectCount(c => c + 1)
    setTotalPoints(p => p + points)
    setShowFeedback(true)
    setOverlayData({ isCorrect, points, feedback, isLast: currentQ === questions.length - 1 })
    setShowOverlay(true)
  }

  // MCQ / True-False / MCQ Image
  const handleSingleAnswer = (answerId: string) => {
    if (showFeedback || selectedAnswer) return
    setSelectedAnswer(answerId)

    const q = currentQuestion
    const opts = parseStandardOptions(q.options)
    const selected = opts.find(o => o.id === answerId)
    const isCorrect = selected?.correct || false
    const points = isCorrect ? q.points : 0

    setAnswersLog(prev => [...prev, { question_id: q.id, selected_option: answerId, is_correct: isCorrect, points_earned: points }])
    evaluateAndShowFeedback(isCorrect, points, isCorrect ? q.feedback_correct : q.feedback_incorrect)
  }

  // Checkbox
  const handleCheckboxValidate = () => {
    if (showFeedback || selectedAnswers.length === 0) return
    const q = currentQuestion
    const opts = parseStandardOptions(q.options)
    const correctIds = opts.filter(o => o.correct).map(o => o.id)
    
    const correctSelected = selectedAnswers.filter(a => correctIds.includes(a)).length
    const incorrectSelected = selectedAnswers.filter(a => !correctIds.includes(a)).length
    const score = Math.max(0, (correctSelected - incorrectSelected) / correctIds.length)
    const isCorrect = score === 1
    const points = Math.round(score * q.points)

    setAnswersLog(prev => [...prev, { question_id: q.id, selected_option: selectedAnswers.join(','), is_correct: isCorrect, points_earned: points }])
    evaluateAndShowFeedback(isCorrect, points, isCorrect ? q.feedback_correct : q.feedback_incorrect)
  }

  // Highlight (barrer les intrus)
  const handleHighlightValidate = () => {
    if (showFeedback || selectedAnswers.length === 0) return
    const q = currentQuestion
    const opts = parseStandardOptions(q.options)
    const intrusIds = opts.filter(o => !o.correct).map(o => o.id)

    const intrusBarred = selectedAnswers.filter(a => intrusIds.includes(a)).length
    const correctBarred = selectedAnswers.filter(a => !intrusIds.includes(a)).length
    const score = intrusIds.length > 0 ? Math.max(0, (intrusBarred - correctBarred) / intrusIds.length) : 0
    const isCorrect = score === 1
    const points = Math.round(score * q.points)

    setAnswersLog(prev => [...prev, { question_id: q.id, selected_option: selectedAnswers.join(','), is_correct: isCorrect, points_earned: points }])
    evaluateAndShowFeedback(isCorrect, points, isCorrect ? q.feedback_correct : q.feedback_incorrect)
  }

  // Fill Blank
  const handleFillBlankValidate = () => {
    const q = currentQuestion
    const opts = parseFillBlankOptions(q.options)
    if (!opts) return

    let correct = 0
    for (const blank of opts.blanks) {
      const userAnswer = (fillBlankAnswers[blank.id] || '').toLowerCase().trim()
      const correctAnswer = blank.correctAnswer.toLowerCase().trim()
      
      // Vérifier réponse exacte ou alternatives
      const alternatives = blank.alternatives?.map(a => a.toLowerCase().trim()) || []
      if (userAnswer === correctAnswer || alternatives.includes(userAnswer)) {
        correct++
      }
    }

    const score = opts.blanks.length > 0 ? correct / opts.blanks.length : 0
    const isCorrect = score === 1
    const points = Math.round(score * q.points)

    setAnswersLog(prev => [...prev, { question_id: q.id, selected_option: JSON.stringify(fillBlankAnswers), is_correct: isCorrect, points_earned: points }])
    evaluateAndShowFeedback(isCorrect, points, isCorrect ? q.feedback_correct : q.feedback_incorrect)
  }

  // Ordering
  const handleOrderingValidate = () => {
    const q = currentQuestion
    const opts = parseOrderingOptions(q.options)

    let correct = 0
    orderingOrder.forEach((itemId, index) => {
      const opt = opts.find(o => o.id === itemId)
      if (opt && opt.correctPosition === index + 1) correct++
    })

    const score = opts.length > 0 ? correct / opts.length : 0
    const isCorrect = score === 1
    const points = Math.round(score * q.points)

    setAnswersLog(prev => [...prev, { question_id: q.id, selected_option: orderingOrder.join(','), is_correct: isCorrect, points_earned: points }])
    evaluateAndShowFeedback(isCorrect, points, isCorrect ? q.feedback_correct : q.feedback_incorrect)
  }

  // Matching
  const handleMatchingValidate = () => {
    const q = currentQuestion
    const pairs = parseMatchingOptions(q.options)

    let correct = 0
    for (const pair of pairs) {
      if (matchingMatches[pair.id] === pair.id) correct++
    }

    const score = pairs.length > 0 ? correct / pairs.length : 0
    const isCorrect = score === 1
    const points = Math.round(score * q.points)

    setAnswersLog(prev => [...prev, { question_id: q.id, selected_option: JSON.stringify(matchingMatches), is_correct: isCorrect, points_earned: points }])
    evaluateAndShowFeedback(isCorrect, points, isCorrect ? q.feedback_correct : q.feedback_incorrect)
  }

  const nextQuestion = () => {
    setShowOverlay(false)
    resetQuestionState()

    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1)
    } else {
      setPlayerStep('results')
    }
  }

  const skipQuestion = () => {
    setAnswersLog(prev => [...prev, { question_id: currentQuestion.id, selected_option: 'skipped', is_correct: false, points_earned: 0 }])
    resetQuestionState()
    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1)
    } else {
      setPlayerStep('results')
    }
  }

  const finishSequence = async () => {
    try {
      await submitResult({
        sequenceId: sequence.id,
        score: Math.round((correctCount / questions.length) * 100),
        totalPoints,
        timeSpentSeconds: Math.round((Date.now() - startTime) / 1000),
        answers: answersLog,
      })
    } catch (err) {
      console.error('Erreur soumission:', err)
    }
    onComplete(correctCount, totalPoints)
  }

  const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0

  // ============================================
  // RENDU
  // ============================================

  if (loadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFF]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  if (error || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFF] p-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">{error?.message || 'Aucune question disponible'}</p>
          <button onClick={onBack} className="px-4 py-2 bg-gray-100 rounded-xl text-sm">Retour</button>
        </div>
      </div>
    )
  }

  const typeLabels: Record<string, string> = {
    mcq: 'QCM', true_false: 'Vrai/Faux', checkbox: 'Choix multiples',
    fill_blank: 'Compléter', highlight: 'Barrer les intrus', mcq_image: 'QCM Image',
    ordering: 'Ordonnancement', matching: 'Association', case_study: 'Cas clinique',
    drag_drop: 'Glisser-Déposer',
  }

  return (
    <div className="min-h-screen bg-[#FAFAFF] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-lg">
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <p className="flex-1 font-bold text-sm text-gray-800 truncate">{sequence.title}</p>
        <span className="font-bold text-[13px] text-amber-600">⭐ {totalPoints}</span>
      </div>

      {/* Stepper */}
      <div className="bg-white px-4 py-3 flex items-center justify-center gap-2">
        {steps.map((step, i) => {
          const isActive = (playerStep === 'results' ? 'quiz' : playerStep) === step
          const isDone = playerStep === 'results' || i < currentStepIdx
          const label = step === 'video' ? '🎧 Cours' : step === 'quiz' ? '📝 Quiz' : '📄 PDF'
          return (
            <div key={step} className="flex items-center gap-2">
              <div
                className="px-3.5 py-1.5 rounded-2xl text-xs font-semibold"
                style={{ background: isActive ? categoryGradient.from : isDone ? '#DCFCE7' : '#F1F5F9', color: isActive ? 'white' : isDone ? '#15803D' : '#94A3B8' }}
              >
                {isDone && !isActive ? '✓ ' : ''}{label}
              </div>
              {i < steps.length - 1 && <div className="w-5 h-0.5" style={{ background: isDone ? '#86EFAC' : '#E2E8F0' }} />}
            </div>
          )
        })}
      </div>

      {/* Contenu */}
      <div className="flex-1 p-4 overflow-auto pb-24">
        {/* COURS (VIDEO ou AUDIO) */}
        {playerStep === 'video' && (
          <div className="text-center py-6">
            {isAudio && sequence.course_media_url ? (
              /* ─── AudioPlayer ─── */
              <div className="mb-6">
                <AudioPlayer
                  src={sequence.course_media_url}
                  duration={sequence.course_duration_seconds || 0}
                  sequenceId={sequence.id}
                  onComplete={() => setCourseCompleted(true)}
                  onProgress={(percent) => setCourseProgress(percent)}
                  accentColor={categoryGradient.from}
                  accentColorSecondary={categoryGradient.to}
                />
              </div>
            ) : (
              /* ─── VideoPlayer (placeholder conservé pour réutilisation future) ─── */
              <div className="w-full aspect-video bg-gray-900 rounded-2xl flex items-center justify-center mb-6">
                <p className="text-white/60 text-sm">🎬 Lecteur vidéo</p>
              </div>
            )}

            <button
              onClick={() => setPlayerStep('quiz')}
              disabled={isAudio && !courseCompleted && !demoMode}
              className="w-full max-w-xs py-4 rounded-2xl font-bold text-white disabled:opacity-40 transition-opacity"
              style={{ background: categoryGradient.from }}
            >
              {isAudio && !courseCompleted && !demoMode
                ? `Écoutez le cours (${courseProgress}%)`
                : 'Passer au Quiz →'}
            </button>
          </div>
        )}

        {/* QUIZ */}
        {playerStep === 'quiz' && currentQuestion && (() => {
          const q = currentQuestion
          const qType = q.question_type

          return (
            <div>
              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-gray-500">Question {currentQ + 1}/{questions.length}</span>
                  <span className="text-xs text-gray-500">⭐ {totalPoints} pts</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ background: `linear-gradient(90deg, ${categoryGradient.from}, ${categoryGradient.to})`, width: `${((currentQ + 1) / questions.length) * 100}%` }} />
                </div>
              </div>

              {/* Type badge */}
              <span className="inline-block bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[11px] font-semibold mb-3">
                {typeLabels[qType] || qType.toUpperCase()}
              </span>

              {/* Image */}
              {q.image_url && (
                <div className="mb-4">
                  <img src={q.image_url} alt="Question" className="w-full rounded-xl border border-gray-200" />
                </div>
              )}

              {/* Question text */}
              <h2 className="text-[16px] font-bold text-gray-800 leading-relaxed mb-5">{q.question_text}</h2>

              {/* === MCQ / TRUE_FALSE / MCQ_IMAGE === */}
              {(qType === 'mcq' || qType === 'true_false' || qType === 'mcq_image' || qType === 'image') && (
                <div className="flex flex-col gap-2.5">
                  {parseStandardOptions(q.options).map((opt, i) => {
                    const isSelected = selectedAnswer === opt.id
                    const isCorrect = opt.correct
                    let bg = '#FAFAFF', border = '#E2E8F0', textColor = '#334155', badgeBg = '#E2E8F0', badgeColor = '#64748B'
                    
                    if (isSelected && !showFeedback) { bg = '#F1F5F9'; border = '#94A3B8'; badgeBg = '#475569'; badgeColor = 'white' }
                    if (showFeedback) {
                      if (isCorrect) { bg = '#F0FDF4'; border = '#4ADE80'; badgeBg = '#22C55E'; badgeColor = 'white' }
                      else if (isSelected) { bg = '#FEF2F2'; border = '#FCA5A5'; badgeBg = '#EF4444'; badgeColor = 'white' }
                      else { textColor = '#94A3B8' }
                    }
                    
                    return (
                      <button key={opt.id} onClick={() => handleSingleAnswer(opt.id)} disabled={showFeedback || selectedAnswer !== null}
                        className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                        style={{ background: bg, border: `2px solid ${border}`, cursor: showFeedback || selectedAnswer ? 'default' : 'pointer' }}>
                        {qType !== 'true_false' && (
                          <span className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0" style={{ background: badgeBg, color: badgeColor }}>
                            {showFeedback && isCorrect ? '✓' : showFeedback && isSelected && !isCorrect ? '✗' : String.fromCharCode(65 + i)}
                          </span>
                        )}
                        <span className="flex-1 font-semibold text-sm" style={{ color: textColor }}>{opt.text}</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {/* === CHECKBOX === */}
              {qType === 'checkbox' && (
                <>
                  <p className="text-xs text-blue-600 mb-3">☑️ Plusieurs réponses possibles — cochez puis validez</p>
                  <div className="flex flex-col gap-2.5">
                    {parseStandardOptions(q.options).map((opt) => {
                      const isSelected = selectedAnswers.includes(opt.id)
                      const isCorrect = opt.correct
                      let bg = '#FAFAFF', border = '#E2E8F0', textColor = '#334155'
                      if (isSelected && !showFeedback) { bg = '#F1F5F9'; border = '#94A3B8' }
                      if (showFeedback) {
                        if (isCorrect) { bg = '#F0FDF4'; border = '#4ADE80' }
                        else if (isSelected) { bg = '#FEF2F2'; border = '#FCA5A5' }
                        else { textColor = '#94A3B8' }
                      }
                      return (
                        <button key={opt.id} onClick={() => !showFeedback && setSelectedAnswers(prev => prev.includes(opt.id) ? prev.filter(a => a !== opt.id) : [...prev, opt.id])}
                          disabled={showFeedback} className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                          style={{ background: bg, border: `2px solid ${border}`, cursor: showFeedback ? 'default' : 'pointer' }}>
                          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                            {showFeedback ? (isCorrect ? <CheckSquare size={24} className="text-emerald-500" /> : isSelected ? <X size={24} className="text-red-500" /> : <Square size={24} className="text-gray-300" />)
                              : isSelected ? <CheckSquare size={24} style={{ color: categoryGradient.from }} /> : <Square size={24} className="text-gray-400" />}
                          </span>
                          <span className="flex-1 font-semibold text-sm" style={{ color: textColor }}>{opt.text}</span>
                        </button>
                      )
                    })}
                  </div>
                  {!showFeedback && (
                    <button onClick={handleCheckboxValidate} disabled={selectedAnswers.length === 0}
                      className="w-full mt-4 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40" style={{ background: categoryGradient.from }}>
                      Valider ({selectedAnswers.length} sélectionnée{selectedAnswers.length > 1 ? 's' : ''})
                    </button>
                  )}
                </>
              )}

              {/* === HIGHLIGHT === */}
              {qType === 'highlight' && (
                <>
                  <p className="text-xs text-rose-600 mb-3">🚫 Barrez les intrus en les sélectionnant</p>
                  <div className="flex flex-col gap-2.5">
                    {parseStandardOptions(q.options).map((opt) => {
                      const isSelected = selectedAnswers.includes(opt.id)
                      const isIntrus = !opt.correct
                      let bg = '#FAFAFF', border = '#E2E8F0', textColor = '#334155', textDeco = 'none'
                      if (isSelected && !showFeedback) { bg = '#FEF2F2'; border = '#FCA5A5'; textDeco = 'line-through' }
                      if (showFeedback) {
                        if (isIntrus) { bg = '#FEF2F2'; border = '#FCA5A5'; textDeco = 'line-through'; textColor = '#DC2626' }
                        else if (isSelected) { bg = '#FEF2F2'; border = '#EF4444'; textColor = '#EF4444' }
                        else { bg = '#F0FDF4'; border = '#4ADE80' }
                      }
                      return (
                        <button key={opt.id} onClick={() => !showFeedback && setSelectedAnswers(prev => prev.includes(opt.id) ? prev.filter(a => a !== opt.id) : [...prev, opt.id])}
                          disabled={showFeedback} className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                          style={{ background: bg, border: `2px solid ${border}`, cursor: showFeedback ? 'default' : 'pointer' }}>
                          <span className="flex-1 font-semibold text-sm" style={{ color: textColor, textDecoration: textDeco }}>{opt.text}</span>
                          {showFeedback && isIntrus && <span className="text-rose-500 text-xs font-bold">INTRUS</span>}
                        </button>
                      )
                    })}
                  </div>
                  {!showFeedback && (
                    <button onClick={handleHighlightValidate} disabled={selectedAnswers.length === 0}
                      className="w-full mt-4 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40" style={{ background: categoryGradient.from }}>
                      Valider mes choix
                    </button>
                  )}
                </>
              )}

              {/* === FILL_BLANK === */}
              {qType === 'fill_blank' && (() => {
                const opts = parseFillBlankOptions(q.options)
                if (!opts) return <p className="text-gray-500">Format de question non supporté</p>
                
                const hasWordBank = opts.wordBank && opts.wordBank.length > 0
                const usedWords = Object.values(fillBlankAnswers)
                const allFilled = opts.blanks.every(b => fillBlankAnswers[b.id])
                
                return (
                  <>
                    <p className="text-xs text-indigo-600 mb-3">
                      {hasWordBank ? '📝 Sélectionnez un mot de la banque pour chaque blanc' : '📝 Tapez votre réponse'}
                    </p>
                    
                    {/* Blanks */}
                    <div className="bg-white p-4 rounded-2xl border-2 border-gray-100 mb-4 space-y-3">
                      {opts.blanks.map((blank, idx) => {
                        const answer = fillBlankAnswers[blank.id]
                        const isCorrect = answer && (
                          answer.toLowerCase().trim() === blank.correctAnswer.toLowerCase().trim() ||
                          blank.alternatives?.some(alt => alt.toLowerCase().trim() === answer.toLowerCase().trim())
                        )
                        
                        return (
                          <div key={blank.id} className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-600 font-medium">
                              {opts.blanks.length > 1 ? `Blanc ${idx + 1}:` : 'Réponse:'}
                            </span>
                            
                            {/* Mode wordBank → bouton cliquable */}
                            {hasWordBank ? (
                              <button
                                onClick={() => !showFeedback && setFillBlankAnswers(prev => {
                                  const newAnswers = { ...prev }
                                  delete newAnswers[blank.id]
                                  return newAnswers
                                })}
                                disabled={showFeedback}
                                className="min-w-[100px] px-4 py-2 rounded-xl border-2 border-dashed text-sm font-semibold transition-all"
                                style={{
                                  borderColor: showFeedback ? (isCorrect ? '#4ADE80' : '#FCA5A5') : answer ? categoryGradient.from : '#CBD5E1',
                                  background: showFeedback ? (isCorrect ? '#F0FDF4' : '#FEF2F2') : answer ? `${categoryGradient.from}10` : 'white',
                                  color: showFeedback ? (isCorrect ? '#16A34A' : '#DC2626') : '#334155',
                                }}
                              >
                                {answer || '________'}
                              </button>
                            ) : (
                              /* Mode saisie libre → input text */
                              <input
                                type="text"
                                value={answer || ''}
                                onChange={(e) => !showFeedback && setFillBlankAnswers(prev => ({ ...prev, [blank.id]: e.target.value }))}
                                disabled={showFeedback}
                                placeholder="Tapez votre réponse..."
                                className="flex-1 min-w-[150px] px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all outline-none"
                                style={{
                                  borderColor: showFeedback ? (isCorrect ? '#4ADE80' : '#FCA5A5') : '#CBD5E1',
                                  background: showFeedback ? (isCorrect ? '#F0FDF4' : '#FEF2F2') : 'white',
                                  color: showFeedback ? (isCorrect ? '#16A34A' : '#DC2626') : '#334155',
                                }}
                              />
                            )}
                            
                            {showFeedback && !isCorrect && (
                              <span className="text-xs text-emerald-600 font-medium">→ {blank.correctAnswer}</span>
                            )}
                          </div>
                        )
                      })}
                    </div>

                    {/* Word Bank (seulement si disponible) */}
                    {!showFeedback && hasWordBank && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {opts.wordBank.map((word, i) => {
                          const isUsed = usedWords.includes(word)
                          return (
                            <button
                              key={`${word}-${i}`}
                              onClick={() => {
                                if (isUsed) return
                                // Trouver le premier blanc vide
                                const emptyBlank = opts.blanks.find(b => !fillBlankAnswers[b.id])
                                if (emptyBlank) {
                                  setFillBlankAnswers(prev => ({ ...prev, [emptyBlank.id]: word }))
                                }
                              }}
                              disabled={isUsed}
                              className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                              style={{
                                background: isUsed ? '#E2E8F0' : categoryGradient.from,
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

                    {!showFeedback && (
                      <button onClick={handleFillBlankValidate} disabled={!allFilled}
                        className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40" style={{ background: categoryGradient.from }}>
                        Valider {hasWordBank ? 'mes réponses' : 'ma réponse'}
                      </button>
                    )}
                  </>
                )
              })()}

              {/* === ORDERING (ou drag_drop format ordering) === */}
              {(qType === 'ordering' || (qType === 'drag_drop' && isDragDropOrdering(q.options))) && (() => {
                const opts = parseOrderingOptions(q.options)
                if (opts.length === 0) return <p className="text-gray-500">Format de question non supporté</p>

                const moveItem = (from: number, to: number) => {
                  if (showFeedback || to < 0 || to >= orderingOrder.length) return
                  const newOrder = [...orderingOrder]
                  const [moved] = newOrder.splice(from, 1)
                  newOrder.splice(to, 0, moved)
                  setOrderingOrder(newOrder)
                }

                return (
                  <>
                    <p className="text-xs text-amber-600 mb-3">↕️ Utilisez les flèches pour réordonner</p>
                    <div className="flex flex-col gap-2">
                      {orderingOrder.map((itemId, index) => {
                        const item = opts.find(o => o.id === itemId)
                        if (!item) return null
                        const isCorrectPos = showFeedback && item.correctPosition === index + 1

                        return (
                          <div key={itemId} className="flex items-center gap-2 p-3 rounded-2xl border-2 transition-all"
                            style={{
                              background: showFeedback ? (isCorrectPos ? '#F0FDF4' : '#FEF2F2') : '#FAFAFF',
                              borderColor: showFeedback ? (isCorrectPos ? '#4ADE80' : '#FCA5A5') : '#E2E8F0',
                            }}>
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                              style={{ background: showFeedback ? (isCorrectPos ? '#22C55E' : '#EF4444') : categoryGradient.from, color: 'white' }}>
                              {index + 1}
                            </span>
                            <span className="flex-1 text-sm font-semibold text-gray-700">{item.text}</span>
                            {!showFeedback && (
                              <div className="flex flex-col">
                                <button onClick={() => moveItem(index, index - 1)} disabled={index === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                                  <ChevronUp size={16} className="text-gray-500" />
                                </button>
                                <button onClick={() => moveItem(index, index + 1)} disabled={index === orderingOrder.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                                  <ChevronDown size={16} className="text-gray-500" />
                                </button>
                              </div>
                            )}
                            {showFeedback && !isCorrectPos && <span className="text-xs text-emerald-600">→ Pos. {item.correctPosition}</span>}
                          </div>
                        )
                      })}
                    </div>
                    {!showFeedback && (
                      <button onClick={handleOrderingValidate} className="w-full mt-4 py-3.5 rounded-2xl font-bold text-[15px] text-white" style={{ background: categoryGradient.from }}>
                        Valider l&apos;ordre
                      </button>
                    )}
                  </>
                )
              })()}

              {/* === MATCHING (ou drag_drop format matching) === */}
              {(qType === 'matching' || (qType === 'drag_drop' && isDragDropMatching(q.options))) && (() => {
                const pairs = parseMatchingOptions(q.options)
                if (pairs.length === 0) return <p className="text-gray-500">Format de question non supporté</p>

                return (
                  <>
                    <p className="text-xs text-teal-600 mb-3">🔗 Cliquez sur un élément gauche puis son correspondant à droite</p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Gauche */}
                      <div className="flex flex-col gap-2">
                        {pairs.map((pair) => {
                          const isSelected = selectedLeftMatching === pair.id
                          const isMatched = matchingMatches[pair.id]
                          const isCorrect = showFeedback && matchingMatches[pair.id] === pair.id

                          return (
                            <button key={pair.id} onClick={() => !showFeedback && !isMatched && setSelectedLeftMatching(pair.id)}
                              disabled={showFeedback || !!isMatched}
                              className="p-3 rounded-xl border-2 text-left text-sm font-semibold transition-all"
                              style={{
                                background: showFeedback ? (isCorrect ? '#F0FDF4' : '#FEF2F2') : isSelected ? `${categoryGradient.from}15` : isMatched ? '#F1F5F9' : '#FAFAFF',
                                borderColor: showFeedback ? (isCorrect ? '#4ADE80' : '#FCA5A5') : isSelected ? categoryGradient.from : isMatched ? '#94A3B8' : '#E2E8F0',
                                color: '#334155', opacity: isMatched && !showFeedback ? 0.7 : 1,
                              }}>
                              {pair.left}
                            </button>
                          )
                        })}
                      </div>
                      {/* Droite */}
                      <div className="flex flex-col gap-2">
                        {(shuffledMatchingRights.length > 0 ? shuffledMatchingRights : pairs).map((pair) => {
                          const isMatched = Object.values(matchingMatches).includes(pair.id)
                          return (
                            <button key={pair.id}
                              onClick={() => {
                                if (showFeedback || isMatched || !selectedLeftMatching) return
                                setMatchingMatches(prev => ({ ...prev, [selectedLeftMatching]: pair.id }))
                                setSelectedLeftMatching(null)
                              }}
                              disabled={showFeedback || isMatched}
                              className="p-3 rounded-xl border-2 text-left text-sm font-semibold transition-all"
                              style={{
                                background: isMatched ? '#F1F5F9' : selectedLeftMatching ? `${categoryGradient.from}10` : '#FAFAFF',
                                borderColor: isMatched ? '#94A3B8' : '#E2E8F0',
                                opacity: isMatched ? 0.6 : 1,
                              }}>
                              {pair.right}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {!showFeedback && (
                      <button onClick={handleMatchingValidate} disabled={Object.keys(matchingMatches).length < pairs.length}
                        className="w-full mt-4 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40" style={{ background: categoryGradient.from }}>
                        Valider les associations
                      </button>
                    )}
                  </>
                )
              })()}

              {/* === TYPE NON SUPPORTÉ === */}
              {!['mcq', 'true_false', 'mcq_image', 'image', 'checkbox', 'highlight', 'fill_blank', 'ordering', 'matching', 'drag_drop'].includes(qType) && (
                <div className="text-center py-8">
                  <AlertCircle size={48} className="text-amber-500 mx-auto mb-3" />
                  <p className="text-gray-600 mb-2">Type &quot;{qType}&quot; non encore implémenté</p>
                  <button onClick={skipQuestion} className="px-6 py-3 rounded-xl text-white font-bold" style={{ background: categoryGradient.from }}>
                    Passer cette question
                  </button>
                </div>
              )}
            </div>
          )
        })()}

        {/* PDF */}
        {playerStep === 'pdf' && (
          <div className="text-center py-10">
            <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4 text-4xl">📄</div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">Support de cours</h3>
            {sequence.infographic_url ? (
              <a href={sequence.infographic_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl border-2 border-gray-200 bg-white font-semibold text-sm mb-6">
                <Download size={18} /> Télécharger le PDF
              </a>
            ) : (
              <p className="text-sm text-gray-400 mb-6">PDF non disponible pour cette séquence</p>
            )}
            <div className="mt-4">
              <button onClick={finishSequence} disabled={submitting} className="w-full max-w-xs py-4 rounded-2xl font-bold text-white disabled:opacity-50" style={{ background: categoryGradient.from }}>
                {submitting ? 'Enregistrement...' : 'Terminer ✓'}
              </button>
            </div>
          </div>
        )}

        {/* RÉSULTATS */}
        {playerStep === 'results' && (
          <div className="text-center py-5">
            <div className="w-28 h-28 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `conic-gradient(${score >= 75 ? '#22C55E' : score >= 50 ? '#FBBF24' : '#EF4444'} ${score * 3.6}deg, #E2E8F0 0deg)` }}>
              <div className="w-[88px] h-[88px] rounded-full bg-white flex items-center justify-center">
                <span className="text-3xl font-extrabold text-gray-800">{score}%</span>
              </div>
            </div>
            <h2 className="text-[22px] font-extrabold text-gray-800 mb-1">
              {score === 100 ? 'Parfait ! 🏆' : score >= 75 ? 'Excellent ! ✨' : score >= 50 ? 'Bien joué ! 💪' : 'Continue ! 📚'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">{correctCount}/{questions.length} bonnes réponses</p>
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-100 to-amber-200 rounded-2xl px-5 py-4 mb-6">
              <span className="text-3xl">⭐</span>
              <div className="text-left">
                <p className="text-2xl font-extrabold text-amber-700">+{totalPoints}</p>
                <p className="text-xs text-amber-700">points gagnés</p>
              </div>
            </div>
            <div>
              <button onClick={() => showPdf ? setPlayerStep('pdf') : finishSequence()} disabled={submitting} className="w-full max-w-xs py-4 rounded-2xl font-bold text-white disabled:opacity-50" style={{ background: categoryGradient.from }}>
                {submitting ? 'Enregistrement...' : showPdf ? 'Voir le PDF' : 'Terminer'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Overlay Feedback */}
      {showOverlay && overlayData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-[360px] bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="px-6 py-5 text-center" style={{ background: overlayData.isCorrect ? 'linear-gradient(135deg, #34D399, #059669)' : 'linear-gradient(135deg, #F87171, #DC2626)' }}>
              <div className="w-14 h-14 mx-auto mb-2 bg-white rounded-full flex items-center justify-center">
                {overlayData.isCorrect ? <Check size={28} className="text-emerald-600" strokeWidth={3} /> : <X size={28} className="text-red-600" strokeWidth={3} />}
              </div>
              <h3 className="text-xl font-extrabold text-white mb-2">{overlayData.isCorrect ? 'Bravo !' : 'Dommage !'}</h3>
              {overlayData.points > 0 && <span className="bg-white/20 px-4 py-1 rounded-full text-white font-bold text-sm">+{overlayData.points} points</span>}
            </div>
            <div className="px-6 py-5 max-h-[200px] overflow-auto">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={16} className="text-amber-500" />
                <span className="text-xs font-bold text-gray-400 uppercase">Explication</span>
              </div>
              <p className="text-[13px] text-gray-600 leading-relaxed">{overlayData.feedback || 'Aucun feedback disponible.'}</p>
            </div>
            <div className="px-6 pb-5">
              <button onClick={nextQuestion} className="w-full py-4 rounded-2xl font-bold text-white" style={{ background: categoryGradient.from }}>
                {overlayData.isLast ? 'Voir mes résultats' : 'Question suivante'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
