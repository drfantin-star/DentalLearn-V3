'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

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

interface PersistenceMeta {
  storage_path: string
  storage_url: string | null
  sequence_updated: boolean
  warnings: string[]
}

interface SuccessResponse {
  success: true
  timeline: unknown
  llm_meta: ExtractMeta
  warnings: string[]
  dry_run: boolean
  persistence: PersistenceMeta | null
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

type ExtractResponse = SuccessResponse | FailureResponse | { error: string; message?: string }

interface Props {
  sequences: SequenceLite[]
}

export function ExtractScenesClient({ sequences }: Props) {
  const [selectedId, setSelectedId] = useState<string>(
    sequences[0]?.id ?? ''
  )
  const [dryRun, setDryRun] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(false)
  const [result, setResult] = useState<ExtractResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const costEstimate = useMemo(() => {
    if (!result || !('llm_meta' in result) || !result.llm_meta) return null
    const meta = result.llm_meta
    const usd =
      (meta.input_tokens / 1_000_000) * SONNET_INPUT_PRICE_USD_PER_MTOK +
      (meta.output_tokens / 1_000_000) * SONNET_OUTPUT_PRICE_USD_PER_MTOK
    return usd
  }, [result])

  async function handleExtract() {
    if (!selectedId) {
      setError('Aucune séquence sélectionnée.')
      return
    }
    setLoading(true)
    setError(null)
    setResult(null)
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
      const data: ExtractResponse = await res.json()
      if (!res.ok) {
        const failure = data as FailureResponse | { error: string; message?: string }
        if ('errors' in failure && Array.isArray(failure.errors)) {
          setError(`${failure.stage ?? 'error'}: ${failure.errors.join(', ')}`)
        } else if ('error' in failure) {
          setError(`${failure.error}${failure.message ? `: ${failure.message}` : ''}`)
        } else {
          setError('Réponse serveur inattendue.')
        }
        setResult(data)
      } else {
        setResult(data)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  const success = result && 'success' in result && result.success === true
  const successResult = success ? (result as SuccessResponse) : null
  const warnings =
    successResult?.warnings ??
    (result && 'warnings' in result ? result.warnings ?? [] : [])

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
                          {formationTitle} — {seq.title}
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
                ? 'Extraction en cours (20-30s)…'
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

        {/* ─── Métadonnées LLM ─────────────────────────────────────────── */}
        {result && 'llm_meta' in result && result.llm_meta && (
          <section className="mb-6 rounded-xl bg-[color:var(--color-bg-card)]/40 p-6">
            <h2 className="mb-3 text-lg font-semibold text-white">
              Métadonnées LLM
            </h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
              <Meta label="Modèle" value={result.llm_meta.model} />
              <Meta
                label="Tentatives"
                value={String(result.llm_meta.attempts)}
              />
              <Meta
                label="Durée"
                value={`${(result.llm_meta.duration_ms / 1000).toFixed(1)}s`}
              />
              <Meta
                label="Tokens input"
                value={result.llm_meta.input_tokens.toLocaleString('fr-FR')}
              />
              <Meta
                label="Tokens output"
                value={result.llm_meta.output_tokens.toLocaleString('fr-FR')}
              />
              {costEstimate !== null && (
                <Meta
                  label="Coût indicatif"
                  value={`${costEstimate.toFixed(4)} USD`}
                />
              )}
              {result.llm_meta.scenes_count !== undefined && (
                <Meta
                  label="Scènes"
                  value={String(result.llm_meta.scenes_count)}
                />
              )}
              {result.llm_meta.concepts_count !== undefined && (
                <Meta
                  label="Concepts"
                  value={String(result.llm_meta.concepts_count)}
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

        {/* ─── Persistance ────────────────────────────────────────────── */}
        {successResult?.persistence && (
          <section className="mb-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <h2 className="mb-2 text-lg font-semibold text-emerald-300">
              Persistance
            </h2>
            <dl className="grid gap-2 text-sm text-emerald-100">
              <Meta
                label="Storage path"
                value={successResult.persistence.storage_path}
                mono
              />
              <Meta
                label="Storage URL"
                value={successResult.persistence.storage_url ?? '—'}
                mono
              />
              <Meta
                label="sequences.timeline_url updated"
                value={
                  successResult.persistence.sequence_updated ? 'oui' : 'non'
                }
              />
            </dl>
            {successResult.persistence.warnings.length > 0 && (
              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-200">
                {successResult.persistence.warnings.map((w, i) => (
                  <li key={i}>
                    <code>{w}</code>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* ─── Timeline JSON ──────────────────────────────────────────── */}
        {result && (
          <section className="mb-6 rounded-xl bg-[color:var(--color-bg-card)]/40 p-6">
            <h2 className="mb-3 text-lg font-semibold text-white">
              {success ? 'Timeline générée' : 'Sortie partielle'}
            </h2>
            <pre className="max-h-[600px] overflow-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-emerald-100">
              {JSON.stringify(result, null, 2)}
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
