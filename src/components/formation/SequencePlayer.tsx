'use client'

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  ChevronLeft,
  ArrowLeft,
  Check,
  X,
  CheckCircle2,
  XCircle,
  Lightbulb,
  Loader2,
  Square,
  CheckSquare,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Info,
  Play,
} from 'lucide-react'
import {
  createClient,
  useSequenceQuestions,
  useSubmitSequenceResult,
  type Sequence,
  type Question,
} from '@/lib/supabase'
import AudioPlayer from './AudioPlayer'
import EnrichedAudioPlayer, { type EnrichedPlayerTab } from './EnrichedAudioPlayer'
import TreasureChest from '@/components/sequences/TreasureChest'
import CaseStudyQuestion from '@/components/questions/CaseStudyQuestion'
import { parseCaseStudyData } from '@/lib/questions/parseCaseStudyData'
import { useAudio } from '@/context/AudioContext'

// ============================================
// TYPES (basés sur types/questions.ts)
// ============================================

interface SequencePlayerProps {
  sequence: Sequence
  categoryGradient: { from: string; to: string }
  coverImageUrl?: string | null
  onBack: () => void
  onComplete: (score: number, totalPoints: number) => void
  shouldSubmitResult?: () => Promise<boolean>
}

type PlayerStep = 'video' | 'quiz' | 'pdf' | 'results' | 'review' | 'bloc_remediation'

// Question de remédiation = Question + provenance (séquence d'origine) pour
// regrouper la liste « à acquérir » par séquence (PARTIE_A_v4 §2.4).
type RemediationQuestion = Question & {
  sequence_title: string
  sequence_number: number
}

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

interface MatchingRightOption {
  id: string
  text: string
}

interface ParsedMatchingData {
  leftItems: { index: number; left: string; correctRightId: string }[]
  rightOptions: MatchingRightOption[]
  correctAnswers: string[]
}

interface MatchingPairAssignment {
  leftKey: string
  rightId: string
  pairIndex: number
}

// Palette cyclique pour les paires associées en matching (badge numéroté + halo).
// Classes littérales pour que Tailwind JIT les détecte.
const MATCHING_PAIR_COLORS = [
  { bg: 'bg-violet-500/15',  border: 'border-violet-500',  text: 'text-violet-300',  badge: 'bg-violet-500' },
  { bg: 'bg-emerald-500/15', border: 'border-emerald-500', text: 'text-emerald-300', badge: 'bg-emerald-500' },
  { bg: 'bg-amber-500/15',   border: 'border-amber-500',   text: 'text-amber-300',   badge: 'bg-amber-500' },
  { bg: 'bg-pink-500/15',    border: 'border-pink-500',    text: 'text-pink-300',    badge: 'bg-pink-500' },
  { bg: 'bg-cyan-500/15',    border: 'border-cyan-500',    text: 'text-cyan-300',    badge: 'bg-cyan-500' },
  { bg: 'bg-orange-500/15',  border: 'border-orange-500',  text: 'text-orange-300',  badge: 'bg-orange-500' },
]

function colorForPairIndex(pairIndex: number) {
  return MATCHING_PAIR_COLORS[(pairIndex - 1) % MATCHING_PAIR_COLORS.length]
}

function nextPairIndex(matches: MatchingPairAssignment[]): number {
  return matches.length > 0 ? Math.max(...matches.map(m => m.pairIndex)) + 1 : 1
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

// ============================================
// COMPOSANT PRINCIPAL
// ============================================

export default function SequencePlayer({
  sequence,
  categoryGradient,
  coverImageUrl,
  onBack,
  onComplete,
  shouldSubmitResult,
}: SequencePlayerProps) {
  const { questions, loading: loadingQuestions, error } = useSequenceQuestions(sequence.id)
  const { submit: submitResult, loading: submitting } = useSubmitSequenceResult()
  // POC-T7.4-UX-FAB : on a besoin de `playAudio` pour démarrer la track depuis
  // le FAB overlay du wrapper enrichi (la card legacy étant masquée par
  // T7.4-UX-B). Aucune autre méthode du context n'est consommée ici.
  const { playAudio, state: audioState } = useAudio()

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
  const [enrichedActiveTab, setEnrichedActiveTab] = useState<EnrichedPlayerTab>('combined')
  // POC-T7.4-UX-D/E : drawer Objectifs mobile, useState local (pas de localStorage).
  const [objectivesDrawerOpen, setObjectivesDrawerOpen] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  
  // États pour différents types
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  const [fillBlankAnswers, setFillBlankAnswers] = useState<Record<string, string>>({})
  const [orderingOrder, setOrderingOrder] = useState<string[]>([])
  const [matchingMatches, setMatchingMatches] = useState<MatchingPairAssignment[]>([])
  const [caseStudyAnswers, setCaseStudyAnswers] = useState<Record<string, string>>({})
  const [caseStudyCurrentQ, setCaseStudyCurrentQ] = useState(0)
  const [selectedLeftMatching, setSelectedLeftMatching] = useState<string | null>(null)
  const [shuffledMatchingRights, setShuffledMatchingRights] = useState<MatchingRightOption[]>([])
  
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

  // Pour la branche intro audio-only : on n'affiche l'écran "Introduction
  // terminée" + bouton "Retour à la formation" que quand l'audio a réellement
  // été écouté jusqu'à la fin (sinon l'user voit ce message dès l'ouverture
  // alors que l'audio démarre, c'est désorientant).
  const [audioMediaCompleted, setAudioMediaCompleted] = useState(false)
  useEffect(() => {
    if (
      isAudio &&
      audioState.sequenceId === sequence.id &&
      audioState.duration > 0 &&
      audioState.currentTime >= audioState.duration - 0.5
    ) {
      setAudioMediaCompleted(true)
    }
  }, [
    isAudio,
    audioState.sequenceId,
    audioState.currentTime,
    audioState.duration,
    sequence.id,
  ])

  // SM-2 spaced repetition (T-SM2)
  const supabase = useMemo(() => createClient(), [])
  const [userId, setUserId] = useState<string | null>(null)
  const [reviewQuestions, setReviewQuestions] = useState<Question[]>([])
  const [reviewIdx, setReviewIdx] = useState(0)
  const [reviewLoading, setReviewLoading] = useState(false)

  // Remédiation obligatoire en fin de bloc (PARTIE_A_v4 §2.4). Uniquement pour
  // les formations CP (axe_cp non nul) et seulement à la dernière séquence du
  // bloc courant. blocGate est résolu via un fetch léger au montage.
  const [blocGate, setBlocGate] = useState<{ isCp: boolean; bloc: number; isLastOfBloc: boolean } | null>(null)
  const [remediationQuestions, setRemediationQuestions] = useState<RemediationQuestion[]>([])
  const [remediationIdx, setRemediationIdx] = useState(0)
  const [remediationLoading, setRemediationLoading] = useState(false)
  const [remediationStarted, setRemediationStarted] = useState(false)
  const [remediationDone, setRemediationDone] = useState(false)
  const [remediationInitialCount, setRemediationInitialCount] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [supabase])

  // Résolution du contexte de bloc (formation CP ? dernière séquence du bloc ?).
  useEffect(() => {
    if (!userId) return
    let active = true
    ;(async () => {
      try {
        const [{ data: f }, { data: sibs }] = await Promise.all([
          supabase.from('formations').select('axe_cp').eq('id', sequence.formation_id).single(),
          supabase.from('sequences').select('sequence_number, bloc_number').eq('formation_id', sequence.formation_id),
        ])
        if (!active) return
        const rows = (sibs ?? []) as { sequence_number: number; bloc_number: number }[]
        const bloc =
          sequence.bloc_number ??
          rows.find(s => s.sequence_number === sequence.sequence_number)?.bloc_number ??
          1
        const maxInBloc = rows
          .filter(s => s.bloc_number === bloc)
          .reduce((m: number, s) => Math.max(m, s.sequence_number), -Infinity)
        setBlocGate({
          isCp: f?.axe_cp != null,
          bloc,
          isLastOfBloc: sequence.sequence_number === maxInBloc,
        })
      } catch (err) {
        console.error('bloc gate fetch error:', err)
      }
    })()
    return () => {
      active = false
    }
  }, [supabase, userId, sequence.formation_id, sequence.sequence_number, sequence.bloc_number])

  const steps: PlayerStep[] = useMemo(() => {
    const s: PlayerStep[] = []
    if (showVideo) s.push('video')
    s.push('quiz')
    return s
  }, [showVideo])

  const currentStepIdx = steps.indexOf(
    playerStep === 'results' || playerStep === 'review' || playerStep === 'bloc_remediation'
      ? 'quiz'
      : playerStep
  )
  const currentQuestion =
    playerStep === 'review'
      ? reviewQuestions[reviewIdx]
      : playerStep === 'bloc_remediation'
        ? remediationQuestions[remediationIdx]
        : questions[currentQ]

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
      const data = parseMatchingData(currentQuestion.options, currentQuestion.id)
      if (data && data.rightOptions.length > 0) {
        let shuffled = shuffleArray([...data.rightOptions])
        // Re-mélanger si par hasard l'ordre est resté identique
        let attempts = 0
        while (shuffled.every((ro, i) => ro.id === data.rightOptions[i].id) && attempts < 10) {
          shuffled = shuffleArray([...data.rightOptions])
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
    setMatchingMatches([])
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
    // Phases isolées (révision SM-2 + remédiation de bloc) : aucun impact sur le
    // score / les points de la séquence.
    const isIsolated = playerStep === 'review' || playerStep === 'bloc_remediation'
    if (!isIsolated) {
      if (isCorrect) setCorrectCount(c => c + 1)
      setTotalPoints(p => p + points)
    }
    setShowFeedback(true)
    // En remédiation, la passe peut être suivie d'autres passes : on garde un
    // libellé « Question suivante » (isLast=false) — la transition décide ensuite.
    const isLast =
      playerStep === 'review'
        ? reviewIdx === reviewQuestions.length - 1
        : playerStep === 'bloc_remediation'
          ? false
          : currentQ === questions.length - 1
    setOverlayData({ isCorrect, points: isIsolated ? 0 : points, feedback, isLast })
    setShowOverlay(true)
  }

  // SM-2 : enregistrement non-bloquant. INSERT only on failure (quality=1) en
  // phase quiz ; en phase review, on enregistre toujours (quality=5|1) pour
  // faire progresser le compteur de réussites consécutives vers mastered_at.
  const recordSm2 = useCallback(async (questionId: string, isCorrect: boolean) => {
    if (!userId) return
    try {
      await supabase.rpc('update_sm2_state', {
        p_user_id: userId,
        p_question_id: questionId,
        p_sequence_id: sequence.id,
        p_quality: isCorrect ? 5 : 1,
      })
    } catch (err) {
      console.error('SM-2 record error:', err)
    }
  }, [supabase, userId, sequence.id])

  // Acquisition (modèle Hybride) : enregistre une bonne réponse du 1er coup en
  // phase quiz pour qu'elle compte comme « acquise » (consecutive_correct>=1)
  // sans entrer dans la file de révision SM-2 (next_review_date NULL côté RPC).
  const recordAcquisition = useCallback(async (questionId: string) => {
    if (!userId) return
    try {
      await supabase.rpc('record_question_acquisition', {
        p_user_id: userId,
        p_question_id: questionId,
        p_sequence_id: sequence.id,
      })
    } catch (err) {
      console.error('acquisition record error:', err)
    }
  }, [supabase, userId, sequence.id])

  // Wrapper : en phases isolées ('review' + 'bloc_remediation'), on n'écrit PAS
  // dans answersLog (isolation stricte, cf. décision Dr Fantin 16/05/2026).
  // Écritures user_question_review :
  //   * phases isolées        -> recordSm2 (quality 5|1) : fait progresser
  //     consecutive_correct (une bonne réponse en remédiation -> acquise)
  //   * quiz + échec          -> recordSm2 (quality 1) : crée la ligne « échouée »
  //   * quiz + bonne réponse  -> recordAcquisition : ligne « acquise » hors SM-2
  const logAnswer = useCallback(
    (q: Question, selectedOption: string, isCorrect: boolean, pointsEarned: number) => {
      const isIsolated = playerStep === 'review' || playerStep === 'bloc_remediation'
      if (!isIsolated) {
        setAnswersLog(prev => [
          ...prev,
          { question_id: q.id, selected_option: selectedOption, is_correct: isCorrect, points_earned: pointsEarned },
        ])
      }
      if (isIsolated || !isCorrect) {
        void recordSm2(q.id, isCorrect)
      } else {
        void recordAcquisition(q.id)
      }
    },
    [playerStep, recordSm2, recordAcquisition]
  )

  // Case study — le composant <CaseStudyQuestion> remonte le choix ; le scoring
  // et l'avance de sous-question restent ici. L'écriture answersLog passe par
  // logAnswer (isolation review SM-2 + recordSm2).
  const handleCaseStudySelect = useCallback((choiceId: string) => {
    const q = currentQuestion
    if (!q) return
    const parsed = parseCaseStudyData(q.options)
    if (!parsed) return
    const subQ = parsed.questions[caseStudyCurrentQ]
    if (!subQ) return
    if (showFeedback || caseStudyAnswers[subQ.id]) return

    const newAnswers = { ...caseStudyAnswers, [subQ.id]: choiceId }
    setCaseStudyAnswers(newAnswers)

    const isLastSubQ = caseStudyCurrentQ >= parsed.questions.length - 1
    if (!isLastSubQ) return // l'avance de sous-question est pilotée par le composant

    const choice = subQ.choices.find(c => c.id === choiceId)
    let totalCorrect = choice?.correct ? 1 : 0
    for (let k = 0; k < caseStudyCurrentQ; k++) {
      const prevQ = parsed.questions[k]
      const prevChoice = prevQ.choices.find(c => c.id === newAnswers[prevQ.id])
      if (prevChoice?.correct) totalCorrect++
    }
    const allCorrect = totalCorrect === parsed.questions.length
    const earnedPoints = Math.round((totalCorrect / parsed.questions.length) * q.points)

    logAnswer(q, choiceId, allCorrect, earnedPoints)
    if (allCorrect) setCorrectCount(c => c + 1)
    setTotalPoints(p => p + earnedPoints)
    setShowFeedback(true)
    setOverlayData({ isCorrect: allCorrect, points: earnedPoints, feedback: allCorrect ? q.feedback_correct : q.feedback_incorrect, isLast: currentQ === questions.length - 1 })
    setShowOverlay(true)
  }, [currentQuestion, caseStudyCurrentQ, caseStudyAnswers, showFeedback, currentQ, questions.length, logAnswer])

  // MCQ / True-False / MCQ Image
  const handleSingleAnswer = (answerId: string) => {
    if (showFeedback || selectedAnswer) return
    setSelectedAnswer(answerId)

    const q = currentQuestion
    const opts = parseStandardOptions(q.options)
    const selected = opts.find(o => o.id === answerId)
    const isCorrect = selected?.correct || false
    const points = isCorrect ? q.points : 0

    logAnswer(q, answerId, isCorrect, points)
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

    logAnswer(q, selectedAnswers.join(','), isCorrect, points)
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

    logAnswer(q, selectedAnswers.join(','), isCorrect, points)
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

    logAnswer(q, JSON.stringify(fillBlankAnswers), isCorrect, points)
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

    logAnswer(q, orderingOrder.join(','), isCorrect, points)
    evaluateAndShowFeedback(isCorrect, points, isCorrect ? q.feedback_correct : q.feedback_incorrect)
  }

  // Matching
  const handleMatchingValidate = () => {
    const q = currentQuestion
    const data = parseMatchingData(q.options, q.id)
    const items = data?.leftItems || []
    const matchByLeft = new Map(matchingMatches.map(m => [m.leftKey, m.rightId]))

    let correct = 0
    for (const li of items) {
      if (matchByLeft.get(li.left) === li.correctRightId) correct++
    }

    const score = items.length > 0 ? correct / items.length : 0
    const isCorrect = score === 1
    const points = Math.round(score * q.points)

    logAnswer(q, JSON.stringify(matchingMatches), isCorrect, points)
    evaluateAndShowFeedback(isCorrect, points, isCorrect ? q.feedback_correct : q.feedback_incorrect)
  }

  // Après la phase de quiz (et révision SM-2 éventuelle) : décide s'il faut
  // ouvrir la remédiation de bloc (PARTIE_A_v4 §2.4) ou passer aux résultats.
  // Remédiation seulement si : formation CP + dernière séquence du bloc +
  // au moins une question non acquise dans le bloc.
  const proceedAfterReview = async () => {
    if (!userId || !blocGate || !blocGate.isCp || !blocGate.isLastOfBloc) {
      setPlayerStep('results')
      return
    }
    setRemediationLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_bloc_failed_questions', {
        p_user_id: userId,
        p_formation_id: sequence.formation_id,
        p_bloc_number: blocGate.bloc,
      })
      if (!error && data && data.length > 0) {
        setRemediationQuestions(data as RemediationQuestion[])
        setRemediationInitialCount(data.length)
        setRemediationIdx(0)
        setRemediationStarted(false)
        setRemediationDone(false)
        setPlayerStep('bloc_remediation')
      } else {
        setPlayerStep('results')
      }
    } catch (err) {
      console.error('bloc remediation fetch error:', err)
      setPlayerStep('results')
    } finally {
      setRemediationLoading(false)
    }
  }

  // Fin d'une passe de remédiation : recharge les questions encore non acquises
  // du bloc. Pool vide -> bloc validé (écran de succès puis résultats).
  const reloadRemediationPass = async () => {
    setRemediationLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_bloc_failed_questions', {
        p_user_id: userId,
        p_formation_id: sequence.formation_id,
        p_bloc_number: blocGate?.bloc,
      })
      if (!error && data && data.length > 0) {
        setRemediationQuestions(data as RemediationQuestion[])
        setRemediationIdx(0)
      } else {
        setRemediationDone(true)
      }
    } catch (err) {
      console.error('bloc remediation refetch error:', err)
      setRemediationDone(true)
    } finally {
      setRemediationLoading(false)
    }
  }

  const nextQuestion = async () => {
    setShowOverlay(false)
    resetQuestionState()

    if (playerStep === 'bloc_remediation') {
      if (remediationIdx < remediationQuestions.length - 1) {
        setRemediationIdx(i => i + 1)
      } else {
        await reloadRemediationPass()
      }
      return
    }

    if (playerStep === 'review') {
      if (reviewIdx < reviewQuestions.length - 1) {
        setReviewIdx(i => i + 1)
      } else {
        await proceedAfterReview()
      }
      return
    }

    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1)
      return
    }

    // Fin du quiz : on tente d'ouvrir une phase de révision SM-2 sur le thème
    // de la formation. Pool vide ou erreur -> remédiation de bloc ou résultats.
    if (!userId) {
      await proceedAfterReview()
      return
    }
    setReviewLoading(true)
    try {
      const { data, error } = await supabase.rpc('get_sm2_review_questions', {
        p_user_id: userId,
        p_sequence_id: sequence.id,
        p_limit: 3,
      })
      if (!error && data && data.length > 0) {
        setReviewQuestions(data as Question[])
        setReviewIdx(0)
        setPlayerStep('review')
      } else {
        await proceedAfterReview()
      }
    } catch (err) {
      console.error('SM-2 review fetch error:', err)
      await proceedAfterReview()
    } finally {
      setReviewLoading(false)
    }
  }

  const skipQuestion = () => {
    logAnswer(currentQuestion, 'skipped', false, 0)
    resetQuestionState()
    if (playerStep === 'bloc_remediation') {
      if (remediationIdx < remediationQuestions.length - 1) {
        setRemediationIdx(i => i + 1)
      } else {
        void reloadRemediationPass()
      }
      return
    }
    if (playerStep === 'review') {
      if (reviewIdx < reviewQuestions.length - 1) {
        setReviewIdx(i => i + 1)
      } else {
        void proceedAfterReview()
      }
      return
    }
    if (currentQ < questions.length - 1) {
      setCurrentQ(c => c + 1)
    } else {
      void proceedAfterReview()
    }
  }

  const finishSequence = async () => {
    try {
      // Demander au parent si on peut écrire en DB (gate l'auto-inscription
      // silencieuse pour les intros complétées par un user non inscrit).
      const canSubmit = shouldSubmitResult ? await shouldSubmitResult() : true
      if (canSubmit) {
        await submitResult({
          sequenceId: sequence.id,
          score: Math.round((correctCount / questions.length) * 100),
          totalPoints,
          timeSpentSeconds: Math.round((Date.now() - startTime) / 1000),
          answers: answersLog,
        })
      }
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
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F0F0F' }}>
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0F0F0F' }}>
        <div className="text-center">
          <p className="mb-4" style={{ color: '#a3a3a3' }}>{error.message}</p>
          <button onClick={onBack} className="px-4 py-2 rounded-xl text-sm" style={{ background: '#242424', color: '#e5e5e5' }}>Retour</button>
        </div>
      </div>
    )
  }

  // Séquence sans questions mais avec média (ex: intro avec audio uniquement)
  if (questions.length === 0 && hasMedia) {
    return (
      <div className="min-h-screen flex flex-col" style={{ background: '#0F0F0F' }}>
        {/* Header */}
        <div className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3" style={{ background: '#1a1a1a', borderBottom: '0.5px solid #2a2a2a' }}>
          <button onClick={onBack} className="p-1 rounded-lg" style={{ color: '#a3a3a3' }}>
            <ChevronLeft size={20} />
          </button>
          <p className="flex-1 font-bold text-sm truncate" style={{ color: '#e5e5e5' }}>{sequence.title}</p>
        </div>

        <div className="flex-1 p-4">
          {isAudio && sequence.course_media_url && sequence.timeline_url && sequence.timeline_published ? (
            <div className="mb-6">
              <EnrichedTabSelector
                active={enrichedActiveTab}
                onChange={setEnrichedActiveTab}
                categoryGradient={categoryGradient}
              />
              <EnrichedAudioPlayer
                src={sequence.course_media_url}
                duration={sequence.course_duration_seconds || 0}
                sequenceId={sequence.id}
                sequenceTitle={sequence.title}
                learningObjectives={sequence.learning_objectives}
                coverImageUrl={coverImageUrl}
                onComplete={() => {}}
                onProgress={() => {}}
                accentColor={categoryGradient.from}
                accentColorSecondary={categoryGradient.to}
                timelineUrl={sequence.timeline_url ?? null}
                timelinePublished={sequence.timeline_published ?? false}
                activeTab={enrichedActiveTab}
                hideLegacyCardWhenEnriched={true}
                onPlayRequest={() =>
                  playAudio({
                    audioUrl: sequence.course_media_url!,
                    sequenceTitle: sequence.title,
                    formationTitle: '',
                    accentColor: categoryGradient.from,
                    sequenceId: sequence.id,
                    userId: '',
                    duration: sequence.course_duration_seconds || 0,
                    coverImageUrl: coverImageUrl || undefined,
                    onComplete: () => {},
                    onProgress: () => {},
                  })
                }
              />
            </div>
          ) : isAudio && sequence.course_media_url ? (
            <div className="mb-6">
              <AudioPlayer
                src={sequence.course_media_url}
                duration={sequence.course_duration_seconds || 0}
                sequenceId={sequence.id}
                sequenceTitle={sequence.title}
                learningObjectives={sequence.learning_objectives}
                coverImageUrl={coverImageUrl}
                onComplete={() => {}}
                onProgress={() => {}}
                accentColor={categoryGradient.from}
                accentColorSecondary={categoryGradient.to}
              />
            </div>
          ) : null}

          {mediaType === 'video' && sequence.course_media_url && (
            <div className="mb-6">
              <video
                src={sequence.course_media_url}
                controls
                className="w-full rounded-2xl"
              />
              {sequence.course_duration_seconds && (
                <p className="text-sm mt-2" style={{ color: '#a3a3a3' }}>
                  Durée : {Math.floor(sequence.course_duration_seconds / 60)} min
                </p>
              )}
            </div>
          )}

          {/* L'écran "Introduction terminée" + bouton de retour ne s'affiche
              qu'une fois l'audio terminé pour les intros audio. Pour les
              intros vidéo, on garde le comportement legacy (affichage
              immédiat) car on n'a pas de tracking de fin de lecture vidéo. */}
          {(!isAudio || audioMediaCompleted) && (
            <div className="mt-6 text-center">
              <p className="text-green-600 font-medium mb-4">Introduction terminée</p>
              <button
                onClick={() => onComplete(0, 0)}
                className="px-6 py-3 text-white rounded-xl font-medium"
                style={{ background: categoryGradient.from }}
              >
                Retour à la formation
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Séquence sans questions et sans média — aucun contenu
  if (questions.length === 0) {
    return (
      <div className="min-h-screen p-4 flex flex-col items-center justify-center" style={{ background: '#0F0F0F' }}>
        <p className="mb-4" style={{ color: '#a3a3a3' }}>Aucun contenu disponible</p>
        <button onClick={onBack} className="px-4 py-2 rounded-xl text-sm" style={{ background: '#242424', color: '#e5e5e5' }}>Retour</button>
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
    <div className="min-h-screen flex flex-col" style={{ background: '#0F0F0F' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 px-4 py-3 hidden md:flex items-center gap-3" style={{ background: '#1a1a1a', borderBottom: '0.5px solid #2a2a2a' }}>
        <button onClick={onBack} className="p-1 rounded-lg" style={{ color: '#a3a3a3' }}>
          <ChevronLeft size={20} />
        </button>
        <p className="flex-1 font-bold text-sm truncate" style={{ color: '#e5e5e5' }}>{sequence.title}</p>
        <span className="font-bold text-[13px] text-amber-600">⭐ {totalPoints}</span>
      </div>

      {/* Contenu — POC-T7.4-UX-F : pb-40 (160px) au lieu de pb-24 (96px) pour
          clear le MiniPlayer global flottant (`bottom-20` = 80px, hauteur ~70px,
          top à 150px du viewport bottom). pb-24 laissait 54px de contenu
          (notamment fenêtre karaoké) recouverts par le MiniPlayer. */}
      <div className="flex-1 p-4 overflow-auto pb-40">
        {/* COURS (VIDEO ou AUDIO) */}
        {playerStep === 'video' && (
          <div className="text-center py-6">
            {/* ─── AudioPlayer enrichi (POC-T7.3) ─── */}
            {mediaType === 'audio' && sequence.course_media_url && (
              <div className="mb-6">
                {sequence.timeline_url && sequence.timeline_published && (
                  <>
                    {/* POC-T7.4-UX-D : header compact mobile (Option α). Visible
                        uniquement en mode enriched mobile, le desktop a son
                        propre header sticky ligne ~625. Donne accès au drawer
                        Objectifs (T7.4-UX-E) qui restitue le contenu objectives
                        de l'ancienne card gradient (supprimée par T7.4-UX-B). */}
                    <div className="md:hidden mb-3 flex items-center gap-2">
                      <p className="flex-1 font-bold text-base truncate" style={{ color: '#e5e5e5' }}>
                        {sequence.title}
                      </p>
                      <button
                        type="button"
                        onClick={() => setObjectivesDrawerOpen(true)}
                        className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center transition-colors hover:bg-white/5"
                        style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a', color: '#a3a3a3' }}
                        aria-label="Objectifs de la séquence"
                      >
                        <Info size={20} />
                      </button>
                    </div>
                    <EnrichedTabSelector
                      active={enrichedActiveTab}
                      onChange={setEnrichedActiveTab}
                      categoryGradient={categoryGradient}
                    />
                  </>
                )}
                <EnrichedAudioPlayer
                  src={sequence.course_media_url}
                  duration={sequence.course_duration_seconds || 0}
                  sequenceId={sequence.id}
                  sequenceTitle={sequence.title}
                  learningObjectives={sequence.learning_objectives}
                  coverImageUrl={coverImageUrl}
                  onComplete={() => setCourseCompleted(true)}
                  onProgress={(percent) => setCourseProgress(percent)}
                  accentColor={categoryGradient.from}
                  accentColorSecondary={categoryGradient.to}
                  timelineUrl={sequence.timeline_url ?? null}
                  timelinePublished={sequence.timeline_published ?? false}
                  activeTab={enrichedActiveTab}
                  hideLegacyCardWhenEnriched={true}
                  onPlayRequest={() =>
                    playAudio({
                      audioUrl: sequence.course_media_url!,
                      sequenceTitle: sequence.title,
                      formationTitle: '',
                      accentColor: categoryGradient.from,
                      sequenceId: sequence.id,
                      userId: '',
                      duration: sequence.course_duration_seconds || 0,
                      coverImageUrl: coverImageUrl || undefined,
                      onComplete: () => setCourseCompleted(true),
                      onProgress: (percent) => setCourseProgress(percent),
                    })
                  }
                />
              </div>
            )}

            {/* ─── VideoPlayer ─── */}
            {mediaType === 'video' && sequence.course_media_url && (
              <div className="mb-6">
                <video
                  src={sequence.course_media_url}
                  controls
                  className="w-full rounded-2xl"
                  onEnded={() => setCourseCompleted(true)}
                  onTimeUpdate={(e) => {
                    const video = e.currentTarget
                    if (video.duration > 0) {
                      setCourseProgress(Math.floor((video.currentTime / video.duration) * 100))
                    }
                  }}
                />
                {sequence.course_duration_seconds && (
                  <p className="text-sm mt-2" style={{ color: '#a3a3a3' }}>
                    Durée : {Math.floor(sequence.course_duration_seconds / 60)} min
                  </p>
                )}
              </div>
            )}

            {/* ─── Pas de média ─── */}
            {(!sequence.course_media_type || !sequence.course_media_url) && (
              <p className="text-gray-500 italic mb-6">Pas de contenu média pour cette séquence</p>
            )}

            {hasMedia && !courseCompleted && !demoMode ? (
              <>
                <button
                  disabled
                  className="w-full max-w-xs py-4 rounded-2xl font-bold bg-gray-200 text-gray-400 cursor-not-allowed"
                >
                  Passer au Quiz
                </button>
                <p className="text-gray-400 text-xs text-center mt-2">
                  Écoutez 100% du cours pour débloquer le quiz
                </p>
              </>
            ) : (
              <>
                {/* Barre de navigation basse — mobile uniquement */}
                <div className="md:hidden flex gap-3 mt-4">
                  {/* Bouton retour */}
                  <button
                    onClick={onBack}
                    className="flex items-center justify-center gap-2 px-4 py-3 font-semibold rounded-2xl"
                    style={{ background: '#242424', color: '#e5e5e5' }}
                  >
                    <ArrowLeft size={18} />
                    Retour
                  </button>

                  {/* Bouton Quiz — prend le reste de la largeur */}
                  <button
                    onClick={() => setPlayerStep('quiz')}
                    className="flex-1 flex items-center justify-center gap-2 py-3
                               bg-primary text-white font-semibold rounded-2xl"
                  >
                    Passer au Quiz →
                  </button>
                </div>

                {/* Bouton Quiz desktop — inchangé */}
                <div className="hidden md:block mt-4">
                  <button
                    onClick={() => setPlayerStep('quiz')}
                    className="w-full max-w-xs py-4 rounded-2xl font-bold text-white bg-primary transition-transform active:scale-95"
                  >
                    Passer au Quiz →
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Spinner pendant le fetch du pool SM-2 entre quiz et review */}
        {reviewLoading && (
          <div className="text-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm" style={{ color: '#a3a3a3' }}>Préparation de la révision...</p>
          </div>
        )}

        {/* QUIZ + REVIEW + REMÉDIATION : même rendu, currentQuestion pivote selon playerStep */}
        {(playerStep === 'quiz' ||
          playerStep === 'review' ||
          (playerStep === 'bloc_remediation' && remediationStarted && !remediationDone)) &&
          currentQuestion && (() => {
          const q = currentQuestion
          const qType = q.question_type
          const isReview = playerStep === 'review'
          const isRemediation = playerStep === 'bloc_remediation'
          const isIsolated = isReview || isRemediation

          // case_study : choix sélectionné de la sous-question courante (les deux
          // formats — STRUCTURED et LEGACY_ARRAY — sont gérés par le composant).
          const caseStudyParsed = qType === 'case_study' ? parseCaseStudyData(q.options) : null
          const caseStudySubQId = caseStudyParsed?.questions[caseStudyCurrentQ]?.id ?? ''
          const caseStudySelectedId = caseStudyAnswers[caseStudySubQId] ?? null

          const stepIndex = isRemediation ? remediationIdx + 1 : isReview ? reviewIdx + 1 : currentQ + 1
          const stepTotal = isRemediation
            ? remediationQuestions.length
            : isReview
              ? reviewQuestions.length
              : questions.length

          return (
            <div>
              {/* Bandeau Révision SM-2 */}
              {isReview && (
                <div className="mb-3 rounded-2xl px-4 py-2.5" style={{ background: 'rgba(45,27,150,0.18)', border: '1px solid #2D1B96' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#a5b4fc' }}>Révision</p>
                  <p className="text-xs" style={{ color: '#e5e5e5' }}>
                    {reviewQuestions.length} question{reviewQuestions.length > 1 ? 's' : ''} du thème à consolider
                  </p>
                </div>
              )}

              {/* Bandeau Remédiation de bloc (PARTIE_A_v4 §2.4) */}
              {isRemediation && (
                <div className="mb-3 rounded-2xl px-4 py-2.5" style={{ background: 'rgba(245,158,11,0.14)', border: '1px solid #F59E0B' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#FBBF24' }}>
                    Bloc {blocGate?.bloc} — Remédiation
                  </p>
                  <p className="text-xs" style={{ color: '#e5e5e5' }}>
                    {stepTotal} question{stepTotal > 1 ? 's' : ''} à acquérir avant de continuer
                  </p>
                </div>
              )}

              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs" style={{ color: '#a3a3a3' }}>
                    {isRemediation ? 'Remédiation' : isReview ? 'Révision' : 'Question'} {stepIndex}/{stepTotal}
                  </span>
                  {!isIsolated && (
                    <span className="text-xs" style={{ color: '#a3a3a3' }}>⭐ {totalPoints} pts</span>
                  )}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#242424' }}>
                  <div className="h-full rounded-full transition-all duration-500" style={{ background: `linear-gradient(90deg, ${categoryGradient.from}, ${categoryGradient.to})`, width: `${(stepIndex / stepTotal) * 100}%` }} />
                </div>
              </div>

              {/* Type badge */}
              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold mb-3" style={{ background: '#242424', color: '#a3a3a3' }}>
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
                  <h2 className="text-[16px] font-bold leading-relaxed mb-5" style={{ color: '#e5e5e5' }}>{q.question_text}</h2>

              {/* === MCQ / TRUE_FALSE / MCQ_IMAGE === */}
              {(qType === 'mcq' || qType === 'true_false' || qType === 'mcq_image' || qType === 'image') && (
                <div className="flex flex-col gap-2.5">
                  {parseStandardOptions(q.options).map((opt, i) => {
                    const isSelected = selectedAnswer === opt.id
                    const isCorrect = opt.correct
                    let bg = '#242424', border = '#333', textColor = '#e5e5e5', badgeBg = '#333', badgeColor = '#a3a3a3'

                    if (isSelected && !showFeedback) { bg = 'rgba(45,27,150,0.25)'; border = '#2D1B96'; badgeBg = '#2D1B96'; badgeColor = 'white' }
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

              {/* === CASE STUDY (STRUCTURED + LEGACY_ARRAY) === */}
              {qType === 'case_study' && (
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
              {qType === 'checkbox' && (
                <>
                  <p className="text-xs mb-3" style={{ color: '#60a5fa' }}>☑️ Plusieurs réponses possibles — cochez puis validez</p>
                  <div className="flex flex-col gap-2.5">
                    {parseStandardOptions(q.options).map((opt) => {
                      const isSelected = selectedAnswers.includes(opt.id)
                      const isCorrect = opt.correct
                      let bg = '#242424', border = '#333', textColor = '#e5e5e5'
                      if (isSelected && !showFeedback) { bg = 'rgba(45,27,150,0.25)'; border = '#2D1B96' }
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
                  <p className="text-xs mb-3" style={{ color: '#fb7185' }}>🚫 Barrez les intrus en les sélectionnant</p>
                  <div className="flex flex-col gap-2.5">
                    {parseStandardOptions(q.options).map((opt) => {
                      const isSelected = selectedAnswers.includes(opt.id)
                      const isIntrus = !opt.correct
                      let bg = '#242424', border = '#333', textColor = '#e5e5e5', textDeco = 'none'
                      if (isSelected && !showFeedback) { bg = 'rgba(69,10,10,0.35)'; border = '#ef4444'; textDeco = 'line-through' }
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
                    <p className="text-xs mb-3" style={{ color: '#818cf8' }}>
                      {hasWordBank ? '📝 Sélectionnez un mot de la banque pour chaque blanc' : '📝 Tapez votre réponse'}
                    </p>
                    
                    {/* Blanks */}
                    <div className="p-4 rounded-2xl border-2 mb-4 space-y-3" style={{ background: '#1a1a1a', borderColor: '#333' }}>
                      {opts.blanks.map((blank, idx) => {
                        const answer = fillBlankAnswers[blank.id]
                        const isCorrect = answer && (
                          answer.toLowerCase().trim() === blank.correctAnswer.toLowerCase().trim() ||
                          blank.alternatives?.some(alt => alt.toLowerCase().trim() === answer.toLowerCase().trim())
                        )
                        
                        return (
                          <div key={blank.id} className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium" style={{ color: '#a3a3a3' }}>
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
                                  borderColor: showFeedback ? (isCorrect ? '#4ADE80' : '#FCA5A5') : '#333',
                                  background: showFeedback ? (isCorrect ? '#052e16' : '#450a0a') : '#242424',
                                  color: showFeedback ? (isCorrect ? '#4ade80' : '#f87171') : '#e5e5e5',
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
                              background: showFeedback ? (isCorrectPos ? '#052e16' : '#450a0a') : '#242424',
                              borderColor: showFeedback ? (isCorrectPos ? '#4ADE80' : '#FCA5A5') : '#333',
                            }}>
                            <span className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                              style={{ background: showFeedback ? (isCorrectPos ? '#22C55E' : '#EF4444') : categoryGradient.from, color: 'white' }}>
                              {index + 1}
                            </span>
                            <span className="flex-1 text-sm font-semibold" style={{ color: '#e5e5e5' }}>{item.text}</span>
                            {!showFeedback && (
                              <div className="flex flex-col">
                                <button onClick={() => moveItem(index, index - 1)} disabled={index === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                                  <ChevronUp size={16} style={{ color: '#a3a3a3' }} />
                                </button>
                                <button onClick={() => moveItem(index, index + 1)} disabled={index === orderingOrder.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                                  <ChevronDown size={16} style={{ color: '#a3a3a3' }} />
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
                const data = parseMatchingData(q.options, q.id)
                if (!data || data.leftItems.length === 0) {
                  return <p className="text-gray-500">Format de question non supporté</p>
                }
                const rights = shuffledMatchingRights.length > 0 ? shuffledMatchingRights : data.rightOptions
                const matchByLeft = new Map(matchingMatches.map(m => [m.leftKey, m]))
                const matchByRight = new Map(matchingMatches.map(m => [m.rightId, m]))

                return (
                  <>
                    <p className="text-xs mb-3" style={{ color: '#2DD4BF' }}>🔗 Cliquez sur un élément gauche puis son correspondant à droite. Re-cliquez sur un item déjà associé pour défaire la paire.</p>
                    <div className="grid grid-cols-2 gap-3">
                      {/* Gauche */}
                      <div className="flex flex-col gap-2">
                        {data.leftItems.map((li) => {
                          const match = matchByLeft.get(li.left)
                          const color = match ? colorForPairIndex(match.pairIndex) : null
                          const isSelected = selectedLeftMatching === li.left
                          const isCorrect = showFeedback && match && match.rightId === li.correctRightId
                          const isWrong = showFeedback && match && match.rightId !== li.correctRightId
                          const usePairColor = !!match && !showFeedback
                          const pairClasses = usePairColor && color ? `${color.bg} ${color.border} ${color.text}` : ''

                          const inlineBg = showFeedback ? (isCorrect ? '#052e16' : isWrong ? '#450a0a' : '#242424')
                            : usePairColor ? undefined
                            : isSelected ? `${categoryGradient.from}30`
                            : '#242424'
                          const inlineBorderColor = showFeedback ? (isCorrect ? '#4ADE80' : isWrong ? '#FCA5A5' : '#333')
                            : usePairColor ? undefined
                            : isSelected ? categoryGradient.from
                            : '#333'

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
                              className={`p-3 rounded-xl text-left text-sm font-semibold transition-all flex items-center gap-3 border-2 ${pairClasses}`}
                              style={{
                                ...(inlineBg !== undefined ? { background: inlineBg } : {}),
                                ...(inlineBorderColor !== undefined ? { borderColor: inlineBorderColor } : {}),
                                color: usePairColor ? undefined : '#e5e5e5',
                              }}>
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
                      {/* Droite */}
                      <div className="flex flex-col gap-2">
                        {rights.map((ro) => {
                          const match = matchByRight.get(ro.id)
                          const color = match ? colorForPairIndex(match.pairIndex) : null
                          const usePairColor = !!match && !showFeedback
                          const pairClasses = usePairColor && color ? `${color.bg} ${color.border} ${color.text}` : ''

                          const inlineBg = usePairColor ? undefined
                            : match ? '#2a2a2a'
                            : selectedLeftMatching ? `${categoryGradient.from}20`
                            : '#242424'
                          const inlineBorderColor = usePairColor ? undefined
                            : match ? '#444'
                            : '#333'

                          return (
                            <button key={ro.id}
                              onClick={() => {
                                if (showFeedback || match || !selectedLeftMatching) return
                                setMatchingMatches(prev => [...prev, { leftKey: selectedLeftMatching, rightId: ro.id, pairIndex: nextPairIndex(prev) }])
                                setSelectedLeftMatching(null)
                              }}
                              disabled={showFeedback || !!match}
                              className={`p-3 rounded-xl text-left text-sm font-semibold transition-all flex items-center gap-3 border-2 ${pairClasses}`}
                              style={{
                                ...(inlineBg !== undefined ? { background: inlineBg } : {}),
                                ...(inlineBorderColor !== undefined ? { borderColor: inlineBorderColor } : {}),
                                color: usePairColor ? undefined : '#e5e5e5',
                              }}>
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
                    {!showFeedback && (
                      <button onClick={handleMatchingValidate} disabled={matchingMatches.length < data.leftItems.length}
                        className="w-full mt-4 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40" style={{ background: categoryGradient.from }}>
                        Valider les associations
                      </button>
                    )}
                  </>
                )
              })()}

              {/* === TYPE NON SUPPORTÉ === */}
              {!['mcq', 'true_false', 'mcq_image', 'image', 'checkbox', 'highlight', 'fill_blank', 'ordering', 'matching', 'drag_drop', 'case_study'].includes(qType) && (
                <div className="text-center py-8">
                  <AlertCircle size={48} className="text-amber-500 mx-auto mb-3" />
                  <p className="mb-2" style={{ color: '#a3a3a3' }}>Type &quot;{qType}&quot; non encore implémenté</p>
                  <button onClick={skipQuestion} className="px-6 py-3 rounded-xl text-white font-bold" style={{ background: categoryGradient.from }}>
                    Passer cette question
                  </button>
                </div>
              )}
                </div>{/* close question+options wrapper */}
              </div>{/* close flex layout wrapper */}
            </div>
          )
        })()}

        {/* PDF step removed - handled by TreasureChest in results */}

        {/* Spinner pendant le chargement / rechargement de la remédiation */}
        {playerStep === 'bloc_remediation' && remediationLoading && (
          <div className="text-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
            <p className="text-sm" style={{ color: '#a3a3a3' }}>Préparation de la remédiation...</p>
          </div>
        )}

        {/* REMÉDIATION — écran d'introduction : liste des questions à acquérir,
            regroupées par séquence d'origine (PARTIE_A_v4 §2.4) */}
        {playerStep === 'bloc_remediation' && !remediationStarted && !remediationDone && !remediationLoading && (() => {
          const groups: { title: string; count: number }[] = []
          for (const rq of remediationQuestions) {
            const last = groups[groups.length - 1]
            if (last && last.title === rq.sequence_title) {
              last.count += 1
            } else {
              groups.push({ title: rq.sequence_title, count: 1 })
            }
          }
          return (
            <div className="py-4">
              <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.16)' }}>
                <AlertCircle size={32} className="text-amber-500" />
              </div>
              <h2 className="text-[22px] font-extrabold text-center mb-1" style={{ color: '#e5e5e5' }}>
                Bloc {blocGate?.bloc} — Remédiation
              </h2>
              <p className="text-sm text-center mb-5" style={{ color: '#a3a3a3' }}>
                {remediationInitialCount} question{remediationInitialCount > 1 ? 's' : ''} à acquérir avant de continuer
              </p>

              <div className="space-y-3 mb-6">
                {groups.map((g, i) => (
                  <div key={i} className="rounded-2xl px-4 py-3 flex items-center justify-between" style={{ background: '#242424', border: '0.5px solid #333' }}>
                    <span className="text-sm font-semibold pr-3" style={{ color: '#e5e5e5' }}>{g.title}</span>
                    <span className="text-xs font-bold shrink-0 px-2.5 py-1 rounded-full" style={{ background: 'rgba(245,158,11,0.16)', color: '#FBBF24' }}>
                      {g.count} question{g.count > 1 ? 's' : ''}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setRemediationStarted(true)}
                className="w-full max-w-xs mx-auto block py-4 rounded-2xl font-bold text-white"
                style={{ background: categoryGradient.from }}
              >
                Reprendre les questions
              </button>
            </div>
          )
        })()}

        {/* REMÉDIATION — écran de succès : toutes les questions du bloc acquises */}
        {playerStep === 'bloc_remediation' && remediationDone && (
          <div className="text-center py-8">
            <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center animate-in zoom-in duration-300" style={{ background: 'linear-gradient(135deg, #34D399, #059669)' }}>
              <CheckCircle2 size={48} className="text-white" />
            </div>
            <h2 className="text-[22px] font-extrabold mb-1" style={{ color: '#e5e5e5' }}>
              Bloc {blocGate?.bloc} validé ! ✅
            </h2>
            <p className="text-sm mb-6" style={{ color: '#a3a3a3' }}>
              Toutes les questions du bloc sont acquises.
            </p>
            <button
              onClick={() => setPlayerStep('results')}
              className="w-full max-w-xs py-4 rounded-2xl font-bold text-white"
              style={{ background: categoryGradient.from }}
            >
              Continuer
            </button>
          </div>
        )}

        {/* RÉSULTATS */}
        {playerStep === 'results' && (
          <div className="text-center py-5">
            <div className="w-28 h-28 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: `conic-gradient(${score >= 75 ? '#22C55E' : score >= 50 ? '#FBBF24' : '#EF4444'} ${score * 3.6}deg, #E2E8F0 0deg)` }}>
              <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center" style={{ background: '#0F0F0F' }}>
                <span className="text-3xl font-extrabold" style={{ color: '#e5e5e5' }}>{score}%</span>
              </div>
            </div>
            <h2 className="text-[22px] font-extrabold mb-1" style={{ color: '#e5e5e5' }}>
              {score === 100 ? 'Parfait ! 🏆' : score >= 75 ? 'Excellent ! ✨' : score >= 50 ? 'Bien joué ! 💪' : 'Continue ! 📚'}
            </h2>
            <p className="text-sm mb-6" style={{ color: '#a3a3a3' }}>{correctCount}/{questions.length} bonnes réponses</p>
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-100 to-amber-200 rounded-2xl px-5 py-4 mb-6">
              <span className="text-3xl">⭐</span>
              <div className="text-left">
                <p className="text-2xl font-extrabold text-amber-700">+{totalPoints}</p>
                <p className="text-xs text-amber-700">points gagnés</p>
              </div>
            </div>
            {showPdf ? (
              <div className="mt-2">
                <TreasureChest
                  pdfUrl={sequence.infographic_url}
                  onOpen={() => console.log('Coffre ouvert !')}
                />
                <div className="mt-4">
                  <button onClick={finishSequence} disabled={submitting} className="w-full max-w-xs py-4 rounded-2xl font-bold text-white disabled:opacity-50" style={{ background: categoryGradient.from }}>
                    {submitting ? 'Enregistrement...' : 'Terminer'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <button onClick={finishSequence} disabled={submitting} className="w-full max-w-xs py-4 rounded-2xl font-bold text-white disabled:opacity-50" style={{ background: categoryGradient.from }}>
                  {submitting ? 'Enregistrement...' : 'Terminer'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Overlay Feedback */}
      {showOverlay && overlayData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="
            w-full rounded-3xl overflow-hidden shadow-2xl
            flex flex-col
            max-h-[80vh]
            sm:max-w-2xl sm:max-h-[75vh]
            lg:max-w-3xl
          " style={{ background: '#1a1a1a' }}>

            {/* Header coloré — compact sur mobile */}
            <div className={`flex items-center gap-4 px-6 py-4 shrink-0 ${
              overlayData.isCorrect
                ? 'bg-gradient-to-r from-emerald-400 to-emerald-600'
                : 'bg-gradient-to-r from-red-400 to-red-600'
            }`}>
              <div className="w-10 h-10 shrink-0 bg-white rounded-full flex items-center justify-center">
                {overlayData.isCorrect
                  ? <CheckCircle2 size={22} className="text-emerald-500" />
                  : <XCircle size={22} className="text-red-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-white font-black text-lg leading-tight">
                  {overlayData.isCorrect ? 'Bravo !' : 'Pas tout à fait…'}
                </h3>
                <span className="text-white/80 text-sm font-semibold">
                  {overlayData.isCorrect ? `+${overlayData.points} points` : '0 point'}
                </span>
              </div>
            </div>

            {/* Feedback — scrollable si nécessaire */}
            <div className="flex-1 overflow-y-auto px-6 py-5 min-h-0">
              <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: '#6b7280' }}>
                Explication
              </p>
              <p className="text-sm leading-relaxed sm:text-base" style={{ color: '#e5e5e5' }}>
                {overlayData.feedback}
              </p>
            </div>

            {/* Bouton fixe en bas */}
            <div className="shrink-0 px-6 py-4" style={{ background: '#1a1a1a', borderTop: '0.5px solid #2a2a2a' }}>
              <button
                onClick={nextQuestion}
                className="w-full py-4 rounded-2xl font-black text-white text-[15px] transition-all active:scale-[0.98] hover:opacity-95"
                style={{
                  background: overlayData.isCorrect
                    ? 'linear-gradient(135deg, #34D399, #059669)'
                    : 'linear-gradient(135deg, #F87171, #DC2626)'
                }}
              >
                {overlayData.isLast ? 'Voir mes résultats' : 'Question suivante'}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* POC-T7.4-UX-E : drawer Objectifs mobile (bottom sheet). Restitue le
          contenu objectives qui vivait dans la card gradient legacy supprimée
          par T7.4-UX-B. md:hidden — desktop garde son header sticky et la
          card legacy en mode audio_only. */}
      {objectivesDrawerOpen && (
        <ObjectivesDrawer
          title={sequence.title}
          objectives={sequence.learning_objectives ?? null}
          onClose={() => setObjectivesDrawerOpen(false)}
        />
      )}
    </div>
  )
}

// POC-T7.4a-D — Reskin segmented control dark + accent gradient catégorie
// (Maquette 1 validée par Dr Fantin le 2026-05-10). Design désormais cohérent
// avec l'AudioPlayer card juste en dessous (qui utilise déjà le même gradient
// `categoryGradient.from → .to`). Q2 (3 tabs Combiné/Whiteboard/Audio seul)
// inchangé. Composant gardé inline (Option A T7.3.1, validation Dr Fantin —
// pas d'extraction en composant séparé en T7.4a).
function EnrichedTabSelector({
  active,
  onChange,
  categoryGradient,
}: {
  active: EnrichedPlayerTab
  onChange: (tab: EnrichedPlayerTab) => void
  categoryGradient: { from: string; to: string }
}) {
  const tabs: { id: EnrichedPlayerTab; label: string; hint: string }[] = [
    { id: 'combined', label: 'Combiné', hint: 'Karaoké + Whiteboard' },
    { id: 'whiteboard', label: 'Whiteboard', hint: 'Visuels seuls' },
    { id: 'audio_only', label: 'Audio seul', hint: 'Player nu (pas d\'enrichissement)' },
  ]
  return (
    <div className="flex justify-center mb-4">
      <div
        className="inline-flex items-center gap-1 rounded-full p-1"
        style={{ background: '#1a1a1a', border: '0.5px solid #2a2a2a' }}
        role="tablist"
      >
        {tabs.map((t) => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              onClick={() => onChange(t.id)}
              className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${
                isActive
                  ? 'text-white shadow-sm'
                  : 'text-[#a3a3a3] hover:text-[#e5e5e5] hover:bg-white/5'
              }`}
              style={
                isActive
                  ? {
                      background: `linear-gradient(135deg, ${categoryGradient.from}, ${categoryGradient.to})`,
                    }
                  : undefined
              }
              role="tab"
              aria-selected={isActive}
              title={t.hint}
              type="button"
            >
              {t.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// POC-T7.4-UX-E — Drawer Objectifs mobile (bottom sheet). Pattern aligné sur
// `NewsModal.tsx` (fixed inset-0 z-50 + items-end mobile). useState local côté
// SequencePlayer (pas de localStorage). Fermeture : tap backdrop ou bouton X.
function ObjectivesDrawer({
  title,
  objectives,
  onClose,
}: {
  title: string
  objectives: string[] | null
  onClose: () => void
}) {
  return (
    <div
      className="md:hidden fixed inset-0 z-50 bg-black/60 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Objectifs de la séquence"
    >
      <div
        className="w-full rounded-t-3xl max-h-[85vh] overflow-y-auto relative pb-safe"
        style={{ background: '#1a1a1a', borderTop: '0.5px solid #2a2a2a' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle visuel (cue iOS sheet) */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.18)' }} />
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/5 transition-colors"
          style={{ background: '#242424', color: '#a3a3a3' }}
        >
          <X size={18} />
        </button>

        <div className="px-5 py-4">
          <p className="font-bold text-xl pr-12 leading-snug" style={{ color: '#e5e5e5' }}>
            {title}
          </p>

          {objectives && objectives.length > 0 ? (
            <>
              <p className="text-xs uppercase tracking-wider mt-5 mb-3" style={{ color: '#a3a3a3' }}>
                À l'issue de cette séquence
              </p>
              <ul className="space-y-3">
                {objectives.map((obj, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(255,255,255,0.08)' }}
                    >
                      <Check size={12} style={{ color: '#e5e5e5' }} />
                    </span>
                    <p className="text-sm leading-snug" style={{ color: '#e5e5e5' }}>{obj}</p>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="text-sm mt-3" style={{ color: '#a3a3a3' }}>
              Aucun objectif renseigné pour cette séquence.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
