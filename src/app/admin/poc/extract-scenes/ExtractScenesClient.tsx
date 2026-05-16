'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  SONNET_INPUT_PRICE_USD_PER_MTOK,
  SONNET_OUTPUT_PRICE_USD_PER_MTOK,
} from './pricing'

export interface SequenceLite {
  id: string
  sequence_number: number
  title: string
  timeline_url: string | null
  formation_id: string | null
  formation_title: string | null
}

interface ExtractMeta {
  model: string
  input_tokens: number
  output_tokens: number
  duration_ms: number
  scenes_count?: number
  concepts_count?: number
  attempts: number
}

// Voie DRY-RUN — réponse synchrone historique
interface DryRunSuccess {
  success: true
  timeline: unknown
  llm_meta: ExtractMeta
  warnings: string[]
  dry_run: true
  persistence: null
}

// Voie PROD — ACK fire-and-forget
interface AsyncAck {
  success: true
  async: true
  jobId: string
  status: 'running'
  message: string
}

interface FailureResponse {
  success: false
  stage: string
  errors: string[]
  partial_output?: unknown
  partial_timeline?: unknown
  sonnet_raw?: string
  warnings?: string[]
  llm_meta?: ExtractMeta
}

type PostResponse =
  | DryRunSuccess
  | AsyncAck
  | FailureResponse
  | { error: string; message?: string; jobId?: string }

// Réponse polling /status
interface StatusResponse {
  jobId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  job_type: string | null
  sequence_id: string | null
  timeline_url: string | null
  error_log: {
    message?: string
    scenes_count?: number
    concepts_count?: number
    duration_ms?: number
    tokens_input?: number
    tokens_output?: number
    warnings?: string[]
  } | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

const POLL_INTERVAL_MS = 3000
const POLL_MAX_DURATION_MS = 5 * 60 * 1000 // garde-fou 5 min

interface Props {
  sequences: SequenceLite[]
}

export function ExtractScenesClient({ sequences }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    sequences[0]?.id ?? ''
  )
  const [dryRun, setDryRun] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<PostResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // T5-bis-B — état polling pour la voie async (dry_run=false)
  const [jobStatus, setJobStatus] = useState<StatusResponse | null>(null)
  const [pollStartedAt, setPollStartedAt] = useState<number | null>(null)
  const [elapsedSec, setElapsedSec] = useState<number>(0)
  const [generatedTimeline, setGeneratedTimeline] = useState<unknown | null>(null)
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current)
      if (elapsedTimerRef.current) clearInterval(elapsedTimerRef.current)
    }
  }, [])

  const costEstimate = useMemo(() => {
    // Dry-run path : llm_meta dans la réponse synchrone
    if (
      result &&
      'success' in result &&
      result.success === true &&
      'llm_meta' in result &&
      result.llm_meta
    ) {
      const meta = result.llm_meta
      return (
        (meta.input_tokens / 1_000_000) * SONNET_INPUT_PRICE_USD_PER_MTOK +
        (meta.output_tokens / 1_000_000) * SONNET_OUTPUT_PRICE_USD_PER_MTOK
      )
    }
    // Async path : tokens dans jobStatus.error_log (la Edge Function les
    // loggue là — pas idéal sémantiquement mais évite une colonne dédiée).
    if (
      jobStatus?.status === 'completed' &&
      jobStatus.error_log?.tokens_input !== undefined &&
      jobStatus.error_log?.tokens_output !== undefined
    ) {
      return (
        ((jobStatus.error_log.tokens_input ?? 0) / 1_000_000) *
          SONNET_INPUT_PRICE_USD_PER_MTOK +
        ((jobStatus.error_log.tokens_output ?? 0) / 1_000_000) *
          SONNET_OUTPUT_PRICE_USD_PER_MTOK
      )
    }
    return null
  }, [result, jobStatus])

  function stopPolling() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current)
      pollTimerRef.current = null
    }
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
  }

  async function pollOnce(jobId: string, startedAt: number) {
    if (Date.now() - startedAt > POLL_MAX_DURATION_MS) {
      stopPolling()
      setError(
        `Polling abandonné : aucun résultat après ${Math.round(POLL_MAX_DURATION_MS / 60000)} min. Vérifier le job ${jobId} côté Supabase.`
      )
      setLoading(false)
      return
    }
    try {
      const res = await fetch(
        `/api/admin/timeline/extract-scenes/status?jobId=${encodeURIComponent(jobId)}`,
        { cache: 'no-store' }
      )
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        throw new Error(`status HTTP ${res.status}: ${txt.slice(0, 200)}`)
      }
      const status = (await res.json()) as StatusResponse
      setJobStatus(status)

      if (status.status === 'completed') {
        stopPolling()
        setLoading(false)
        // Fetch la Timeline JSON pour affichage
        if (status.timeline_url) {
          try {
            const tlRes = await fetch(status.timeline_url, { cache: 'no-store' })
            if (tlRes.ok) {
              const tl = await tlRes.json()
              setGeneratedTimeline(tl)
            }
          } catch {
            // Non bloquant : on a déjà status + timeline_url
          }
        }
        return
      }
      if (status.status === 'failed' || status.status === 'cancelled') {
        stopPolling()
        setLoading(false)
        setError(
          status.error_log?.message ??
            `Job terminé en status=${status.status} sans message d'erreur.`
        )
        return
      }
      // pending | running → re-poll
      pollTimerRef.current = setTimeout(
        () => void pollOnce(jobId, startedAt),
        POLL_INTERVAL_MS
      )
    } catch (e) {
      // Erreur réseau isolée — on retente quand même au prochain tick au
      // lieu d'avorter, mais on remonte le message à l'écran.
      const msg = e instanceof Error ? e.message : String(e)
      setError(`Polling: ${msg} (retry…)`)
      pollTimerRef.current = setTimeout(
        () => void pollOnce(jobId, startedAt),
        POLL_INTERVAL_MS
      )
    }
  }

  async function handleExtract() {
    if (!selectedId) {
      setError('Aucune séquence sélectionnée.')
      return
    }
    stopPolling()
    setLoading(true)
    setError(null)
    setResult(null)
    setJobStatus(null)
    setGeneratedTimeline(null)
    setPollStartedAt(null)
    setElapsedSec(0)

    try {
      const url = `/api/admin/timeline/extract-scenes?dry_run=${dryRun ? 'true' : 'false'}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_type: 'formation_sequence',
          source_id: selectedId,
        }),
      })
      const data = (await res.json()) as PostResponse
      setResult(data)

      if (!res.ok) {
        if ('errors' in data && Array.isArray(data.errors)) {
          setError(`${data.stage ?? 'error'}: ${data.errors.join(', ')}`)
        } else if ('error' in data) {
          setError(
            `${data.error}${data.message ? `: ${data.message}` : ''}${
              'jobId' in data && data.jobId ? ` (jobId=${data.jobId})` : ''
            }`
          )
        } else {
          setError('Réponse serveur inattendue.')
        }
        setLoading(false)
        return
      }

      // ----- Voie async (PROD fire-and-forget) -----
      if ('async' in data && data.async === true) {
        const startedAt = Date.now()
        setPollStartedAt(startedAt)
        elapsedTimerRef.current = setInterval(() => {
          setElapsedSec(Math.round((Date.now() - startedAt) / 1000))
        }, 1000)
        void pollOnce(data.jobId, startedAt)
        return
      }

      // ----- Voie dry_run synchrone -----
      setLoading(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    }
  }

  // Synthèse pour le rendu — préfère les meta async si dispo, sinon dry-run.
  const dryRunResult: DryRunSuccess | null =
    result && 'success' in result && result.success === true && 'dry_run' in result
      ? (result as DryRunSuccess)
      : null
  const warnings: string[] = useMemo(() => {
    if (dryRunResult?.warnings) return dryRunResult.warnings
    if (jobStatus?.status === 'completed' && jobStatus.error_log?.warnings)
      return jobStatus.error_log.warnings
    return []
  }, [dryRunResult, jobStatus])

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)] p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 space-y-2">
          <p className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
            POC Visualisation audio · Admin · T5.3
          </p>
          <h1 className="text-2xl font-bold text-white">
            Extraction de scènes via LLM
          </h1>
          <p className="text-sm text-[color:var(--color-text-secondary)]">
            Déclenche un appel Sonnet 4.6 sur la séquence sélectionnée pour
            identifier 3 à 5 passages structurels (whiteboard) et 5 à 12
            concepts (définitions). En mode dry-run, le résultat n'est pas
            persisté ; sinon il est uploadé dans <code>audio-timelines/poc/</code>{' '}
            et la colonne <code>sequences.timeline_url</code> est mise à jour.
          </p>
          <div className="text-xs space-x-4">
            <Link
              href="/admin/poc/karaoke"
              className="text-ds-turquoise hover:underline"
            >
              ← POC Karaoké
            </Link>
            <Link
              href="/admin/poc/whiteboard-templates"
              className="text-ds-turquoise hover:underline"
            >
              POC Whiteboard
            </Link>
          </div>
        </header>

        {/* ─── Configuration ─────────────────────────────────────────── */}
        <section className="mb-6 rounded-xl bg-[color:var(--color-bg-card)]/40 p-6">
          <h2 className="mb-4 text-lg font-semibold text-white">
            Configuration
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Séquence
              </label>
              {sequences.length === 0 ? (
                <p className="text-sm text-[color:var(--color-text-secondary)]">
                  Aucune séquence avec <code>course_media_url</code> non null.
                  Vérifier que les séquences ont bien un audio source uploadé.
                </p>
              ) : (
                <select
                  value={selectedId}
                  onChange={(e) => setSelectedId(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-[color:var(--color-bg-card)] px-3 py-2 text-sm text-white focus:border-ds-turquoise focus:outline-none"
                  disabled={loading}
                >
                  {Object.entries(
                    sequences.reduce<Record<string, SequenceLite[]>>((acc, seq) => {
                      const key = seq.formation_title ?? '(Formation inconnue)'
                      ;(acc[key] ??= []).push(seq)
                      return acc
                    }, {})
                  ).map(([formationTitle, seqs]) => (
                    <optgroup key={formationTitle} label={formationTitle}>
                      {seqs.map((seq) => (
                        <option key={seq.id} value={seq.id}>
                          {formationTitle} — {seq.sequence_number ? `#${seq.sequence_number} ` : ''}{seq.title}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setDryRun(!dryRun)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  dryRun ? 'bg-ds-turquoise' : 'bg-white/20'
                }`}
                disabled={loading}
                aria-pressed={dryRun}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    dryRun ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <div>
                <p className="text-sm font-medium text-white">Dry run</p>
                <p className="text-xs text-[color:var(--color-text-muted)]">
                  {dryRun
                    ? 'Affichage seul, pas de persistance Storage / sequences.'
                    : 'ATTENTION : la timeline sera uploadée et timeline_url mis à jour.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExtract}
              disabled={loading || sequences.length === 0}
              className="rounded-lg bg-ds-turquoise px-4 py-2 text-sm font-semibold text-axe3 disabled:opacity-50"
            >
              {loading
                ? dryRun
                  ? 'Extraction en cours (20-30s)…'
                  : jobStatus?.status === 'running'
                  ? `Extraction asynchrone… ${elapsedSec}s`
                  : 'Démarrage du job…'
                : 'Extraire les scènes via LLM'}
            </button>
          </div>
        </section>

        {/* ─── Erreur ─────────────────────────────────────────────────── */}
        {error && (
          <section className="mb-6 rounded-xl border border-red-500/30 bg-red-500/15 p-6">
            <h2 className="mb-2 text-lg font-semibold text-red-300">Erreur</h2>
            <p className="text-sm text-red-200">{error}</p>
          </section>
        )}

        {/* ─── État du job async (T5-bis-B) ───────────────────────────── */}
        {pollStartedAt !== null && jobStatus !== null && (
          <section
            className={`mb-6 rounded-xl p-6 ${
              jobStatus.status === 'completed'
                ? 'border border-emerald-500/30 bg-emerald-500/10'
                : jobStatus.status === 'failed'
                ? 'border border-red-500/30 bg-red-500/15'
                : 'border border-sky-500/30 bg-sky-500/10'
            }`}
          >
            <h2 className="mb-2 text-lg font-semibold text-white">
              Job async — {jobStatus.status}
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <Meta label="Job ID" value={jobStatus.jobId} mono />
              <Meta label="Durée écoulée" value={`${elapsedSec}s`} />
              {jobStatus.started_at && (
                <Meta
                  label="Started at"
                  value={new Date(jobStatus.started_at).toLocaleTimeString(
                    'fr-FR'
                  )}
                />
              )}
              {jobStatus.completed_at && (
                <Meta
                  label="Completed at"
                  value={new Date(jobStatus.completed_at).toLocaleTimeString(
                    'fr-FR'
                  )}
                />
              )}
              {jobStatus.error_log?.scenes_count !== undefined && (
                <Meta
                  label="Scènes"
                  value={String(jobStatus.error_log.scenes_count)}
                />
              )}
              {jobStatus.error_log?.concepts_count !== undefined && (
                <Meta
                  label="Concepts"
                  value={String(jobStatus.error_log.concepts_count)}
                />
              )}
              {jobStatus.error_log?.duration_ms !== undefined && (
                <Meta
                  label="Durée extraction"
                  value={`${(jobStatus.error_log.duration_ms / 1000).toFixed(1)}s`}
                />
              )}
              {jobStatus.error_log?.tokens_input !== undefined && (
                <Meta
                  label="Tokens input"
                  value={jobStatus.error_log.tokens_input.toLocaleString(
                    'fr-FR'
                  )}
                />
              )}
              {jobStatus.error_log?.tokens_output !== undefined && (
                <Meta
                  label="Tokens output"
                  value={jobStatus.error_log.tokens_output.toLocaleString(
                    'fr-FR'
                  )}
                />
              )}
              {costEstimate !== null && (
                <Meta
                  label="Coût indicatif"
                  value={`${costEstimate.toFixed(4)} USD`}
                />
              )}
              {jobStatus.timeline_url && (
                <Meta
                  label="timeline_url"
                  value={jobStatus.timeline_url}
                  mono
                />
              )}
            </dl>
          </section>
        )}

        {/* ─── Métadonnées LLM (dry-run uniquement) ───────────────────── */}
        {dryRunResult?.llm_meta && (
          <section className="mb-6 rounded-xl bg-[color:var(--color-bg-card)]/40 p-6">
            <h2 className="mb-3 text-lg font-semibold text-white">
              Métadonnées LLM (dry-run)
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <Meta label="Modèle" value={dryRunResult.llm_meta.model} />
              <Meta
                label="Tentatives"
                value={String(dryRunResult.llm_meta.attempts)}
              />
              <Meta
                label="Durée"
                value={`${(dryRunResult.llm_meta.duration_ms / 1000).toFixed(1)}s`}
              />
              <Meta
                label="Tokens input"
                value={dryRunResult.llm_meta.input_tokens.toLocaleString(
                  'fr-FR'
                )}
              />
              <Meta
                label="Tokens output"
                value={dryRunResult.llm_meta.output_tokens.toLocaleString(
                  'fr-FR'
                )}
              />
              {costEstimate !== null && (
                <Meta
                  label="Coût indicatif"
                  value={`${costEstimate.toFixed(4)} USD`}
                />
              )}
              {dryRunResult.llm_meta.scenes_count !== undefined && (
                <Meta
                  label="Scènes"
                  value={String(dryRunResult.llm_meta.scenes_count)}
                />
              )}
              {dryRunResult.llm_meta.concepts_count !== undefined && (
                <Meta
                  label="Concepts"
                  value={String(dryRunResult.llm_meta.concepts_count)}
                />
              )}
            </dl>
          </section>
        )}

        {/* ─── Warnings ───────────────────────────────────────────────── */}
        {warnings.length > 0 && (
          <section className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
            <h2 className="mb-2 text-lg font-semibold text-amber-300">
              Warnings ({warnings.length})
            </h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-amber-100">
              {warnings.map((w, i) => (
                <li key={i}>
                  <code>{w}</code>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* ─── Timeline JSON ──────────────────────────────────────────── */}
        {(dryRunResult?.timeline || generatedTimeline || result) && (
          <section className="mb-6 rounded-xl bg-[color:var(--color-bg-card)]/40 p-6">
            <h2 className="mb-3 text-lg font-semibold text-white">
              {generatedTimeline || dryRunResult?.timeline
                ? 'Timeline générée'
                : 'Réponse serveur'}
            </h2>
            <pre className="max-h-[600px] overflow-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-emerald-100">
              {JSON.stringify(
                generatedTimeline ?? dryRunResult?.timeline ?? result,
                null,
                2
              )}
            </pre>
          </section>
        )}
      </div>
    </main>
  )
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
        {label}
      </dt>
      <dd
        className={`mt-0.5 text-white ${mono ? 'font-mono text-xs break-all' : 'text-sm'}`}
      >
        {value}
      </dd>
    </div>
  )
}
