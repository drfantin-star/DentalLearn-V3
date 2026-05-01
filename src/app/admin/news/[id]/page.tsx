'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, notFound } from 'next/navigation'
import {
  ArrowLeft,
  Calendar,
  Sparkles,
  Link2,
  ExternalLink,
  AlertTriangle,
  AlertCircle,
  Check,
  Loader2,
} from 'lucide-react'
import {
  FORMATION_CATEGORY_LABELS,
  FORMATION_CATEGORY_GROUPS,
  FormationCategorySlug,
} from '@/lib/constants/news'
import { describeCardDate, formatDate } from '@/lib/news-display'
import { QuestionApprovalButton } from '@/components/admin/news/QuestionApprovalButton'
import { AudioPodcastBlock } from '@/components/admin/news/AudioPodcastBlock'

// ---------- Types ----------

interface Synthesis {
  id: string
  raw_id: string | null
  scored_id: string | null
  display_title: string | null
  summary_fr: string | null
  method: string | null
  key_figures: string[] | string | null
  evidence_level: string | null
  clinical_impact: string | null
  caveats: string | null
  specialite: string | null
  themes: string[] | null
  niveau_preuve: string | null
  keywords_libres: string[] | null
  category_editorial: string | null
  formation_category_match: FormationCategorySlug | string | null
  status: string
  failed_attempts: number
  manual_added: boolean
  llm_model: string | null
  embedding: unknown
  validation_warnings: unknown
  validation_errors: unknown
  created_at: string
  published_at: string | null
}

interface RawArticle {
  title: string
  url: string | null
  doi: string | null
  journal: string | null
  published_at: string | null
  abstract: string | null
}

interface QuestionOption {
  id: string
  text: string
  correct: boolean
}

interface Question {
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
}

// ---------- Constantes UI ----------

const CATEGORY_EDITORIAL_BADGE: Record<string, string> = {
  scientifique: 'bg-blue-50 text-blue-700',
  pratique: 'bg-green-50 text-green-700',
  reglementaire: 'bg-orange-50 text-orange-700',
  humour: 'bg-pink-50 text-pink-700',
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  active: { label: 'Active', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { label: 'En échec', cls: 'bg-amber-100 text-amber-700' },
  failed_permanent: { label: 'Échec permanent', cls: 'bg-red-100 text-red-700' },
  retracted: { label: 'Rétractée', cls: 'bg-gray-200 text-gray-700' },
  deleted: { label: 'Supprimée', cls: 'bg-gray-300 text-gray-600' },
}

const QUESTION_TYPE_LABEL: Record<string, string> = {
  mcq: 'QCM (1 bonne)',
  true_false: 'Vrai / Faux',
  checkbox: 'Choix multiples',
}

// ---------- Page ----------

export default function NewsDetailPage() {
  const params = useParams()
  const id = params?.id as string

  const [synthesis, setSynthesis] = useState<Synthesis | null>(null)
  const [raw, setRaw] = useState<RawArticle | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [questionsLoading, setQuestionsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [questionsError, setQuestionsError] = useState<string | null>(null)
  const [notFoundFlag, setNotFoundFlag] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    const loadDetail = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/admin/news/syntheses/${id}`)
        if (res.status === 404) {
          if (!cancelled) setNotFoundFlag(true)
          return
        }
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
        if (!cancelled) {
          setSynthesis(json.synthesis as Synthesis)
          setRaw((json.raw as RawArticle) ?? null)
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const loadQuestions = async () => {
      setQuestionsLoading(true)
      setQuestionsError(null)
      try {
        const res = await fetch(`/api/admin/news/syntheses/${id}/questions`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
        if (!cancelled) setQuestions((json.questions ?? []) as Question[])
      } catch (e: any) {
        if (!cancelled) setQuestionsError(e?.message || 'Erreur de chargement')
      } finally {
        if (!cancelled) setQuestionsLoading(false)
      }
    }

    loadDetail()
    loadQuestions()

    return () => {
      cancelled = true
    }
  }, [id])

  if (notFoundFlag) {
    notFound()
  }

  if (loading) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-3xl mx-auto">
        <BackLink />
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">Erreur de chargement</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!synthesis) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <BackLink />
        <Header synthesis={synthesis} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <main className="lg:col-span-2 space-y-6">
            <SynthesisDetailsCard synthesis={synthesis} />
            <RawSourceCard raw={raw} />
            <QuestionsCard
              questions={questions}
              loading={questionsLoading}
              error={questionsError}
              onApprovalChange={(qid, newValue) =>
                setQuestions((prev) =>
                  prev.map((qi) =>
                    qi.id === qid ? { ...qi, is_daily_quiz_eligible: newValue } : qi
                  )
                )
              }
            />
            <AudioPodcastBlock synthesisId={synthesis.id} />
          </main>
          <aside className="space-y-6">
            <MatchFormationCard
              synthesisId={synthesis.id}
              slug={synthesis.formation_category_match}
              onChange={(newSlug) =>
                setSynthesis((prev) =>
                  prev ? { ...prev, formation_category_match: newSlug } : prev
                )
              }
            />
            <MetadataCard synthesis={synthesis} />
            <ValidationCard
              warnings={synthesis.validation_warnings}
              errors={synthesis.validation_errors}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

// ---------- Sous-composants ----------

function BackLink() {
  return (
    <Link
      href="/admin/news"
      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
      Retour à la liste
    </Link>
  )
}

function Header({ synthesis }: { synthesis: Synthesis }) {
  const dateInfo = describeCardDate(synthesis.published_at, synthesis.created_at)
  const editorialBadge = synthesis.category_editorial
    ? CATEGORY_EDITORIAL_BADGE[synthesis.category_editorial] ?? 'bg-gray-100 text-gray-700'
    : null
  const statusBadge = STATUS_BADGE[synthesis.status] ?? {
    label: synthesis.status,
    cls: 'bg-gray-100 text-gray-700',
  }
  const formationLabel =
    synthesis.formation_category_match
      ? (FORMATION_CATEGORY_LABELS as Record<string, string>)[
          synthesis.formation_category_match
        ] ?? synthesis.formation_category_match
      : null

  return (
    <header>
      <h1 className="text-3xl font-bold text-gray-900 mb-3">
        {synthesis.display_title || 'Sans titre'}
      </h1>
      <div className="flex flex-wrap gap-2 mb-3">
        {synthesis.specialite && (
          <Badge cls="bg-indigo-50 text-indigo-700">{synthesis.specialite}</Badge>
        )}
        {synthesis.niveau_preuve && (
          <Badge cls="bg-purple-50 text-purple-700">{synthesis.niveau_preuve}</Badge>
        )}
        {synthesis.category_editorial && editorialBadge && (
          <Badge cls={editorialBadge}>{synthesis.category_editorial}</Badge>
        )}
        <Badge cls={statusBadge.cls}>{statusBadge.label}</Badge>
        {formationLabel && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-yellow-50 text-yellow-800">
            <Link2 className="w-3 h-3" />
            {formationLabel}
          </span>
        )}
      </div>
      <p
        className="inline-flex items-center gap-1.5 text-sm text-gray-500"
        title={
          dateInfo.fromPublication
            ? 'Date de publication scientifique'
            : 'Date de génération de la synthèse'
        }
      >
        {dateInfo.fromPublication ? (
          <Calendar className="w-3.5 h-3.5" />
        ) : (
          <Sparkles className="w-3.5 h-3.5" />
        )}
        {dateInfo.label}
      </p>
    </header>
  )
}

function Badge({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className={`text-xs font-medium px-2 py-1 rounded-full ${cls}`}>{children}</span>
  )
}

function SynthesisDetailsCard({ synthesis }: { synthesis: Synthesis }) {
  const keyFigures = formatKeyFigures(synthesis.key_figures)
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Synthèse scientifique</h2>
      <Section label="Résumé" content={synthesis.summary_fr} />
      <Section label="Méthode" content={synthesis.method} />
      <Section label="Chiffres clés" content={keyFigures} />
      <Section label="Niveau de preuve" content={synthesis.evidence_level} />
      <Section label="Impact clinique" content={synthesis.clinical_impact} />
      <Section label="Limites" content={synthesis.caveats} />
    </div>
  )
}

function formatKeyFigures(value: string[] | string | null): string | null {
  if (value == null) return null
  if (Array.isArray(value)) {
    const filtered = value.map((v) => String(v).trim()).filter(Boolean)
    return filtered.length ? filtered.map((v) => `• ${v}`).join('\n') : null
  }
  return value
}

function Section({ label, content }: { label: string; content: string | null }) {
  if (!content || !content.trim()) return null
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-1.5">
        {label}
      </h3>
      <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{content}</p>
    </div>
  )
}

function RawSourceCard({ raw }: { raw: RawArticle | null }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Article source</h2>
      {raw ? (
        <>
          <p className="text-base font-medium text-gray-900 mb-2">{raw.title}</p>
          {(raw.journal || raw.published_at) && (
            <p className="text-sm text-gray-600 mb-3">
              {raw.journal}
              {raw.journal && raw.published_at && ' • '}
              {raw.published_at && <>Publié le {formatDate(raw.published_at)}</>}
            </p>
          )}
          {(raw.url || raw.doi) && (
            <div className="flex flex-wrap gap-3 mb-3">
              {raw.url && (
                <a
                  href={raw.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#2D1B96] hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Lire sur PubMed
                </a>
              )}
              {raw.doi && (
                <a
                  href={`https://doi.org/${raw.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-[#2D1B96] hover:underline"
                >
                  DOI : {raw.doi}
                </a>
              )}
            </div>
          )}
          {raw.abstract && (
            <details className="mt-4">
              <summary className="text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                Voir l'abstract original
              </summary>
              <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed mt-2">
                {raw.abstract}
              </p>
            </details>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-500 italic">
          Article source non disponible (raw_id manquant)
        </p>
      )}
    </div>
  )
}

function QuestionsCard({
  questions,
  loading,
  error,
  onApprovalChange,
}: {
  questions: Question[]
  loading: boolean
  error: string | null
  onApprovalChange: (questionId: string, newValue: boolean) => void
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Questions liées ({loading ? '…' : questions.length})
      </h2>
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 animate-pulse">
              <div className="h-4 w-32 bg-gray-200 rounded mb-3" />
              <div className="h-4 bg-gray-100 rounded w-full mb-2" />
              <div className="h-4 bg-gray-100 rounded w-4/5 mb-3" />
              <div className="h-8 bg-gray-100 rounded mb-1" />
              <div className="h-8 bg-gray-100 rounded mb-1" />
              <div className="h-8 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      ) : questions.length === 0 ? (
        <p className="text-sm text-gray-500 italic">Aucune question liée à cette synthèse.</p>
      ) : (
        <div className="space-y-4">
          {questions.map((q) => (
            <QuestionItem
              key={q.id}
              question={q}
              onApprovalChange={(newValue) => onApprovalChange(q.id, newValue)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function QuestionItem({
  question,
  onApprovalChange,
}: {
  question: Question
  onApprovalChange: (newValue: boolean) => void
}) {
  const typeLabel = QUESTION_TYPE_LABEL[question.question_type] ?? question.question_type
  const difficultyLabel =
    question.difficulty != null
      ? '★'.repeat(Math.max(1, Math.min(3, question.difficulty)))
      : null
  const validOptions = isValidOptions(question.options)

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">
            Question {question.question_order ?? '?'}
          </span>
          <Badge cls="bg-gray-100 text-gray-700">{typeLabel}</Badge>
          {difficultyLabel && (
            <Badge cls="bg-amber-50 text-amber-700">{difficultyLabel}</Badge>
          )}
          {question.points != null && (
            <Badge cls="bg-indigo-50 text-indigo-700">{question.points} pts</Badge>
          )}
        </div>
        <QuestionApprovalButton
          questionId={question.id}
          initialApproved={question.is_daily_quiz_eligible}
          onChange={onApprovalChange}
          size="sm"
        />
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
        <div className="bg-gray-50 rounded-lg p-3 text-sm text-gray-700">
          <span className="font-semibold">Feedback :</span> {question.feedback_correct}
        </div>
      )}

      {question.recommended_time_seconds != null && (
        <p className="text-xs text-gray-500 mt-2">
          Temps recommandé : {question.recommended_time_seconds}s
        </p>
      )}
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

function MatchFormationCard({
  synthesisId,
  slug,
  onChange,
}: {
  synthesisId: string
  slug: string | null
  onChange: (newSlug: string | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const label = slug
    ? (FORMATION_CATEGORY_LABELS as Record<string, string>)[slug] ?? slug
    : null

  const startEditing = () => {
    setDraft(slug ?? '')
    setError(null)
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
    setDraft('')
    setError(null)
  }

  const saveMatch = async () => {
    setSaving(true)
    setError(null)
    try {
      const newValue = draft === '' ? null : draft
      const res = await fetch(`/api/admin/news/syntheses/${synthesisId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formation_category_match: newValue }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Erreur ${res.status}`)
      }
      onChange(newValue)
      setEditing(false)
      setToast('Modifié')
      setTimeout(() => setToast(null), 2000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold text-gray-900">Match formation</h3>
        {!editing && !toast && (
          <button
            onClick={startEditing}
            className="text-xs text-[#2D1B96] hover:underline font-medium"
          >
            Modifier
          </button>
        )}
        {toast && (
          <span className="text-xs text-emerald-600 font-medium">✓ {toast}</span>
        )}
      </div>

      {!editing ? (
        label ? (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-yellow-50 text-yellow-800 text-sm">
            <Link2 className="w-3.5 h-3.5" />
            {label}
          </div>
        ) : (
          <p className="text-sm text-gray-500 italic">Aucune correspondance</p>
        )
      ) : (
        <div className="space-y-3">
          <select
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={saving}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D1B96] disabled:opacity-50"
          >
            <option value="" className="bg-white text-gray-900">
              — Aucune correspondance —
            </option>
            {FORMATION_CATEGORY_GROUPS.map((group) => (
              <optgroup key={group.axisLabel} label={group.axisLabel}>
                {group.slugs.map((s) => (
                  <option key={s} value={s} className="bg-white text-gray-900">
                    {FORMATION_CATEGORY_LABELS[s]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="flex gap-2">
            <button
              onClick={saveMatch}
              disabled={saving}
              className="flex-1 px-3 py-2 bg-[#2D1B96] hover:bg-[#231575] text-white text-sm font-medium rounded-lg disabled:opacity-50"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              onClick={cancelEditing}
              disabled={saving}
              className="px-3 py-2 border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MetadataCard({ synthesis }: { synthesis: Synthesis }) {
  const statusBadge = STATUS_BADGE[synthesis.status] ?? {
    label: synthesis.status,
    cls: 'bg-gray-100 text-gray-700',
  }
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">Métadonnées techniques</h3>
      <dl className="space-y-2 text-sm">
        <Row label="Statut" value={<Badge cls={statusBadge.cls}>{statusBadge.label}</Badge>} />
        <Row label="Tentatives" value={`${synthesis.failed_attempts} / 2`} />
        <Row
          label="Embedding"
          value={synthesis.embedding ? '✓ Présent' : '✗ Absent'}
        />
        <Row label="Ajout manuel" value={synthesis.manual_added ? 'Oui' : 'Non'} />
        {synthesis.llm_model && <Row label="Modèle" value={synthesis.llm_model} />}
        <Row label="Généré le" value={formatDate(synthesis.created_at)} />
        <Row
          label="ID"
          value={
            <span className="font-mono text-xs text-gray-600 select-all break-all">
              {synthesis.id}
            </span>
          }
        />
      </dl>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-900 text-right">{value}</dd>
    </div>
  )
}

function ValidationCard({
  warnings,
  errors,
}: {
  warnings: unknown
  errors: unknown
}) {
  const hasWarnings = isNonEmpty(warnings)
  const hasErrors = isNonEmpty(errors)
  if (!hasWarnings && !hasErrors) return null

  return (
    <>
      {hasErrors && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <h3 className="text-sm font-semibold text-red-900">Erreurs de validation</h3>
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap break-all text-red-900">
            {JSON.stringify(errors, null, 2)}
          </pre>
        </div>
      )}
      {hasWarnings && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">
              Avertissements de validation
            </h3>
          </div>
          <pre className="text-xs font-mono whitespace-pre-wrap break-all text-amber-900">
            {JSON.stringify(warnings, null, 2)}
          </pre>
        </div>
      )}
    </>
  )
}

function isNonEmpty(value: unknown): boolean {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return true
}
