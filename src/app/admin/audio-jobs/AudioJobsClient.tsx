'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

import Badge, { type BadgeVariant } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import type {
  AudioJobListItem,
  AudioJobStatus,
  AudioJobType,
  AudioJobsListResponse,
  CostSummaryResponse,
} from '@/types/audio-jobs'

const STATUS_OPTIONS: { value: '' | AudioJobStatus; label: string }[] = [
  { value: '', label: 'Tous statuts' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

const TYPE_OPTIONS: { value: '' | AudioJobType; label: string }[] = [
  { value: '', label: 'Tous types' },
  { value: 'elevenlabs_generation', label: 'ElevenLabs (audio)' },
  { value: 'scene_extraction', label: 'Scene extraction' },
]

const PERIOD_OPTIONS = [
  { value: '7d', label: '7 jours' },
  { value: '30d', label: '30 jours' },
  { value: 'all', label: 'Tout' },
] as const

type Period = (typeof PERIOD_OPTIONS)[number]['value']

const STATUS_VARIANT: Record<AudioJobStatus, BadgeVariant> = {
  pending: 'neutral',
  running: 'info',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
}

const POLL_INTERVAL_MS = 5000

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatCost(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value.toFixed(4)} €`
}

function formatChars(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value.toLocaleString('fr-FR')
}

function formatDuration(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  const m = Math.floor(value / 60)
  const s = value % 60
  return m > 0 ? `${m}m ${s}s` : `${s}s`
}

function jobTarget(job: AudioJobListItem): {
  label: string
  href: string | null
} {
  if (job.sequence_id) {
    return {
      label: job.sequence_title ?? `Séquence ${job.sequence_id.slice(0, 8)}…`,
      href: `/admin/poc/extract-scenes?sequence_id=${job.sequence_id}`,
    }
  }
  if (job.news_episode_id) {
    return {
      label:
        job.news_episode_title ??
        `Épisode news ${job.news_episode_id.slice(0, 8)}…`,
      href: null,
    }
  }
  return { label: '—', href: null }
}

export function AudioJobsClient() {
  const [statusFilter, setStatusFilter] = useState<'' | AudioJobStatus>('')
  const [typeFilter, setTypeFilter] = useState<'' | AudioJobType>('')
  const [period, setPeriod] = useState<Period>('all')
  const [page, setPage] = useState<number>(1)
  const limit = 20

  const [data, setData] = useState<AudioJobsListResponse | null>(null)
  const [costSummary, setCostSummary] = useState<CostSummaryResponse | null>(
    null,
  )
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedJob, setSelectedJob] = useState<AudioJobListItem | null>(null)
  const [retrying, setRetrying] = useState<boolean>(false)
  const [retryError, setRetryError] = useState<string | null>(null)

  const inFlightRef = useRef<boolean>(false)

  const buildListUrl = useCallback(() => {
    const params = new URLSearchParams()
    if (statusFilter) params.set('status', statusFilter)
    if (typeFilter) params.set('job_type', typeFilter)
    if (period !== 'all') params.set('period', period)
    params.set('page', String(page))
    params.set('limit', String(limit))
    return `/api/admin/audio-jobs?${params.toString()}`
  }, [statusFilter, typeFilter, period, page])

  const fetchList = useCallback(
    async (signal?: AbortSignal) => {
      if (inFlightRef.current) return
      inFlightRef.current = true
      try {
        const res = await fetch(buildListUrl(), {
          method: 'GET',
          cache: 'no-store',
          signal,
        })
        if (!res.ok) {
          const text = await res.text().catch(() => '')
          throw new Error(`HTTP ${res.status} — ${text.slice(0, 200)}`)
        }
        const json = (await res.json()) as AudioJobsListResponse
        if (signal?.aborted) return
        setData(json)
        setError(null)
      } catch (e) {
        if ((e as { name?: string }).name === 'AbortError') return
        setError(e instanceof Error ? e.message : String(e))
      } finally {
        inFlightRef.current = false
      }
    },
    [buildListUrl],
  )

  const fetchCostSummary = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch('/api/admin/audio-jobs/cost-summary', {
        method: 'GET',
        cache: 'no-store',
        signal,
      })
      if (!res.ok) return
      const json = (await res.json()) as CostSummaryResponse | null
      if (!signal?.aborted) setCostSummary(json)
    } catch {
      // silencieux : la liste est l'info principale
    }
  }, [])

  // Initial + filter changes
  useEffect(() => {
    const ctrl = new AbortController()
    setLoading(true)
    Promise.all([fetchList(ctrl.signal), fetchCostSummary(ctrl.signal)]).finally(
      () => {
        if (!ctrl.signal.aborted) setLoading(false)
      },
    )
    return () => ctrl.abort()
  }, [fetchList, fetchCostSummary])

  // Auto-poll si jobs pending/running présents
  const hasActiveJobs = useMemo(() => {
    if (!data) return false
    return data.jobs.some(
      (j) => j.status === 'pending' || j.status === 'running',
    )
  }, [data])

  useEffect(() => {
    if (!hasActiveJobs) return
    const ctrl = new AbortController()
    const id = setInterval(() => {
      void fetchList(ctrl.signal)
      void fetchCostSummary(ctrl.signal)
    }, POLL_INTERVAL_MS)
    return () => {
      ctrl.abort()
      clearInterval(id)
    }
  }, [hasActiveJobs, fetchList, fetchCostSummary])

  const handleRefresh = useCallback(() => {
    void fetchList()
    void fetchCostSummary()
  }, [fetchList, fetchCostSummary])

  const handleRetry = useCallback(
    async (job: AudioJobListItem) => {
      setRetrying(true)
      setRetryError(null)
      try {
        const res = await fetch(`/api/admin/audio-jobs/${job.id}/retry`, {
          method: 'POST',
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(
            (body as { message?: string }).message ?? `HTTP ${res.status}`,
          )
        }
        setSelectedJob(null)
        await fetchList()
        await fetchCostSummary()
      } catch (e) {
        setRetryError(e instanceof Error ? e.message : String(e))
      } finally {
        setRetrying(false)
      }
    },
    [fetchList, fetchCostSummary],
  )

  const totalPages = data?.total_pages ?? 0

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Audio Jobs</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitoring transverse des jobs audio (formations + news)
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleRefresh}
          loading={loading}
        >
          Refresh
        </Button>
      </div>

      <CostBanner summary={costSummary} />

      <Card variant="flat">
        <CardHeader>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm text-gray-700">
              Statut&nbsp;
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as '' | AudioJobStatus)
                  setPage(1)
                }}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              Type&nbsp;
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value as '' | AudioJobType)
                  setPage(1)
                }}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              Période&nbsp;
              <select
                value={period}
                onChange={(e) => {
                  setPeriod(e.target.value as Period)
                  setPage(1)
                }}
                className="border border-gray-300 rounded-lg px-2 py-1 text-sm"
              >
                {PERIOD_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="ml-auto text-sm text-gray-500">
              {data ? `${data.total} job(s)` : '—'}
              {hasActiveJobs ? (
                <span className="ml-2 text-indigo-600">
                  · auto-refresh actif
                </span>
              ) : null}
            </div>
          </div>
        </CardHeader>
        <CardBody className="p-0">
          {error ? (
            <div className="p-6 text-sm text-red-700 bg-red-50 border-t border-red-200">
              {error}
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-700">
                <tr>
                  <th className="text-left px-4 py-3 font-semibold">Date</th>
                  <th className="text-left px-4 py-3 font-semibold">Type</th>
                  <th className="text-left px-4 py-3 font-semibold">Cible</th>
                  <th className="text-left px-4 py-3 font-semibold">Statut</th>
                  <th className="text-right px-4 py-3 font-semibold">Durée</th>
                  <th className="text-right px-4 py-3 font-semibold">Chars</th>
                  <th className="text-right px-4 py-3 font-semibold">Coût</th>
                  <th className="text-right px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data && data.jobs.length === 0 ? (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-gray-500"
                    >
                      Aucun job ne correspond aux filtres.
                    </td>
                  </tr>
                ) : null}
                {data?.jobs.map((job) => {
                  const target = jobTarget(job)
                  return (
                    <tr
                      key={job.id}
                      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setSelectedJob(job)}
                    >
                      <td className="px-4 py-3 text-gray-700">
                        {formatDateTime(job.created_at)}
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {job.job_type === 'elevenlabs_generation'
                          ? 'ElevenLabs'
                          : 'Scene extraction'}
                      </td>
                      <td className="px-4 py-3 text-gray-700">{target.label}</td>
                      <td className="px-4 py-3">
                        <Badge variant={STATUS_VARIANT[job.status]} size="sm">
                          {job.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatDuration(job.duration_sec)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatChars(job.chars_consumed)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatCost(job.cost_eur)}
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setSelectedJob(job)}
                          >
                            Détails
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            disabled={job.status !== 'failed' || retrying}
                            onClick={() => handleRetry(job)}
                          >
                            Retry
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 ? (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
              <Button
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Précédent
              </Button>
              <div className="text-gray-600">
                Page {page} / {totalPages}
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Suivant →
              </Button>
            </div>
          ) : null}
        </CardBody>
      </Card>

      {selectedJob ? (
        <JobDetailPanel
          job={selectedJob}
          onClose={() => {
            setSelectedJob(null)
            setRetryError(null)
          }}
          onRetry={() => handleRetry(selectedJob)}
          retrying={retrying}
          retryError={retryError}
        />
      ) : null}
    </div>
  )
}

function CostBanner({ summary }: { summary: CostSummaryResponse | null }) {
  if (!summary) {
    return (
      <Card variant="flat">
        <CardBody>
          <div className="text-sm text-gray-500">
            Chargement des coûts du mois…
          </div>
        </CardBody>
      </Card>
    )
  }

  const elevenlabs = summary.by_type?.elevenlabs_generation
  const scene = summary.by_type?.scene_extraction
  const total = summary.total

  return (
    <Card variant="flat">
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">
            Coûts mois en cours — {summary.month}
          </h2>
        </div>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <CostCard
            title="ElevenLabs (audio)"
            chars={elevenlabs?.chars ?? 0}
            cost={elevenlabs?.cost_eur ?? 0}
            count={elevenlabs?.cnt ?? 0}
          />
          <CostCard
            title="Scene extraction (Sonnet)"
            chars={scene?.chars ?? 0}
            cost={scene?.cost_eur ?? 0}
            count={scene?.cnt ?? 0}
          />
          <CostCard
            title="Total"
            chars={total?.chars ?? 0}
            cost={total?.cost_eur ?? 0}
            count={total?.count ?? 0}
            highlight
          />
        </div>
      </CardBody>
    </Card>
  )
}

function CostCard({
  title,
  chars,
  cost,
  count,
  highlight,
}: {
  title: string
  chars: number
  cost: number
  count: number
  highlight?: boolean
}) {
  return (
    <div
      className={
        highlight
          ? 'rounded-xl border border-primary/30 bg-primary/5 p-4'
          : 'rounded-xl border border-gray-200 p-4'
      }
    >
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {title}
      </div>
      <div className="mt-2 text-2xl font-semibold text-gray-900">
        {cost.toFixed(4)} €
      </div>
      <div className="mt-1 text-xs text-gray-600">
        {chars.toLocaleString('fr-FR')} chars · {count} job(s)
      </div>
    </div>
  )
}

function JobDetailPanel({
  job,
  onClose,
  onRetry,
  retrying,
  retryError,
}: {
  job: AudioJobListItem
  onClose: () => void
  onRetry: () => void
  retrying: boolean
  retryError: string | null
}) {
  const target = jobTarget(job)
  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
        aria-hidden
      />
      <aside className="fixed inset-y-0 right-0 w-full max-w-[480px] bg-white shadow-2xl z-50 overflow-y-auto">
        <div className="p-6 border-b border-gray-200 flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-500">
              Job{' '}
              {job.job_type === 'elevenlabs_generation'
                ? 'ElevenLabs'
                : 'Scene extraction'}
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mt-1 break-all">
              {job.id}
            </h3>
            <div className="mt-2">
              <Badge variant={STATUS_VARIANT[job.status]}>{job.status}</Badge>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>
        <div className="p-6 space-y-4 text-sm text-gray-800">
          <Field label="Cible">
            {target.href ? (
              <Link
                href={target.href}
                className="text-primary hover:underline"
              >
                {target.label}
              </Link>
            ) : (
              <span>{target.label}</span>
            )}
          </Field>
          <Field label="Créé le">{formatDateTime(job.created_at)}</Field>
          <Field label="Démarré">
            {job.started_at ? formatDateTime(job.started_at) : '—'}
          </Field>
          <Field label="Terminé">
            {job.completed_at ? formatDateTime(job.completed_at) : '—'}
          </Field>
          <Field label="Durée audio">{formatDuration(job.duration_sec)}</Field>
          <Field label="Chars consommés">
            {formatChars(job.chars_consumed)}
          </Field>
          <Field label="Coût">{formatCost(job.cost_eur)}</Field>
          <Field label="With timestamps">
            {job.with_timestamps ? 'oui' : 'non'}
          </Field>
          <Field label="Retry count">{job.retry_count}</Field>
          {job.batch_id ? (
            <Field label="Batch">
              {job.batch_id.slice(0, 8)}… · index {job.batch_index ?? '—'}
            </Field>
          ) : null}
          {job.audio_url ? (
            <Field label="audio_url">
              <a
                href={job.audio_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline break-all"
              >
                {job.audio_url}
              </a>
            </Field>
          ) : null}
          {job.timeline_url ? (
            <Field label="timeline_url">
              <a
                href={job.timeline_url}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline break-all"
              >
                {job.timeline_url}
              </a>
            </Field>
          ) : null}
          {job.error_log ? (
            (() => {
              const isWarning = job.status === 'completed'
              const isSceneExtractionWarning =
                isWarning &&
                job.error_log.message === 'scene_extraction_completed'
              const blockClasses = isWarning
                ? 'bg-yellow-50 border border-yellow-200 text-yellow-900 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap'
                : 'bg-red-50 border border-red-200 text-red-900 text-xs p-3 rounded-lg overflow-x-auto whitespace-pre-wrap'
              return (
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">
                    error_log
                  </div>
                  {isSceneExtractionWarning ? (
                    <div className="text-xs text-yellow-700 mb-1">
                      Extraction réussie — warnings non bloquants
                    </div>
                  ) : null}
                  <pre className={blockClasses}>
                    {JSON.stringify(job.error_log, null, 2)}
                  </pre>
                </div>
              )
            })()
          ) : null}
          {retryError ? (
            <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
              {retryError}
            </div>
          ) : null}
          {job.status === 'failed' ? (
            <div className="pt-2">
              <Button
                variant="primary"
                size="md"
                onClick={onRetry}
                loading={retrying}
              >
                Relancer ce job
              </Button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-gray-500">
        {label}
      </div>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}
