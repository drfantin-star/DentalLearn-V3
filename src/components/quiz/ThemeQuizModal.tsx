'use client'

import React, { useState, useEffect } from 'react'
import NewsModal from '@/components/news/NewsModal'
import { THEME_QUIZ_COLORS, THEME_QUIZ_FALLBACK } from '@/lib/quiz/themeColors'
import {
  X,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Trophy,
  Loader2,
  Square,
  CheckSquare,
  RefreshCw,
} from 'lucide-react'

// ============================================
// TYPES
// ============================================

interface StandardOption {
  id: string
  text: string
  correct: boolean
}

interface ThemeQuestion {
  id: string
  question_type: string
  question_text: string
  options: unknown
  feedback_correct: string
  feedback_incorrect: string
  image_url?: string | null
  recommended_time_seconds?: number
  difficulty?: string
  sourceTitle?: string | null
  news_synthesis_id?: string | null
}

export interface ThemeQuizModalProps {
  specialite: string
  label: string
  onClose: () => void
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
    } catch { /* ignore */ }
  }
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

// ============================================
// COMPONENT
// ============================================

export default function ThemeQuizModal({ specialite, label, onClose }: ThemeQuizModalProps) {
  const [questions, setQuestions] = useState<ThemeQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [playable, setPlayable] = useState(true)

  const [index, setIndex] = useState(0)
  const [correctCount, setCorrectCount] = useState(0)
  const [finished, setFinished] = useState(false)

  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null)
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([])
  const [showFeedback, setShowFeedback] = useState(false)
  const [isCorrect, setIsCorrect] = useState(false)
  const [articleNewsId, setArticleNewsId] = useState<string | null>(null)

  useEffect(() => {
    loadQuestions()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specialite])

  const loadQuestions = async () => {
    setLoading(true)
    setIndex(0)
    setCorrectCount(0)
    setFinished(false)
    resetQuestionState()

    try {
      const res = await fetch(`/api/quiz/by-theme?specialite=${encodeURIComponent(specialite)}&limit=10`)
      const data = await res.json()
      setPlayable(data.playable ?? false)
      setQuestions(data.questions ?? [])
    } catch {
      setPlayable(false)
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }

  const resetQuestionState = () => {
    setSelectedAnswer(null)
    setSelectedAnswers([])
    setShowFeedback(false)
    setIsCorrect(false)
  }

  const evaluate = (correct: boolean) => {
    setIsCorrect(correct)
    if (correct) setCorrectCount(c => c + 1)
    setShowFeedback(true)
  }

  const handleSingleAnswer = (answerId: string) => {
    if (showFeedback || selectedAnswer) return
    setSelectedAnswer(answerId)

    const q = questions[index]
    const opts = parseStandardOptions(q.options)

    if (q.question_type === 'true_false') {
      if (opts.length >= 2) {
        const selected = opts.find(o => o.id === answerId)
        evaluate(!!selected?.correct)
        return
      }
      const optObj = q.options as Record<string, unknown>
      if ('correct_answer' in optObj) {
        evaluate((answerId === 'true') === optObj.correct_answer)
        return
      }
    }

    const selected = opts.find(o => o.id === answerId)
    evaluate(!!selected?.correct)
  }

  const handleCheckboxValidate = () => {
    if (showFeedback || selectedAnswers.length === 0) return
    const q = questions[index]
    const opts = parseStandardOptions(q.options)
    const correctIds = opts.filter(o => o.correct).map(o => o.id)
    const correctSelected = selectedAnswers.filter(a => correctIds.includes(a)).length
    const incorrectSelected = selectedAnswers.filter(a => !correctIds.includes(a)).length
    const ratio = Math.max(0, (correctSelected - incorrectSelected) / correctIds.length)
    evaluate(ratio === 1)
  }

  const next = () => {
    if (index < questions.length - 1) {
      resetQuestionState()
      setIndex(i => i + 1)
    } else {
      setFinished(true)
    }
  }

  // ============================================
  // RENDER STATES
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

  if (!playable || questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
        <div className="glass-panel w-full max-w-sm rounded-3xl p-6 text-center">
          <AlertCircle className="w-12 h-12 text-white/40 mx-auto mb-4" />
          <p className="text-white font-semibold mb-2">Pas encore de quiz pour ce theme</p>
          <p className="text-white/50 text-sm mb-6">Le contenu sera disponible prochainement.</p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 rounded-xl font-bold text-sm bg-white/10 text-white transition-premium hover:bg-white/20"
          >
            Fermer
          </button>
        </div>
      </div>
    )
  }

  if (finished) {
    const isPerfect = correctCount === questions.length
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/70 backdrop-blur-sm">
        <div className="glass-panel w-full max-w-sm rounded-3xl p-6 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/30 flex items-center justify-center">
            <Trophy size={30} className="text-accent" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-1">
            {isPerfect ? 'Parfait !' : correctCount >= Math.ceil(questions.length * 0.7) ? 'Bravo !' : 'Bien joue !'}
          </h2>
          <p className="text-white/50 text-sm mb-5">{label}</p>

          <div className="rounded-2xl p-5 mb-4 bg-primary/20 border border-primary/40">
            <div className="text-5xl font-black text-white mb-1">
              {correctCount}<span className="text-2xl font-bold text-white/50">/{questions.length}</span>
            </div>
            <div className="text-sm text-white/60">bonnes reponses</div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={loadQuestions}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-white/10 text-white flex items-center justify-center gap-2 transition-premium hover:bg-white/20"
            >
              <RefreshCw size={14} />
              Rejouer
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl font-bold text-sm bg-primary/40 text-white transition-premium hover:bg-primary/60"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ============================================
  // RENDER: QUESTION SCREEN
  // ============================================

  const tc = THEME_QUIZ_COLORS[specialite] ?? THEME_QUIZ_FALLBACK

  const q = questions[index]
  const progress = ((index + 1) / questions.length) * 100
  const qType = q.question_type
  const normalizedType = qType === 'qcm' ? 'mcq' : qType

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#0F0F0F]">
      {/* Theme halo */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-64 pointer-events-none"
        style={{ background: `radial-gradient(120% 100% at 50% 0%, ${tc.dark} 0%, transparent 70%)`, opacity: 0.35 }}
      />

      {/* Progress bar */}
      <div className="h-1.5 bg-white/10 flex-shrink-0">
        <div
          className="h-full transition-all duration-500"
          style={{ width: `${progress}%`, background: tc.light }}
        />
      </div>

      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 flex items-center justify-between border-b border-white/10">
        <span className="text-sm font-bold text-white">{index + 1}/{questions.length}</span>
        <span className="text-sm font-semibold" style={{ color: tc.light }}>{label}</span>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-premium"
          aria-label="Fermer le quiz"
        >
          <X size={20} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {/* Type badge */}
        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-semibold mb-3 bg-white/10 text-white/60">
          {qType === 'true_false' ? 'Vrai / Faux' : qType === 'checkbox' ? 'Choix multiples' : 'QCM'}
        </span>

        {/* Source context */}
        {q.sourceTitle && (
          <div className="mb-4 rounded-xl glass-card px-3 py-2.5 flex items-start gap-2.5">
            <span aria-hidden className="mt-0.5">📄</span>
            <div className="flex-1 min-w-0">
              <p className="text-white/85 text-sm font-medium leading-snug">{q.sourceTitle}</p>
              {q.news_synthesis_id && (
                <button
                  type="button"
                  onClick={() => setArticleNewsId(q.news_synthesis_id!)}
                  className="mt-1 text-accent text-xs font-semibold hover:underline transition-premium"
                >
                  Voir l'article
                </button>
              )}
            </div>
          </div>
        )}

        {/* Image */}
        {q.image_url && (
          <div className="mb-4">
            <img src={q.image_url} alt="Question" className="w-full rounded-xl max-h-48 object-contain" />
          </div>
        )}

        {/* Question text */}
        <h3 className="text-lg font-bold text-white leading-snug mb-6">{q.question_text}</h3>

        {!showFeedback ? (
          <>
            {/* === MCQ === */}
            {normalizedType === 'mcq' && (() => {
              const opts = parseStandardOptions(q.options)
              return (
                <div className="flex flex-col gap-2.5">
                  {opts.map((opt, i) => {
                    const isSelected = selectedAnswer === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSingleAnswer(opt.id)}
                        disabled={selectedAnswer !== null}
                        className="w-full p-3.5 rounded-2xl text-left transition-premium flex items-center gap-3"
                        style={{
                          background: isSelected ? `${tc.light}22` : 'rgba(255,255,255,0.07)',
                          border: `2px solid ${isSelected ? tc.light : `${tc.light}33`}`,
                          boxShadow: isSelected ? `0 0 26px -6px ${tc.light}` : `0 0 18px -9px ${tc.light}`,
                        }}
                      >
                        <span
                          className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                          style={{
                            background: isSelected ? tc.light : `${tc.light}22`,
                            color: isSelected ? tc.dark : tc.light,
                          }}
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
                ensuite dans la section feedback). Aligne sur le quizz de sequence. */}
            {normalizedType === 'true_false' && (() => {
              const opts = parseStandardOptions(q.options)
              if (opts.length >= 2) {
                return (
                  <div className="grid grid-cols-2 gap-4">
                    {opts.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSingleAnswer(opt.id)}
                        disabled={selectedAnswer !== null}
                        className="h-24 rounded-2xl border-2 border-white/15 bg-white/[0.07] flex items-center justify-center transition-premium hover:scale-[1.02] active:scale-95"
                      >
                        <span className="text-lg font-black text-white">{opt.text}</span>
                      </button>
                    ))}
                  </div>
                )
              }
              return (
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleSingleAnswer('true')}
                    disabled={selectedAnswer !== null}
                    className="h-24 rounded-2xl border-2 border-white/15 bg-white/[0.07] flex items-center justify-center transition-premium hover:scale-[1.02] active:scale-95"
                  >
                    <span className="text-lg font-black text-white">VRAI</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSingleAnswer('false')}
                    disabled={selectedAnswer !== null}
                    className="h-24 rounded-2xl border-2 border-white/15 bg-white/[0.07] flex items-center justify-center transition-premium hover:scale-[1.02] active:scale-95"
                  >
                    <span className="text-lg font-black text-white">FAUX</span>
                  </button>
                </div>
              )
            })()}

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
                          type="button"
                          onClick={() => setSelectedAnswers(prev =>
                            prev.includes(opt.id)
                              ? prev.filter(a => a !== opt.id)
                              : [...prev, opt.id]
                          )}
                          className="w-full p-3.5 rounded-2xl text-left transition-premium flex items-center gap-3"
                          style={{
                            background: isSelected ? `${tc.light}22` : 'rgba(255,255,255,0.07)',
                            border: `2px solid ${isSelected ? tc.light : `${tc.light}33`}`,
                            boxShadow: isSelected ? `0 0 26px -6px ${tc.light}` : `0 0 18px -9px ${tc.light}`,
                          }}
                        >
                          <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
                            {isSelected
                              ? <CheckSquare size={24} style={{ color: tc.light }} />
                              : <Square size={24} className="text-white/40" />}
                          </span>
                          <span className="flex-1 font-semibold text-sm text-white">{opt.text}</span>
                        </button>
                      )
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={handleCheckboxValidate}
                    disabled={selectedAnswers.length === 0}
                    className="w-full mt-4 py-3.5 rounded-2xl font-bold text-sm text-white bg-primary/60 hover:bg-primary/80 transition-premium disabled:opacity-40"
                  >
                    Valider ({selectedAnswers.length} selectionnee{selectedAnswers.length > 1 ? 's' : ''})
                  </button>
                </>
              )
            })()}
          </>
        ) : (
          /* =================== FEEDBACK =================== */
          <div>
            {/* Detail des options */}
            {(normalizedType === 'mcq' || normalizedType === 'true_false') && (() => {
              const opts = parseStandardOptions(q.options)
              if (opts.length === 0) return null
              return (
                <div className="flex flex-col gap-2 mb-4">
                  {opts.map((opt, i) => {
                    const isSelected = selectedAnswer === opt.id
                    const optCorrect = opt.correct
                    const bg = optCorrect ? '#052e16' : isSelected ? '#450a0a' : 'rgba(255,255,255,0.04)'
                    const border = optCorrect ? '#4ADE80' : isSelected ? '#FCA5A5' : 'rgba(255,255,255,0.1)'
                    return (
                      <div key={opt.id} className="w-full p-3 rounded-2xl flex items-center gap-3"
                        style={{ background: bg, border: `2px solid ${border}` }}>
                        <span className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0 text-white"
                          style={{ background: optCorrect ? '#22C55E' : isSelected ? '#EF4444' : 'rgba(255,255,255,0.1)' }}>
                          {optCorrect ? '✓' : isSelected ? '✗' : String.fromCharCode(65 + i)}
                        </span>
                        <span className="flex-1 font-semibold text-sm text-white">{opt.text}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {normalizedType === 'checkbox' && (() => {
              const opts = parseStandardOptions(q.options)
              return (
                <div className="flex flex-col gap-2 mb-4">
                  {opts.map(opt => {
                    const isSelected = selectedAnswers.includes(opt.id)
                    const optCorrect = opt.correct
                    const bg = optCorrect ? '#052e16' : isSelected ? '#450a0a' : 'rgba(255,255,255,0.04)'
                    const border = optCorrect ? '#4ADE80' : isSelected ? '#FCA5A5' : 'rgba(255,255,255,0.1)'
                    return (
                      <div key={opt.id} className="w-full p-3 rounded-2xl flex items-center gap-3"
                        style={{ background: bg, border: `2px solid ${border}` }}>
                        <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0">
                          {optCorrect ? <CheckSquare size={22} className="text-emerald-400" />
                            : isSelected ? <X size={22} className="text-red-400" />
                            : <Square size={22} className="text-white/30" />}
                        </span>
                        <span className="flex-1 font-semibold text-sm text-white">{opt.text}</span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}

            {/* Feedback card */}
            <div
              className="rounded-2xl p-5"
              style={isCorrect
                ? { background: 'rgba(6,78,59,0.25)', border: '1px solid #059669' }
                : { background: 'rgba(69,10,10,0.25)', border: '1px solid #ef4444' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-full ${isCorrect ? 'bg-emerald-200 text-emerald-700' : 'bg-red-200 text-red-700'}`}>
                  {isCorrect ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                </div>
                <span className={`text-lg font-bold ${isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>
                  {isCorrect ? 'Exact !' : 'Incorrect'}
                </span>
              </div>
              <p className="text-sm text-white leading-relaxed mb-4">
                {isCorrect ? q.feedback_correct : q.feedback_incorrect}
              </p>
              <button
                type="button"
                onClick={next}
                className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-premium bg-white text-[#0F0F0F] hover:bg-white/90"
              >
                {index < questions.length - 1 ? 'Suivant' : 'Voir mon score'}
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
      <NewsModal newsId={articleNewsId} onClose={() => setArticleNewsId(null)} />
    </div>
  )
}
