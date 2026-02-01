'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  GraduationCap, ShieldCheck, HeartHandshake, HeartPulse,
  Bell, ChevronRight, X, CheckCircle2, AlertCircle,
  Flame, Trophy, Sparkles, Play, ArrowRight, Newspaper,
  Scale, FlaskConical, Stethoscope, PartyPopper, ExternalLink,
  Loader2, Heart, BookOpen
} from 'lucide-react'
import { useUser } from '@/lib/hooks/useUser'
import { useAxes, type AxisWithProgress } from '@/lib/hooks/useAxes'
import { useFormations } from '@/lib/hooks/useFormations'
import { useNews, formatRelativeDate } from '@/lib/hooks/useNews'
import type { NewsArticle } from '@/types/database'

// ============================================
// MAPPINGS — Couleurs prototype V5
// ============================================

const axisIcons: Record<number, React.ElementType> = {
  1: GraduationCap,
  2: ShieldCheck,
  3: HeartHandshake,
  4: HeartPulse,
}

const axisBgColors: Record<number, string> = {
  1: 'bg-violet-50',
  2: 'bg-teal-50',
  3: 'bg-amber-50',
  4: 'bg-emerald-50',
}

const axisColors: Record<number, string> = {
  1: '#8B5CF6',
  2: '#00D1C1',
  3: '#F59E0B',
  4: '#10B981',
}

// ============================================
// QUIZ QUESTIONS (temporaire — sera Supabase)
// ============================================

const quizQuestions = [
  { id: 1, text: "Le détartrage peut être coté 3 fois par an pour un patient diabétique en ALD ?", isTrue: true, explanation: "Vrai. Depuis 2026, la fréquence passe à 3 fois par an pour les patients en ALD diabète.", source: "Convention 2026" },
  { id: 2, text: "La télé-expertise est opposable pour tous les patients depuis 2026 ?", isTrue: false, explanation: "Faux. Elle reste conditionnée aux patients dépendants ou en EHPAD.", source: "Avenant 3" },
  { id: 3, text: "L'inlay-core fibré bénéficie d'une revalorisation de 12% ?", isTrue: true, explanation: "Vrai. Cette revalorisation encourage les restaurations conservatrices.", source: "CCAM v72" },
  { id: 4, text: "Le code HBJD001 inclut explicitement le polissage ?", isTrue: false, explanation: "Faux. Le libellé reste inchangé.", source: "CCAM v72" },
]

// ============================================
// MOCK FORMATIONS EN COURS (temporaire)
// ============================================

interface FormationEnCours {
  id: string
  title: string
  instructor: string
  category: string
  currentSequence: number
  totalSequences: number
  progressPercent: number
  likes: number
  isCP: boolean
  badge?: 'NOUVEAU' | 'POPULAIRE'
}

const mockFormations: FormationEnCours[] = [
  {
    id: '1',
    title: 'Éclaircissements & Taches Blanches',
    instructor: 'Dr Laurent Elbeze',
    category: 'Dentisterie Restauratrice',
    currentSequence: 6,
    totalSequences: 15,
    progressPercent: 40,
    likes: 124,
    isCP: true,
    badge: 'POPULAIRE',
  },
  {
    id: '2',
    title: 'Fêlures & Overlays',
    instructor: 'Dr Gauthier Weisrock',
    category: 'Dentisterie Restauratrice',
    currentSequence: 2,
    totalSequences: 15,
    progressPercent: 13,
    likes: 89,
    isCP: true,
    badge: 'NOUVEAU',
  },
]

// ============================================
// COMPOSANTS INTERNES (seront extraits en 2.2)
// ============================================

function GlobalProgressBars({ axes }: { axes: AxisWithProgress[] }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
      <div className="space-y-3">
        {axes.map((axis) => {
          const Icon = axisIcons[axis.id] || GraduationCap
          const bgColor = axisBgColors[axis.id] || 'bg-gray-50'
          const color = axisColors[axis.id] || axis.color
          // Barre continue : progressFilled va de 0 à 4, on le convertit en %
          const percent = Math.round((axis.progressFilled / 4) * 100)
          return (
            <div key={axis.id} className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${bgColor}`}
                style={{ color }}
              >
                <Icon size={16} />
              </div>
              {/* Barre CONTINUE (pas de segments) */}
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${percent}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
              <span className="text-[10px] font-bold text-gray-400 w-8 text-right">
                {percent}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TrainingCard({
  axis,
  onStart,
}: {
  axis: AxisWithProgress
  onStart: (a: AxisWithProgress) => void
}) {
  const Icon = axisIcons[axis.id] || GraduationCap
  const bgColor = axisBgColors[axis.id] || 'bg-gray-50'

  return (
    <button
      onClick={() => !axis.dailyDone && onStart(axis)}
      disabled={axis.dailyDone}
      className={`w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left transition-all ${
        axis.dailyDone
          ? 'opacity-75'
          : 'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${bgColor}`}
          style={{ color: axis.color }}
        >
          <Icon size={20} />
        </div>
        {axis.dailyDone ? (
          <div className="flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-full">
            <CheckCircle2 size={14} />
            <span className="text-[10px] font-bold">Fait</span>
          </div>
        ) : (
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-full animate-pulse"
            style={{
              backgroundColor: `${axis.color}15`,
              color: axis.color,
            }}
          >
            <Sparkles size={12} />
            <span className="text-[10px] font-bold">+1 pt</span>
          </div>
        )}
      </div>
      <h3 className="font-bold text-gray-900 text-sm mb-1">
        {axis.short_name}
      </h3>
      <p className="text-[11px] text-gray-400">{axis.name}</p>
      <div className="mt-3 h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: axis.dailyDone ? '100%' : '0%',
            backgroundColor: axis.color,
          }}
        />
      </div>
    </button>
  )
}

function FormationCard({ formation }: { formation: FormationEnCours }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-all">
      {/* Header : badge + likes */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {formation.isCP && (
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-violet-50 text-violet-600 rounded-full">
              CP
            </span>
          )}
          {formation.badge && (
            <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
              formation.badge === 'NOUVEAU'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-orange-50 text-orange-600'
            }`}>
              {formation.badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-gray-400">
          <Heart size={12} className="text-red-400 fill-red-400" />
          <span className="text-[11px] font-medium">{formation.likes}</span>
        </div>
      </div>

      {/* Titre */}
      <h3 className="font-bold text-gray-900 text-sm leading-snug mb-1">
        {formation.title}
      </h3>
      <p className="text-[10px] text-gray-400 mb-3">
        {formation.category}
      </p>

      {/* Barre de progression continue */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-[#8B5CF6] rounded-full transition-all duration-700"
            style={{ width: `${formation.progressPercent}%` }}
          />
        </div>
        <span className="text-[10px] font-bold text-gray-400">
          {formation.currentSequence}/{formation.totalSequences}
        </span>
      </div>

      {/* Bouton Continuer */}
      <button className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-[#2D1B96] to-[#3D2BB6] text-white rounded-xl text-sm font-bold hover:shadow-md transition-all active:scale-[0.98]">
        <Play size={14} /> Continuer
      </button>
    </div>
  )
}

function NewsSection({
  news,
  loading,
}: {
  news: NewsArticle[]
  loading: boolean
}) {
  const getStyle = (cat: NewsArticle['category']) => {
    const styles = {
      reglementaire: { icon: Scale, bg: 'bg-blue-50', text: 'text-blue-600', label: 'Réglementaire' },
      scientifique: { icon: FlaskConical, bg: 'bg-purple-50', text: 'text-purple-600', label: 'Scientifique' },
      pratique: { icon: Stethoscope, bg: 'bg-teal-50', text: 'text-teal-600', label: 'Pratique' },
      humour: { icon: PartyPopper, bg: 'bg-pink-50', text: 'text-pink-600', label: 'Humour' },
    }
    return styles[cat]
  }

  if (loading) {
    return (
      <section>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Newspaper size={20} className="text-[#2D1B96]" /> Veille métier
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={24} />
        </div>
      </section>
    )
  }

  if (news.length === 0) {
    return (
      <section>
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4">
          <Newspaper size={20} className="text-[#2D1B96]" /> Veille métier
        </h2>
        <p className="text-gray-400 text-sm text-center py-8">
          Aucune actualité pour le moment
        </p>
      </section>
    )
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <Newspaper size={20} className="text-[#2D1B96]" /> Veille métier
        </h2>
        <button className="text-xs font-bold text-[#2D1B96] flex items-center gap-1">
          Tout voir <ChevronRight size={14} />
        </button>
      </div>
      <div className="space-y-3">
        {news.map((item) => {
          const style = getStyle(item.category)
          const Icon = style.icon
          return (
            <a
              key={item.id}
              href={item.external_url || '#'}
              target={item.external_url ? '_blank' : undefined}
              rel={item.external_url ? 'noopener noreferrer' : undefined}
              className="block bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:shadow-md transition-all"
            >
              <div className="flex gap-3">
                <div
                  className={`w-10 h-10 rounded-lg ${style.bg} ${style.text} flex items-center justify-center shrink-0`}
                >
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-[10px] font-bold uppercase ${style.text}`}
                    >
                      {style.label}
                    </span>
                    <span className="text-[10px] text-gray-300">•</span>
                    <span className="text-[10px] text-gray-400">
                      {formatRelativeDate(item.published_at)}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2">
                    {item.title}
                  </h3>
                  <div className="flex items-center gap-1 text-[10px] text-gray-400 mt-1">
                    <span>{item.source}</span>
                    {item.external_url && <ExternalLink size={10} />}
                  </div>
                </div>
              </div>
            </a>
          )
        })}
      </div>
    </section>
  )
}

function QuizModal({
  axis,
  onClose,
  onComplete,
}: {
  axis: AxisWithProgress
  onClose: () => void
  onComplete: (score: number) => void
}) {
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
                  backgroundColor: [axis.color, '#00D1C1', '#F59E0B', '#EC4899'][i % 4],
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

// ============================================
// PAGE PRINCIPALE — ACCUEIL
// ============================================

export default function HomePage() {
  const [showQuiz, setShowQuiz] = useState(false)
  const [selectedAxis, setSelectedAxis] = useState<AxisWithProgress | null>(null)

  // Hooks Supabase
  const { user, displayName, streak, loading: userLoading } = useUser()
  const { axes, loading: axesLoading, completeQuiz } = useAxes(user?.id)
  const { currentFormation, loading: formationLoading } = useFormations(user?.id)
  const { news, loading: newsLoading } = useNews(4)

  const startQuiz = (axis: AxisWithProgress) => {
    setSelectedAxis(axis)
    setShowQuiz(true)
  }

  const handleQuizComplete = async (score: number) => {
    if (selectedAxis) {
      await completeQuiz(selectedAxis.id, score)
    }
    setShowQuiz(false)
    setSelectedAxis(null)
  }

  const isLoading = userLoading || axesLoading

  return (
    <>
      {/* Header Accueil */}
      <header className="bg-white sticky top-0 z-30 shadow-sm">
        <div className="max-w-lg mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-[#00D1C1] to-[#2D1B96] p-0.5">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                  <img
                    src="https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=100&h=100&fit=crop"
                    alt="Photo de profil"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-400">Bonjour,</p>
                <h1 className="text-lg font-bold text-gray-900">
                  {displayName}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Streak */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 rounded-full">
                <Flame size={16} className="text-orange-500" />
                <span className="text-sm font-bold text-orange-600">
                  {streak?.current_streak || 0}
                </span>
              </div>

              {/* Notifications */}
              <button className="relative p-2.5 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors">
                <Bell size={20} className="text-gray-600" />
                <div className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenu */}
      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-[#2D1B96]" size={32} />
          </div>
        ) : (
          <>
            {/* Progression globale — barres continues */}
            {axes.length > 0 && <GlobalProgressBars axes={axes} />}

            {/* Entraînement du jour */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Sparkles size={20} className="text-[#00D1C1]" />
                  Entraînement du jour
                </h2>
                <span className="text-xs font-bold text-gray-400">
                  {axes.filter((a) => a.dailyDone).length}/{axes.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {axes.map((axis) => (
                  <TrainingCard
                    key={axis.id}
                    axis={axis}
                    onStart={startQuiz}
                  />
                ))}
              </div>
            </section>

            {/* Mes formations en cours — cartes multiples */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <BookOpen size={20} className="text-[#8B5CF6]" />
                  Mes formations en cours
                </h2>
                <Link
                  href="/formation"
                  className="text-xs font-bold text-[#2D1B96] flex items-center gap-1 hover:underline"
                >
                  Tout voir <ChevronRight size={14} />
                </Link>
              </div>

              {formationLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="animate-spin text-gray-400" size={24} />
                </div>
              ) : mockFormations.length > 0 ? (
                <div className="grid grid-cols-1 gap-3">
                  {mockFormations.map((f) => (
                    <FormationCard key={f.id} formation={f} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 text-center">
                  <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-violet-50 flex items-center justify-center">
                    <GraduationCap size={24} className="text-violet-400" />
                  </div>
                  <p className="text-gray-500 text-sm mb-4">
                    Aucune formation en cours
                  </p>
                  <Link
                    href="/formation"
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#00D1C1] text-white rounded-xl text-sm font-bold hover:bg-[#00b8a9] transition-colors"
                  >
                    Voir le catalogue
                  </Link>
                </div>
              )}
            </section>

            {/* Veille métier */}
            <NewsSection news={news} loading={newsLoading} />
          </>
        )}
      </main>

      {/* Modal Quiz */}
      {showQuiz && selectedAxis && (
        <QuizModal
          axis={selectedAxis}
          onClose={() => {
            setShowQuiz(false)
            setSelectedAxis(null)
          }}
          onComplete={handleQuizComplete}
        />
      )}
    </>
  )
}
