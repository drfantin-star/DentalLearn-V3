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
} from 'lucide-react'

interface DailyQuestion {
  id: string
  question_text: string
  options: {
    choices?: { id: string; text: string; is_correct: boolean }[]
    correct_answer?: boolean
  }
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
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)

  // Timer per question
  const [timeLeft, setTimeLeft] = useState(60)

  useEffect(() => {
    fetchQuestions()
  }, [])

  // Question timer
  useEffect(() => {
    if (loading || finished || showFeedback) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          // Time's up - mark as incorrect
          handleTimeout()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [current, loading, finished, showFeedback])

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

  const handleTimeout = useCallback(() => {
    if (showFeedback) return
    setIsCorrect(false)
    setShowFeedback(true)
  }, [showFeedback])

  const answerQCM = (choiceId: string) => {
    if (showFeedback) return
    const q = questions[current]
    const choice = q.options.choices?.find((c) => c.id === choiceId)
    const correct = choice?.is_correct || false

    setSelectedAnswer(choiceId)
    setIsCorrect(correct)
    if (correct) {
      setScore((s) => s + 1)
      setTotalPoints((p) => p + q.points)
    }
    setShowFeedback(true)
  }

  const answerTrueFalse = (val: boolean) => {
    if (showFeedback) return
    const q = questions[current]
    const correct = val === q.options.correct_answer

    setSelectedAnswer(val ? 'true' : 'false')
    setIsCorrect(correct)
    if (correct) {
      setScore((s) => s + 1)
      setTotalPoints((p) => p + q.points)
    }
    setShowFeedback(true)
  }

  const next = async () => {
    setShowFeedback(false)
    setSelectedAnswer(null)
    setTimeLeft(60)

    if (current < questions.length - 1) {
      setCurrent((c) => c + 1)
    } else {
      // Quiz finished - save results
      setFinished(true)
      await saveResults()
    }
  }

  const saveResults = async () => {
    setSaving(true)
    try {
      // Calculate final score and bonus
      const finalScore = score + (isCorrect ? 1 : 0) // Include current answer if last
      const perfectBonus = finalScore === questions.length ? 50 : 0
      const earnedPoints = totalPoints + (isCorrect ? questions[current]?.points || 0 : 0) + perfectBonus

      await fetch('/api/daily-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          score: finalScore,
          total_questions: questions.length,
          total_points: earnedPoints,
          question_ids: questions.map((q) => q.id),
        }),
      })
    } catch (err) {
      console.error('Error saving quiz results:', err)
    } finally {
      setSaving(false)
    }
  }

  // Loading state
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

  // Error state
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
          {/* Confetti */}
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

            {/* Points breakdown */}
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

  // Quiz screen
  const q = questions[current]
  const progress = ((current + 1) / questions.length) * 100
  const isQCM = q.question_type === 'qcm' || q.question_type === 'qcm_image'
  const isTrueFalse = q.question_type === 'true_false'

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Top bar */}
      <div className="flex-shrink-0">
        {/* Progress bar */}
        <div className="h-1.5 bg-gray-100">
          <div
            className="h-full bg-gradient-to-r from-[#2D1B96] to-[#00D1C1] transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-gray-700">
              {current + 1}/{questions.length}
            </span>
            {/* Timer */}
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

          {/* Score */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-[#2D1B96]">
              {score} pts
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
          <div className="inline-flex items-center px-2.5 py-1 rounded-lg bg-[#2D1B96]/10 text-[#2D1B96] text-xs font-medium mb-4">
            {q.formation_title}
          </div>
        )}

        {/* Question text */}
        <h3 className="text-lg font-bold text-gray-900 leading-snug mb-6">
          {q.question_text}
        </h3>

        {!showFeedback ? (
          <>
            {/* QCM answers */}
            {isQCM && q.options.choices && (
              <div className="space-y-3">
                {q.options.choices.map((choice) => (
                  <button
                    key={choice.id}
                    onClick={() => answerQCM(choice.id)}
                    className="w-full text-left p-4 rounded-2xl border-2 border-gray-100 bg-white hover:border-[#2D1B96]/30 hover:bg-[#2D1B96]/5 transition-all active:scale-[0.98]"
                  >
                    <span className="text-sm text-gray-800 font-medium">
                      {choice.text}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* True/False answers */}
            {isTrueFalse && (
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => answerTrueFalse(true)}
                  className="h-24 rounded-2xl bg-emerald-50 border-2 border-emerald-100 flex flex-col items-center justify-center gap-2 hover:bg-emerald-100 hover:border-emerald-300 hover:scale-[1.02] transition-all active:scale-95"
                >
                  <CheckCircle2 size={28} className="text-emerald-600" />
                  <span className="text-lg font-black text-emerald-700">
                    VRAI
                  </span>
                </button>
                <button
                  onClick={() => answerTrueFalse(false)}
                  className="h-24 rounded-2xl bg-red-50 border-2 border-red-100 flex flex-col items-center justify-center gap-2 hover:bg-red-100 hover:border-red-300 hover:scale-[1.02] transition-all active:scale-95"
                >
                  <X size={28} className="text-red-600" />
                  <span className="text-lg font-black text-red-700">FAUX</span>
                </button>
              </div>
            )}
          </>
        ) : (
          /* Feedback */
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
              <div>
                <span
                  className={`text-lg font-bold ${
                    isCorrect ? 'text-emerald-800' : 'text-red-800'
                  }`}
                >
                  {isCorrect ? 'Exact !' : 'Incorrect'}
                </span>
                {isCorrect && (
                  <span className="ml-2 text-sm text-emerald-600">
                    +{q.points} pts
                  </span>
                )}
              </div>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed mb-4">
              {isCorrect ? q.feedback_correct : q.feedback_incorrect}
            </p>
            <button
              onClick={next}
              className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-gray-800 transition-colors"
            >
              {current < questions.length - 1 ? 'Suivant' : 'Voir mon score'}
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
