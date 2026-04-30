'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  Search,
  AlertCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  CheckCircle2,
  Inbox,
  Check,
} from 'lucide-react'
import { QuestionApprovalButton } from './QuestionApprovalButton'

const SPECIALITES = [
  { value: 'actu-pro', label: 'Actualité professionnelle' },
  { value: 'chir-orale', label: 'Chirurgie orale' },
  { value: 'dent-resto', label: 'Dentisterie restauratrice' },
  { value: 'endo', label: 'Endodontie' },
  { value: 'gero', label: 'Gérodontologie' },
  { value: 'implanto', label: 'Implantologie' },
  { value: 'occluso', label: 'Occlusodontie' },
  { value: 'odf', label: 'Orthodontie' },
  { value: 'paro', label: 'Parodontologie' },
  { value: 'pedo', label: 'Pédodontie' },
  { value: 'proth', label: 'Prothèse' },
  { value: 'sante-pub', label: 'Santé publique' },
] as const

const SORTS = [
  { value: 'created_at_desc', label: 'Plus récentes' },
  { value: 'created_at_asc', label: 'Plus anciennes' },
] as const

const QUESTION_TYPE_LABEL: Record<string, string> = {
  mcq: 'QCM (1 bonne)',
  true_false: 'Vrai / Faux',
  checkbox: 'Choix multiples',
}

interface QuestionOption {
  id: string
  text: string
  correct: boolean
}

interface SynthesisLite {
  id: string
  display_title: string | null
  specialite: string | null
  niveau_preuve: string | null
  formation_category_match: string | null
}

interface NewsQuestion {
  id: string
  question_order: number | null
  question_type: string
  question_text: string
  options: unknown
  feedback_correct: string | null
  feedback_incorrect: string | null
  points: number | null
  recommended_time_seconds: number | null
  difficulty: number | null
  is_daily_quiz_eligible: boolean
  created_at: string
  news_synthesis_id: string
  synthesis: SynthesisLite | null
}

interface ListResponse {
  questions: NewsQuestion[]
  total: number
  page: number
  limit: number
  total_pages: number
  counts: { pending: number; approved: number }
}

interface QuestionsListPageProps {
  status: 'pending' | 'approved'
  title: string
  subtitle: string
  emptyMessage: string
  emptyIcon: 'check' | 'inbox'
}

export function QuestionsListPage(props: QuestionsListPageProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const specialite = searchParams.get('specialite') ?? ''
  const sort = searchParams.get('sort') ?? 'created_at_desc'
  const qFromUrl = searchParams.get('q') ?? ''
  const pageRaw = parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const [searchInput, setSearchInput] = useState(qFromUrl)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : '?')
    },
    [router, searchParams]
  )

  useEffect(() => {
    setSearchInput(qFromUrl)
  }, [qFromUrl])

  useEffect(() => {
    if (searchInput === qFromUrl) return
    const timer = setTimeout(() => {
      updateParams({ q: searchInput || null, page: '1' })
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput, qFromUrl, updateParams])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('status', props.status)
        params.set('page', String(page))
        params.set('sort', sort)
        params.set('limit', '20')
        if (specialite) params.set('specialite', specialite)
        if (qFromUrl) params.set('q', qFromUrl)
        const res = await fetch(`/api/admin/news/questions?${params.toString()}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
        if (!cancelled) setData(json as ListResponse)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [props.status, page, sort, specialite, qFromUrl])

  const hasActiveFilters = useMemo(
    () => !!specialite || !!qFromUrl || sort !== 'created_at_desc',
    [specialite, qFromUrl, sort]
  )

  const resetFilters = () => {
    setSearchInput('')
    router.replace('?')
  }

  // Mise à jour optimiste : retire la question de la liste si son nouveau
  // statut ne correspond plus au filtre courant ; sinon met juste à jour son
  // is_daily_quiz_eligible. Met aussi à jour les compteurs globaux.
  const handleApprovalChange = (questionId: string, newValue: boolean) => {
    setData((prev) => {
      if (!prev) return prev
      const matchesPage =
        (props.status === 'approved' && newValue) ||
        (props.status === 'pending' && !newValue)
      const newQuestions = matchesPage
        ? prev.questions.map((q) =>
            q.id === questionId ? { ...q, is_daily_quiz_eligible: newValue } : q
          )
        : prev.questions.filter((q) => q.id !== questionId)
      const removed = !matchesPage
      return {
        ...prev,
        questions: newQuestions,
        total: removed ? Math.max(0, prev.total - 1) : prev.total,
        counts: {
          pending: newValue ? prev.counts.pending - 1 : prev.counts.pending + 1,
          approved: newValue ? prev.counts.approved + 1 : prev.counts.approved - 1,
        },
      }
    })
  }

  const totalLabel = data ? data.total : 0
  const isApproved = props.status === 'approved'

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/admin/news"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste News
      </Link>

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">{props.title}</h1>
        <p className="text-sm text-gray-500 mb-3">{props.subtitle}</p>
        <p
          className={`text-sm font-semibold ${
            isApproved ? 'text-emerald-600' : 'text-gray-700'
          }`}
        >
          {data ? totalLabel : '…'} question{totalLabel > 1 ? 's' : ''}{' '}
          {isApproved ? 'approuvée' : 'en attente'}
          {totalLabel > 1 ? 's' : ''}
        </p>
      </header>

      {/* Filtres */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher dans le texte de la question…"
              className="w-full pl-10 pr-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]"
            />
          </div>
          <select
            value={specialite}
            onChange={(e) => updateParams({ specialite: e.target.value || null, page: '1' })}
            className="text-sm bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
          >
            <option value="" className="bg-white text-gray-900">Spécialité — Toutes</option>
            {SPECIALITES.map((s) => (
              <option key={s.value} value={s.value} className="bg-white text-gray-900">
                {s.label}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value, page: '1' })}
            className="text-sm bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-white text-gray-900">
                Tri : {s.label}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">Erreur de chargement</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
        </div>
      ) : !data || data.total === 0 ? (
        <EmptyState
          message={props.emptyMessage}
          icon={props.emptyIcon}
          showReset={hasActiveFilters}
          onReset={resetFilters}
        />
      ) : (
        <>
          <div className="space-y-4">
            {data.questions.map((q) => (
              <QuestionCard key={q.id} question={q} onApprovalChange={handleApprovalChange} />
            ))}
          </div>
          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            total={data.total}
            onChange={(p) => updateParams({ page: String(p) })}
          />
        </>
      )}
    </div>
  )
}

function QuestionCard({
  question,
  onApprovalChange,
}: {
  question: NewsQuestion
  onApprovalChange: (questionId: string, newValue: boolean) => void
}) {
  const typeLabel = QUESTION_TYPE_LABEL[question.question_type] ?? question.question_type
  const difficultyLabel =
    question.difficulty != null
      ? '★'.repeat(Math.max(1, Math.min(3, question.difficulty)))
      : null
  const validOptions = isValidOptions(question.options)
  const synthesis = question.synthesis

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {synthesis?.specialite && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
            {synthesis.specialite}
          </span>
        )}
        {synthesis?.niveau_preuve && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
            {synthesis.niveau_preuve}
          </span>
        )}
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
          {typeLabel}
        </span>
        {difficultyLabel && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
            {difficultyLabel}
          </span>
        )}
        {question.points != null && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
            {question.points} pts
          </span>
        )}
      </div>

      <p className="font-medium text-gray-900 mb-3">{question.question_text}</p>

      {validOptions ? (
        <ul className="space-y-2 mb-3">
          {(question.options as QuestionOption[]).map((opt) => (
            <li
              key={opt.id}
              className={`flex items-start gap-2 p-2.5 rounded-lg ${
                opt.correct
                  ? 'bg-emerald-50 border border-emerald-200'
                  : 'bg-gray-50'
              }`}
            >
              <span className="font-mono text-xs font-bold w-6 text-gray-700">{opt.id}</span>
              <span className="text-sm text-gray-800 flex-1">{opt.text}</span>
              {opt.correct && (
                <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
          <p className="text-sm font-semibold text-red-800 mb-1">⚠ Format options invalide</p>
          <pre className="text-xs font-mono text-red-700 whitespace-pre-wrap break-all">
            {JSON.stringify(question.options, null, 2)}
          </pre>
        </div>
      )}

      {question.feedback_correct && question.feedback_correct.trim() && (
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700 mb-3">
          <span className="font-semibold">Feedback :</span> {question.feedback_correct}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-gray-100">
        {synthesis ? (
          <Link
            href={`/admin/news/${question.news_synthesis_id}`}
            className="text-xs text-gray-600 hover:text-gray-900 hover:underline truncate max-w-[60%]"
          >
            ← {synthesis.display_title || 'Voir la synthèse'}
          </Link>
        ) : (
          <span className="text-xs text-gray-400 italic">Synthèse inconnue</span>
        )}
        <QuestionApprovalButton
          questionId={question.id}
          initialApproved={question.is_daily_quiz_eligible}
          onChange={(newValue) => onApprovalChange(question.id, newValue)}
          size="sm"
        />
      </div>
    </div>
  )
}

function isValidOptions(options: unknown): options is QuestionOption[] {
  if (!Array.isArray(options)) return false
  return options.every(
    (o) =>
      o != null &&
      typeof o === 'object' &&
      typeof (o as any).id === 'string' &&
      typeof (o as any).text === 'string' &&
      typeof (o as any).correct === 'boolean'
  )
}

function EmptyState({
  message,
  icon,
  showReset,
  onReset,
}: {
  message: string
  icon: 'check' | 'inbox'
  showReset: boolean
  onReset: () => void
}) {
  const Icon = icon === 'check' ? CheckCircle2 : Inbox
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
      <Icon
        className={`w-16 h-16 mx-auto mb-4 ${
          icon === 'check' ? 'text-emerald-300' : 'text-gray-300'
        }`}
      />
      <p className="text-gray-700 font-medium mb-4">{message}</p>
      {showReset && (
        <button
          onClick={onReset}
          className="inline-flex items-center gap-2 bg-[#2D1B96] hover:bg-[#231575] text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          Réinitialiser les filtres
        </button>
      )}
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) {
    return (
      <div className="mt-6 text-sm text-gray-500 text-center">
        Page 1 sur 1 • {total} résultat{total > 1 ? 's' : ''}
      </div>
    )
  }
  const pages = buildPageWindow(page, totalPages)
  return (
    <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
      <div className="text-sm text-gray-600">
        Page <span className="font-semibold">{page}</span> sur{' '}
        <span className="font-semibold">{totalPages}</span> • {total} résultats
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Précédent
        </button>
        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`gap-${idx}`} className="px-2 text-gray-500 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-[36px] px-2 py-1.5 rounded-lg text-sm border transition-colors ${
                p === page
                  ? 'bg-[#2D1B96] text-white border-[#2D1B96]'
                  : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Suivant
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function buildPageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const result: (number | '…')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) result.push('…')
  for (let i = left; i <= right; i++) result.push(i)
  if (right < total - 1) result.push('…')
  result.push(total)
  return result
}
