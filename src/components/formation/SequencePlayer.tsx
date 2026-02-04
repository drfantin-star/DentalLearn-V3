'use client'

import React, { useState, useMemo } from 'react'
import {
  ChevronLeft,
  Check,
  X,
  Download,
  Lightbulb,
  Loader2,
  Square,
  CheckSquare,
} from 'lucide-react'
import {
  useSequenceQuestions,
  useSubmitSequenceResult,
  type Sequence,
} from '@/lib/supabase'

// ============================================
// TYPES
// ============================================

interface SequencePlayerProps {
  sequence: Sequence
  categoryGradient: { from: string; to: string }
  onBack: () => void
  onComplete: (score: number, totalPoints: number) => void
}

type PlayerStep = 'video' | 'quiz' | 'pdf' | 'results'

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

  // États du player
  const hasVideo = !!sequence.course_media_url
  const hasPdf = !!sequence.infographic_url
  
  const [playerStep, setPlayerStep] = useState<PlayerStep>(hasVideo ? 'video' : 'quiz')
  const [currentQ, setCurrentQ] = useState(0)
  
  // Pour QCM simple / Vrai-Faux : une seule réponse
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  
  // Pour Checkbox : plusieurs réponses possibles
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  
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
  const [answers, setAnswers] = useState<{
    question_id: string
    selected_option: string
    is_correct: boolean
    points_earned: number
  }[]>([])
  const [startTime] = useState(Date.now())

  // Étapes disponibles
  const steps: PlayerStep[] = useMemo(() => {
    const s: PlayerStep[] = []
    if (hasVideo) s.push('video')
    s.push('quiz')
    if (hasPdf) s.push('pdf')
    return s
  }, [hasVideo, hasPdf])

  const currentStepIdx = steps.indexOf(playerStep === 'results' ? 'quiz' : playerStep)

  // Question actuelle
  const currentQuestion = questions[currentQ]
  const isCheckbox = currentQuestion?.question_type === 'checkbox'

  // ============================================
  // HANDLERS — QCM Simple / Vrai-Faux
  // ============================================
  
  const handleSingleAnswer = (answerId: string) => {
    if (showFeedback || selectedAnswer) return
    setSelectedAnswer(answerId)

    const q = questions[currentQ]
    const selected = q.options.find((o) => o.id === answerId)
    const isCorrect = selected?.correct || false
    const points = isCorrect ? q.points : 0

    if (isCorrect) {
      setCorrectCount((c) => c + 1)
    }
    setTotalPoints((p) => p + points)

    setAnswers((prev) => [
      ...prev,
      {
        question_id: q.id,
        selected_option: answerId,
        is_correct: isCorrect,
        points_earned: points,
      },
    ])

    setShowFeedback(true)
    setOverlayData({
      isCorrect,
      points,
      feedback: isCorrect ? q.feedback_correct : q.feedback_incorrect,
      isLast: currentQ === questions.length - 1,
    })
    setShowOverlay(true)
  }

  // ============================================
  // HANDLERS — Checkbox (choix multiples)
  // ============================================

  const toggleCheckboxAnswer = (answerId: string) => {
    if (showFeedback) return
    
    setSelectedAnswers((prev) => {
      if (prev.includes(answerId)) {
        return prev.filter((id) => id !== answerId)
      } else {
        return [...prev, answerId]
      }
    })
  }

  const validateCheckboxAnswer = () => {
    if (showFeedback || selectedAnswers.length === 0) return

    const q = questions[currentQ]
    
    // Trouver toutes les réponses correctes
    const correctOptionIds = q.options.filter((o) => o.correct).map((o) => o.id)
    
    // Vérifier si l'utilisateur a coché exactement les bonnes réponses
    const allCorrectSelected = correctOptionIds.every((id) => selectedAnswers.includes(id))
    const noIncorrectSelected = selectedAnswers.every((id) => correctOptionIds.includes(id))
    const isFullyCorrect = allCorrectSelected && noIncorrectSelected

    // Calcul des points (partiel possible)
    let points = 0
    if (isFullyCorrect) {
      points = q.points
    } else {
      // Points partiels : proportion de bonnes réponses
      const correctSelected = selectedAnswers.filter((id) => correctOptionIds.includes(id)).length
      const incorrectSelected = selectedAnswers.filter((id) => !correctOptionIds.includes(id)).length
      const partialScore = Math.max(0, correctSelected - incorrectSelected) / correctOptionIds.length
      points = Math.round(q.points * partialScore)
    }

    if (isFullyCorrect) {
      setCorrectCount((c) => c + 1)
    }
    setTotalPoints((p) => p + points)

    setAnswers((prev) => [
      ...prev,
      {
        question_id: q.id,
        selected_option: selectedAnswers.join(','),
        is_correct: isFullyCorrect,
        points_earned: points,
      },
    ])

    setShowFeedback(true)
    setOverlayData({
      isCorrect: isFullyCorrect,
      points,
      feedback: isFullyCorrect ? q.feedback_correct : q.feedback_incorrect,
      isLast: currentQ === questions.length - 1,
    })
    setShowOverlay(true)
  }

  // ============================================
  // Question suivante
  // ============================================

  const nextQuestion = () => {
    setShowOverlay(false)
    setShowFeedback(false)
    setSelectedAnswer(null)
    setSelectedAnswers([])

    if (currentQ < questions.length - 1) {
      setCurrentQ((c) => c + 1)
    } else {
      setPlayerStep('results')
    }
  }

  // ============================================
  // Terminer séquence
  // ============================================

  const finishSequence = async () => {
    try {
      await submitResult({
        sequenceId: sequence.id,
        score: Math.round((correctCount / questions.length) * 100),
        totalPoints,
        timeSpentSeconds: Math.round((Date.now() - startTime) / 1000),
        answers,
      })
    } catch (err) {
      console.error('Erreur soumission:', err)
    }

    onComplete(correctCount, totalPoints)
  }

  // Score final
  const score = questions.length > 0 
    ? Math.round((correctCount / questions.length) * 100) 
    : 0

  // ============================================
  // RENDU — Loading / Error
  // ============================================

  if (loadingQuestions) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFF]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96] mx-auto mb-3" />
          <p className="text-sm text-gray-500">Chargement des questions...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFF] p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">Erreur : {error.message}</p>
          <button onClick={onBack} className="px-4 py-2 bg-gray-100 rounded-xl text-sm">
            Retour
          </button>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAFF] p-4">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Aucune question pour cette séquence</p>
          <button onClick={onBack} className="px-4 py-2 bg-gray-100 rounded-xl text-sm">
            Retour
          </button>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDU PRINCIPAL
  // ============================================

  return (
    <div className="min-h-screen bg-[#FAFAFF] flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ChevronLeft size={20} className="text-gray-600" />
        </button>
        <p className="flex-1 font-bold text-sm text-gray-800 truncate">
          {sequence.title}
        </p>
        <span className="font-bold text-[13px] text-amber-600">
          ⭐ {totalPoints}
        </span>
      </div>

      {/* Stepper */}
      <div className="bg-white px-4 py-3 flex items-center justify-center gap-2">
        {steps.map((step, i) => {
          const isActive = (playerStep === 'results' ? 'quiz' : playerStep) === step
          const isDone = playerStep === 'results' ? true : i < currentStepIdx
          const label =
            step === 'video' ? '📹 Vidéo' : step === 'quiz' ? '📝 Quiz' : '📄 PDF'

          return (
            <div key={step} className="flex items-center gap-2">
              <div
                className="px-3.5 py-1.5 rounded-2xl text-xs font-semibold transition-all"
                style={{
                  background: isActive
                    ? categoryGradient.from
                    : isDone
                    ? '#DCFCE7'
                    : '#F1F5F9',
                  color: isActive ? 'white' : isDone ? '#15803D' : '#94A3B8',
                }}
              >
                {isDone && !isActive ? '✓ ' : ''}
                {label}
              </div>
              {i < steps.length - 1 && (
                <div
                  className="w-5 h-0.5"
                  style={{ background: isDone ? '#86EFAC' : '#E2E8F0' }}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Contenu */}
      <div className="flex-1 p-4 overflow-auto">
        
        {/* VIDEO */}
        {playerStep === 'video' && (
          <div className="text-center py-10">
            <div className="w-full aspect-video bg-gray-900 rounded-2xl flex items-center justify-center mb-6">
              <p className="text-white/60 text-sm">
                🎬 Lecteur vidéo à intégrer
              </p>
            </div>
            <button
              onClick={() => setPlayerStep('quiz')}
              className="w-full max-w-xs py-4 rounded-2xl font-bold text-[15px] text-white"
              style={{ background: categoryGradient.from }}
            >
              Passer au Quiz →
            </button>
          </div>
        )}

        {/* QUIZ */}
        {playerStep === 'quiz' && currentQuestion && (() => {
          const q = currentQuestion
          const isTF = q.question_type === 'true_false'

          return (
            <div>
              {/* Progress */}
              <div className="mb-4">
                <div className="flex justify-between mb-1.5">
                  <span className="text-xs text-gray-500">
                    Question {currentQ + 1}/{questions.length}
                  </span>
                  <span className="text-xs text-gray-500">⭐ {totalPoints} pts</span>
                </div>
                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      background: `linear-gradient(90deg, ${categoryGradient.from}, ${categoryGradient.to})`,
                      width: `${((currentQ + 1) / questions.length) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Type badge */}
              <span className="inline-block bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[11px] font-semibold mb-3">
                {q.question_type === 'mcq' ? 'QCM' : 
                 q.question_type === 'true_false' ? 'Vrai/Faux' : 
                 q.question_type === 'checkbox' ? 'Choix multiples' :
                 q.question_type.toUpperCase()}
              </span>

              {/* Instruction pour checkbox */}
              {isCheckbox && !showFeedback && (
                <p className="text-xs text-blue-600 mb-2">
                  ☑️ Plusieurs réponses possibles — cochez puis validez
                </p>
              )}

              {/* Image si présente */}
              {q.image_url && (
                <div className="mb-4">
                  <img
                    src={q.image_url}
                    alt="Question"
                    className="w-full rounded-xl border border-gray-200"
                  />
                </div>
              )}

              {/* Question */}
              <h2 className="text-[16px] font-bold text-gray-800 leading-relaxed mb-5">
                {q.question_text}
              </h2>

              {/* Options */}
              <div className="flex flex-col gap-2.5">
                {q.options.map((opt, i) => {
                  // État de l'option
                  const isSelectedSingle = selectedAnswer === opt.id
                  const isSelectedMultiple = selectedAnswers.includes(opt.id)
                  const isSelected = isCheckbox ? isSelectedMultiple : isSelectedSingle
                  const isCorrect = opt.correct

                  // Couleurs par défaut
                  let bg = '#FAFAFF'
                  let border = '#E2E8F0'
                  let textColor = '#334155'
                  let badgeBg = '#E2E8F0'
                  let badgeColor = '#64748B'

                  // État sélectionné (avant validation)
                  if (isSelected && !showFeedback) {
                    bg = '#F1F5F9'
                    border = '#94A3B8'
                    badgeBg = '#475569'
                    badgeColor = 'white'
                  }

                  // Après validation (feedback)
                  if (showFeedback) {
                    if (isCorrect) {
                      bg = '#F0FDF4'
                      border = '#4ADE80'
                      badgeBg = '#22C55E'
                      badgeColor = 'white'
                    } else if (isSelected && !isCorrect) {
                      bg = '#FEF2F2'
                      border = '#FCA5A5'
                      badgeBg = '#EF4444'
                      badgeColor = 'white'
                    } else {
                      textColor = '#94A3B8'
                    }
                  }

                  // Handler selon le type
                  const handleClick = () => {
                    if (showFeedback) return
                    if (isCheckbox) {
                      toggleCheckboxAnswer(opt.id)
                    } else {
                      handleSingleAnswer(opt.id)
                    }
                  }

                  return (
                    <button
                      key={opt.id}
                      onClick={handleClick}
                      disabled={showFeedback || (!isCheckbox && selectedAnswer !== null)}
                      className="w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3"
                      style={{
                        background: bg,
                        border: `2px solid ${border}`,
                        cursor: showFeedback || (!isCheckbox && selectedAnswer) ? 'default' : 'pointer',
                      }}
                    >
                      {/* Badge ou Checkbox */}
                      {isCheckbox ? (
                        <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                          {showFeedback ? (
                            isCorrect ? (
                              <CheckSquare size={24} className="text-emerald-500" />
                            ) : isSelected ? (
                              <X size={24} className="text-red-500" />
                            ) : (
                              <Square size={24} className="text-gray-300" />
                            )
                          ) : isSelected ? (
                            <CheckSquare size={24} style={{ color: categoryGradient.from }} />
                          ) : (
                            <Square size={24} className="text-gray-400" />
                          )}
                        </span>
                      ) : !isTF ? (
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                          style={{ background: badgeBg, color: badgeColor }}
                        >
                          {showFeedback && isCorrect
                            ? '✓'
                            : showFeedback && isSelected && !isCorrect
                            ? '✗'
                            : String.fromCharCode(65 + i)}
                        </span>
                      ) : null}
                      
                      <span
                        className="flex-1 font-semibold text-sm"
                        style={{ color: textColor }}
                      >
                        {opt.text}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Bouton Valider pour Checkbox */}
              {isCheckbox && !showFeedback && (
                <button
                  onClick={validateCheckboxAnswer}
                  disabled={selectedAnswers.length === 0}
                  className="w-full mt-4 py-3.5 rounded-2xl font-bold text-[15px] text-white disabled:opacity-40 transition-all"
                  style={{ background: categoryGradient.from }}
                >
                  Valider ma réponse ({selectedAnswers.length} sélectionnée{selectedAnswers.length > 1 ? 's' : ''})
                </button>
              )}
            </div>
          )
        })()}

        {/* PDF */}
        {playerStep === 'pdf' && (
          <div className="text-center py-10">
            <div className="w-20 h-20 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4 text-4xl">
              📄
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              Support de cours
            </h3>
            <p className="text-[13px] text-gray-500 mb-6 leading-relaxed">
              Téléchargez le PDF récapitulatif pour réviser.
            </p>
            {sequence.infographic_url && (
              <a
                href={sequence.infographic_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-2xl border-2 border-gray-200 bg-white font-semibold text-sm text-gray-800 hover:bg-gray-50 transition-colors"
              >
                <Download size={18} /> Télécharger le PDF
              </a>
            )}
            <div className="mt-8">
              <button
                onClick={finishSequence}
                disabled={submitting}
                className="w-full max-w-xs py-4 rounded-2xl font-bold text-[15px] text-white disabled:opacity-50"
                style={{ background: categoryGradient.from }}
              >
                {submitting ? 'Enregistrement...' : 'Terminer la séquence ✓'}
              </button>
            </div>
          </div>
        )}

        {/* RÉSULTATS */}
        {playerStep === 'results' && (
          <div className="text-center py-5">
            {/* Score circulaire */}
            <div
              className="w-28 h-28 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{
                background: `conic-gradient(${
                  score >= 75 ? '#22C55E' : score >= 50 ? '#FBBF24' : '#EF4444'
                } ${score * 3.6}deg, #E2E8F0 0deg)`,
              }}
            >
              <div className="w-[88px] h-[88px] rounded-full bg-white flex items-center justify-center">
                <span className="text-3xl font-extrabold text-gray-800">
                  {score}%
                </span>
              </div>
            </div>

            <h2 className="text-[22px] font-extrabold text-gray-800 mb-1">
              {score === 100
                ? 'Parfait ! 🏆'
                : score >= 75
                ? 'Excellent ! ✨'
                : score >= 50
                ? 'Bien joué ! 💪'
                : 'Continue ! 📚'}
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              {correctCount}/{questions.length} bonnes réponses
            </p>

            {/* Points gagnés */}
            <div className="inline-flex items-center gap-3 bg-gradient-to-r from-amber-100 to-amber-200 rounded-2xl px-5 py-4 mb-6">
              <span className="text-3xl">⭐</span>
              <div className="text-left">
                <p className="text-2xl font-extrabold text-amber-700">
                  +{totalPoints}
                </p>
                <p className="text-xs text-amber-700">points gagnés</p>
              </div>
            </div>

            <div>
              <button
                onClick={() => (hasPdf ? setPlayerStep('pdf') : finishSequence())}
                disabled={submitting}
                className="w-full max-w-xs py-4 rounded-2xl font-bold text-[15px] text-white disabled:opacity-50"
                style={{ background: categoryGradient.from }}
              >
                {submitting
                  ? 'Enregistrement...'
                  : hasPdf
                  ? 'Voir le PDF récapitulatif'
                  : 'Terminer'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feedback Overlay */}
      {showOverlay && overlayData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative w-full max-w-[360px] bg-white rounded-3xl overflow-hidden shadow-2xl">
            {/* Header coloré */}
            <div
              className="px-6 py-5 text-center"
              style={{
                background: overlayData.isCorrect
                  ? 'linear-gradient(135deg, #34D399, #059669)'
                  : 'linear-gradient(135deg, #F87171, #DC2626)',
              }}
            >
              <div className="w-14 h-14 mx-auto mb-2 bg-white rounded-full flex items-center justify-center">
                {overlayData.isCorrect ? (
                  <Check size={28} className="text-emerald-600" strokeWidth={3} />
                ) : (
                  <X size={28} className="text-red-600" strokeWidth={3} />
                )}
              </div>
              <h3 className="text-xl font-extrabold text-white mb-2">
                {overlayData.isCorrect ? 'Bravo !' : 'Dommage !'}
              </h3>
              {overlayData.points > 0 && (
                <span className="bg-white/20 px-4 py-1 rounded-full text-white font-bold text-sm">
                  +{overlayData.points} points
                </span>
              )}
            </div>

            {/* Feedback */}
            <div className="px-6 py-5 max-h-[200px] overflow-auto">
              <div className="flex items-center gap-2 mb-2">
                <Lightbulb size={16} className="text-amber-500" />
                <span className="text-xs font-bold text-gray-400 uppercase">
                  Explication
                </span>
              </div>
              <p className="text-[13px] text-gray-600 leading-relaxed">
                {overlayData.feedback}
              </p>
            </div>

            {/* Bouton */}
            <div className="px-6 pb-5">
              <button
                onClick={nextQuestion}
                className="w-full py-4 rounded-2xl font-bold text-[15px] text-white"
                style={{ background: categoryGradient.from }}
              >
                {overlayData.isLast ? 'Voir mes résultats' : 'Question suivante'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
