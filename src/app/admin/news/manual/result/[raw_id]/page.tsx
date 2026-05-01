'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react'
import { formatDate } from '@/lib/news-display'

const POLL_INTERVAL_MS = 3000
const POLL_TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes
const TERMINAL_STATUSES = new Set([
  'success',
  'not_eligible',
  'failed_permanent',
])

interface RawInfo {
  id: string
  title: string
  journal: string | null
  doi: string | null
  url: string | null
  ingested_at: string
}

type ScoringState =
  | { status: 'pending' }
  | {
      status: 'done'
      relevance_score: number | null
      is_eligible: boolean
      reasoning: string | null
      scored_at: string
      internal_status: string
    }

interface SynthesisStatePending {
  status: 'pending'
}
interface SynthesisStateReady {
  status: 'done' | 'failed' | 'failed_permanent'
  id?: string
  display_title?: string | null
  failed_attempts?: number
  validation_errors?: unknown
  created_at?: string
}
type SynthesisState = SynthesisStatePending | SynthesisStateReady

type Overall =
  | 'scoring'
  | 'not_eligible'
  | 'synthesizing'
  | 'success'
  | 'failed'
  | 'failed_permanent'

interface State {
  raw: RawInfo
  scoring: ScoringState
  synthesis: SynthesisState
  overall: Overall
}

export default function ManualResultPage() {
  const params = useParams()
  const rawId = params?.raw_id as string

  const [state, setState] = useState<State | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastFetchedAt, setLastFetchedAt] = useState<number | null>(null)
  const [pollingTimedOut, setPollingTimedOut] = useState(false)

  // Refs pour piloter le polling sans re-créer le setInterval à chaque
  // changement d'état (sinon double-fetch).
  const synthTriggeredRef = useRef(false) // synthesize_articles déclenché
  const stoppedRef = useRef(false) // statut terminal atteint → plus de poll
  const startedAtRef = useRef<number>(Date.now())

  const fetchState = async () => {
    try {
      const res = await fetch(`/api/admin/news/manual-ingest/result/${rawId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Erreur ${res.status}`)
      const next = json.state as State
      setState(next)
      setError(null)
      setLastFetchedAt(Date.now())
      if (TERMINAL_STATUSES.has(next.overall)) {
        stoppedRef.current = true
      }
      // Déclencheur synthesize : scored éligible + pas encore de synthèse.
      if (
        !synthTriggeredRef.current &&
        next.scoring.status === 'done' &&
        next.scoring.is_eligible &&
        next.synthesis.status === 'pending'
      ) {
        synthTriggeredRef.current = true
        fetch(
          `/api/admin/news/manual-ingest/result/${rawId}/trigger-synth`,
          { method: 'POST' }
        ).catch((err) => console.error('Trigger synth front:', err))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur')
    }
  }

  // Premier fetch au mount + polling — un unique useEffect pour éviter les
  // doubles intervals et les leaks.
  useEffect(() => {
    if (!rawId) return
    let cancelled = false

    const tick = async () => {
      if (cancelled || stoppedRef.current) return
      await fetchState()
      if (cancelled) return
      if (Date.now() - startedAtRef.current > POLL_TIMEOUT_MS) {
        stoppedRef.current = true
        setPollingTimedOut(true)
      }
    }

    tick()
    const interval = setInterval(tick, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawId])

  if (!state && !error) {
    return (
      <div className="p-8 max-w-3xl mx-auto flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  if (error && !state) {
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

  if (!state) return null

  const { raw, scoring, synthesis, overall } = state

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <BackLink />

      <header className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">
          Pipeline d'ingestion
        </h1>
        <p className="text-sm italic text-gray-700 line-clamp-2">{raw.title}</p>
        {(raw.doi || raw.url) && (
          <p className="text-xs text-gray-500 mt-1 truncate">
            {raw.doi && <span>DOI : {raw.doi}</span>}
            {raw.doi && raw.url && ' • '}
            {raw.url && <span className="truncate">{raw.url}</span>}
          </p>
        )}
      </header>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-1">
        <Step
          status="done"
          title="Article ingéré"
          description="Article enregistré dans la base de données"
          timestamp={raw.ingested_at}
        />
        <hr className="my-2 border-gray-100" />
        <ScoringStep scoring={scoring} overall={overall} />
        <hr className="my-2 border-gray-100" />
        <SynthesisStep synthesis={synthesis} overall={overall} />
      </div>

      <ResultBanner overall={overall} state={state} />

      {pollingTimedOut && !TERMINAL_STATUSES.has(overall) && (
        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900">
          Le pipeline prend plus de temps que prévu. Vous pouvez quitter cette
          page — l'article sera traité en arrière-plan. Revenez à cette URL
          plus tard pour voir le résultat.
        </div>
      )}

      {!TERMINAL_STATUSES.has(overall) && !pollingTimedOut && (
        <div className="mt-4 flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span>
            Pipeline en cours…
            {lastFetchedAt && (
              <>
                {' '}dernière vérification {formatRelative(lastFetchedAt)}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  )
}

// ---------- Steps ----------

function BackLink() {
  return (
    <Link
      href="/admin/news/manual"
      className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
    >
      <ArrowLeft className="w-4 h-4" />
      Retour à l'ingestion
    </Link>
  )
}

function Step({
  status,
  icon,
  title,
  description,
  timestamp,
  children,
}: {
  status: 'done' | 'pending' | 'running' | 'failed' | 'not_eligible'
  icon?: React.ReactNode
  title: string
  description?: string
  timestamp?: string
  children?: React.ReactNode
}) {
  const defaultIcon =
    icon ??
    (status === 'done' ? (
      <CheckCircle className="w-5 h-5 text-emerald-600" />
    ) : status === 'running' ? (
      <Loader2 className="w-5 h-5 text-[#2D1B96] animate-spin" />
    ) : status === 'failed' ? (
      <AlertTriangle className="w-5 h-5 text-amber-600" />
    ) : status === 'not_eligible' ? (
      <XCircle className="w-5 h-5 text-red-500" />
    ) : (
      <Clock className="w-5 h-5 text-gray-400" />
    ))

  return (
    <div className="flex items-start gap-3 py-2">
      <div className="flex-shrink-0 mt-0.5">{defaultIcon}</div>
      <div className="flex-1 min-w-0">
        <p
          className={`font-medium ${
            status === 'pending' ? 'text-gray-500' : 'text-gray-900'
          }`}
        >
          {title}
        </p>
        {description && (
          <p className="text-sm text-gray-600 mt-0.5">{description}</p>
        )}
        {timestamp && (
          <p className="text-xs text-gray-400 mt-1">
            {formatDate(timestamp)}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}

function ScoringStep({
  scoring,
  overall,
}: {
  scoring: ScoringState
  overall: Overall
}) {
  if (scoring.status === 'pending') {
    return (
      <Step
        status={overall === 'scoring' ? 'running' : 'pending'}
        title="Scoring"
        description={
          overall === 'scoring'
            ? 'Évaluation par Sonnet en cours… (~5s)'
            : 'En attente du scoring…'
        }
      />
    )
  }
  const score =
    typeof scoring.relevance_score === 'number'
      ? scoring.relevance_score.toFixed(2)
      : '?'
  if (!scoring.is_eligible) {
    return (
      <Step
        status="not_eligible"
        title="Scoring"
        description={`Article jugé non éligible (score : ${score})`}
        timestamp={scoring.scored_at}
      >
        {scoring.reasoning && (
          <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-800 whitespace-pre-wrap">
            {scoring.reasoning}
          </div>
        )}
      </Step>
    )
  }
  return (
    <Step
      status="done"
      title="Scoring"
      description={`Article éligible (score : ${score})`}
      timestamp={scoring.scored_at}
    >
      {scoring.reasoning && (
        <details className="mt-2">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Voir le raisonnement
          </summary>
          <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">
            {scoring.reasoning}
          </p>
        </details>
      )}
    </Step>
  )
}

function SynthesisStep({
  synthesis,
  overall,
}: {
  synthesis: SynthesisState
  overall: Overall
}) {
  if (overall === 'not_eligible') {
    return (
      <Step
        status="pending"
        title="Synthèse"
        description="Étape ignorée — article non éligible"
      />
    )
  }
  if (synthesis.status === 'pending') {
    return (
      <Step
        status={overall === 'synthesizing' ? 'running' : 'pending'}
        title="Synthèse"
        description={
          overall === 'synthesizing'
            ? 'Génération de la synthèse + 3-4 questions… (~25s)'
            : 'En attente de la synthèse…'
        }
      />
    )
  }
  if (synthesis.status === 'done') {
    return (
      <Step
        status="done"
        title="Synthèse"
        description={`Synthèse créée : « ${synthesis.display_title || 'Sans titre'} »`}
        timestamp={synthesis.created_at}
      >
        {synthesis.id && (
          <Link
            href={`/admin/news/${synthesis.id}`}
            className="inline-flex items-center gap-1 text-sm text-[#2D1B96] hover:underline mt-2"
          >
            Voir la synthèse →
          </Link>
        )}
      </Step>
    )
  }
  if (synthesis.status === 'failed') {
    return (
      <Step
        status="failed"
        title="Synthèse"
        description={`Échec temporaire (${synthesis.failed_attempts ?? 0} / 2 tentatives) — sera retentée au prochain cron`}
      >
        <ValidationDump payload={synthesis.validation_errors} tone="amber" />
      </Step>
    )
  }
  if (synthesis.status === 'failed_permanent') {
    return (
      <Step
        status="not_eligible"
        title="Synthèse"
        description="Échec permanent — la synthèse ne sera plus retentée"
      >
        <ValidationDump payload={synthesis.validation_errors} tone="red" />
        <Link
          href="/admin/news/failed"
          className="inline-flex items-center gap-1 text-sm text-red-700 hover:underline mt-2"
        >
          Voir dans /admin/news/failed →
        </Link>
      </Step>
    )
  }
  return null
}

function ValidationDump({
  payload,
  tone,
}: {
  payload: unknown
  tone: 'red' | 'amber'
}) {
  if (payload == null) return null
  if (typeof payload === 'object' && Object.keys(payload as object).length === 0) {
    return null
  }
  const cls =
    tone === 'red'
      ? 'bg-red-50 border-red-200 text-red-900'
      : 'bg-amber-50 border-amber-200 text-amber-900'
  return (
    <pre
      className={`mt-2 border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-all max-h-60 overflow-auto ${cls}`}
    >
      {JSON.stringify(payload, null, 2)}
    </pre>
  )
}

// ---------- Result banner ----------

function ResultBanner({ overall, state }: { overall: Overall; state: State }) {
  if (overall === 'success') {
    const id = (state.synthesis as SynthesisStateReady).id
    return (
      <div className="mt-6 bg-emerald-50 border border-emerald-200 rounded-2xl p-5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <CheckCircle className="w-6 h-6 text-emerald-600" />
          <p className="font-semibold text-emerald-900">
            Synthèse créée avec succès !
          </p>
        </div>
        {id && (
          <Link
            href={`/admin/news/${id}`}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Voir la synthèse →
          </Link>
        )}
      </div>
    )
  }
  if (overall === 'not_eligible') {
    return (
      <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <AlertCircle className="w-6 h-6 text-amber-600" />
          <p className="font-semibold text-amber-900">
            Article jugé non éligible
          </p>
        </div>
        <p className="text-sm text-amber-800 mb-3">
          Sonnet a évalué que cet article ne correspond pas aux critères
          éditoriaux. Vous pouvez le retrouver dans la base raw mais il
          n'apparaîtra pas dans /admin/news.
        </p>
        <Link
          href="/admin/news"
          className="inline-flex items-center gap-2 text-sm text-amber-900 hover:underline font-medium"
        >
          Retour à la liste →
        </Link>
      </div>
    )
  }
  if (overall === 'failed' || overall === 'failed_permanent') {
    return (
      <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-5">
        <div className="flex items-center gap-3 mb-2">
          <XCircle className="w-6 h-6 text-red-600" />
          <p className="font-semibold text-red-900">Échec de la synthèse</p>
        </div>
        <p className="text-sm text-red-800 mb-3">
          {overall === 'failed'
            ? 'Échec temporaire. La synthèse sera retentée automatiquement au prochain cron.'
            : 'Échec permanent. Inspectez les erreurs de validation pour comprendre la cause.'}
        </p>
        <Link
          href="/admin/news/failed"
          className="inline-flex items-center gap-2 text-sm text-red-900 hover:underline font-medium"
        >
          Voir dans /admin/news/failed →
        </Link>
      </div>
    )
  }
  return null
}

function formatRelative(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 5) return "à l'instant"
  if (seconds < 60) return `il y a ${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `il y a ${minutes} min`
}
