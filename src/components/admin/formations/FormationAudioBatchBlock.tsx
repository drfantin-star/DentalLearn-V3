'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  FileAudio,
  Loader2,
  UploadCloud,
  XCircle,
} from 'lucide-react'

import Badge from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { cn } from '@/lib/utils/cn'
import type {
  AudioJobStatus,
  BatchStatusResponse,
} from '@/types/audio-jobs'

interface SequenceLite {
  id: string
  sequence_number: number
  title: string
  course_media_url: string | null
}

interface FormationAudioBatchBlockProps {
  formationId: string
  sequences: SequenceLite[]
}

interface ParsedFileLocal {
  file: File
  filename: string
  sequenceNumber: number | null
  matchedSequence: SequenceLite | null
  error: string | null
}

type BatchState =
  | { phase: 'idle' }
  | { phase: 'preview'; parsed: ParsedFileLocal[] }
  | {
      phase: 'running' | 'done'
      batchId: string
      submittedAt: number
    }
  | { phase: 'error'; message: string }

function extractSequenceNumber(filename: string): number | null {
  const m = filename.match(/^0*(\d+)/)
  if (!m) return null
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

function formatDuration(sec?: number | null): string {
  if (sec === undefined || sec === null || !Number.isFinite(sec) || sec <= 0) {
    return '—'
  }
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

function formatCost(eur?: number | null): string {
  if (eur === undefined || eur === null || !Number.isFinite(eur)) return '—'
  return `${eur.toFixed(2)}€`
}

function statusBadgeVariant(
  status: AudioJobStatus,
): 'info' | 'warning' | 'success' | 'danger' | 'neutral' {
  switch (status) {
    case 'pending':
      return 'neutral'
    case 'running':
      return 'warning'
    case 'completed':
      return 'success'
    case 'failed':
      return 'danger'
    case 'cancelled':
      return 'neutral'
  }
}

function statusLabel(status: AudioJobStatus): string {
  switch (status) {
    case 'pending':
      return 'En attente'
    case 'running':
      return 'Génération…'
    case 'completed':
      return 'Terminée'
    case 'failed':
      return 'Échec'
    case 'cancelled':
      return 'Annulée'
  }
}

export function FormationAudioBatchBlock({
  formationId,
  sequences,
}: FormationAudioBatchBlockProps) {
  const [state, setState] = useState<BatchState>({ phase: 'idle' })
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [isDraggingOver, setIsDraggingOver] = useState(false)
  const [batchStatus, setBatchStatus] = useState<BatchStatusResponse | null>(
    null,
  )
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFiles = useCallback(
    (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((f) =>
        f.name.toLowerCase().endsWith('.txt'),
      )
      if (files.length === 0) {
        setErrorBanner('Aucun fichier .txt valide détecté.')
        return
      }

      const seenNumbers = new Set<number>()
      const seqByNumber = new Map<number, SequenceLite>()
      for (const s of sequences) seqByNumber.set(s.sequence_number, s)

      const parsed: ParsedFileLocal[] = files.map((file) => {
        const num = extractSequenceNumber(file.name)
        let matched: SequenceLite | null = null
        let error: string | null = null

        if (num === null) {
          error =
            'Nom sans numéro en préfixe (attendu : "01_xxx.txt").'
        } else if (seenNumbers.has(num)) {
          error = `Numéro ${num} en doublon dans l'upload.`
        } else {
          const seq = seqByNumber.get(num)
          if (!seq) {
            error = `Aucune séquence ${num} dans cette formation.`
          } else {
            matched = seq
            seenNumbers.add(num)
          }
        }

        return {
          file,
          filename: file.name,
          sequenceNumber: num,
          matchedSequence: matched,
          error,
        }
      })

      setErrorBanner(null)
      setState({ phase: 'preview', parsed })
    },
    [sequences],
  )

  // Polling effect — uniquement quand running
  useEffect(() => {
    if (state.phase !== 'running') return
    const batchId = state.batchId
    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/admin/formations/${formationId}/audio/batch-status?batchId=${encodeURIComponent(
            batchId,
          )}`,
          { method: 'GET' },
        )
        if (!res.ok) return
        const data = (await res.json()) as BatchStatusResponse
        if (cancelled) return
        setBatchStatus(data)
        const remaining = data.counts.pending + data.counts.running
        if (remaining === 0) {
          setState((prev) =>
            prev.phase === 'running'
              ? { phase: 'done', batchId, submittedAt: prev.submittedAt }
              : prev,
          )
        }
      } catch {
        // garder l'interval actif
      }
    }

    void tick()
    const interval = setInterval(tick, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [state, formationId])

  function resetToIdle() {
    setErrorBanner(null)
    setBatchStatus(null)
    setState({ phase: 'idle' })
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDraggingOver(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files)
    }
  }

  async function launchBatch(parsed: ParsedFileLocal[]) {
    setErrorBanner(null)
    setSubmitting(true)
    try {
      const formData = new FormData()
      for (const p of parsed) {
        if (p.error || !p.matchedSequence) continue
        formData.append('scripts', p.file, p.filename)
      }
      const res = await fetch(
        `/api/admin/formations/${formationId}/audio/batch-generate`,
        { method: 'POST', body: formData },
      )
      const body = await res.json().catch(() => ({}))

      if (res.status === 202 && typeof body?.batchId === 'string') {
        setState({
          phase: 'running',
          batchId: body.batchId,
          submittedAt: Date.now(),
        })
        return
      }
      if (
        res.status === 409 &&
        typeof body?.existing_batch_id === 'string' &&
        body.existing_batch_id
      ) {
        // On rebascule sur le batch déjà en cours pour visualiser sa progression.
        setState({
          phase: 'running',
          batchId: body.existing_batch_id,
          submittedAt: Date.now(),
        })
        return
      }
      if (
        body?.file_errors &&
        Array.isArray(body.file_errors) &&
        body.file_errors.length > 0
      ) {
        const msg = body.file_errors
          .map((e: { filename: string; error: string }) =>
            `${e.filename} : ${e.error}`,
          )
          .join(' • ')
        setErrorBanner(msg)
        return
      }
      setErrorBanner(
        typeof body?.message === 'string'
          ? body.message
          : `Erreur HTTP ${res.status}`,
      )
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Rendu ----

  const header = (rightSlot: React.ReactNode | null) => (
    <CardHeader className="flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">
          Génération audio batch
        </h2>
        <p className="text-xs text-gray-500 mt-0.5">
          {sequences.length} séquence{sequences.length > 1 ? 's' : ''} dans
          cette formation
        </p>
      </div>
      {rightSlot}
    </CardHeader>
  )

  if (state.phase === 'idle') {
    return (
      <Card variant="flat">
        {header(null)}
        <CardBody className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setIsDraggingOver(true)
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={onDrop}
            className={cn(
              'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors',
              isDraggingOver
                ? 'border-primary bg-primary/5'
                : 'border-gray-300 bg-gray-50',
            )}
          >
            <UploadCloud className="w-10 h-10 text-gray-400" />
            <p className="text-sm text-gray-700">
              Glissez les fichiers <code className="px-1 py-0.5 bg-white border border-gray-200 rounded">.txt</code>{' '}
              des scripts ici
            </p>
            <p className="text-xs text-gray-500 max-w-md">
              Le préfixe du nom de fichier doit correspondre au numéro de
              séquence (ex. <code>01_intro.txt</code>, <code>02_anatomie.txt</code>).
              Tous les scripts sont validés avant lancement.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
            <Button
              variant="secondary"
              size="md"
              onClick={() => fileInputRef.current?.click()}
            >
              Sélectionner les fichiers
            </Button>
          </div>
          {errorBanner && (
            <p className="text-sm text-red-600">{errorBanner}</p>
          )}
        </CardBody>
      </Card>
    )
  }

  if (state.phase === 'preview') {
    const { parsed } = state
    const validCount = parsed.filter((p) => !p.error && p.matchedSequence).length
    const hasErrors = parsed.some((p) => p.error !== null)
    return (
      <Card variant="flat">
        {header(
          <Badge variant={hasErrors ? 'warning' : 'info'}>
            {validCount}/{parsed.length} mappées
          </Badge>,
        )}
        <CardBody className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                  <th className="py-2 pr-3">Fichier</th>
                  <th className="py-2 pr-3">N°</th>
                  <th className="py-2 pr-3">Séquence cible</th>
                  <th className="py-2">État</th>
                </tr>
              </thead>
              <tbody>
                {parsed.map((p) => (
                  <tr
                    key={p.filename}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <td className="py-2 pr-3 font-mono text-xs text-gray-700">
                      {p.filename}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      {p.sequenceNumber ?? '—'}
                    </td>
                    <td className="py-2 pr-3 text-gray-700">
                      {p.matchedSequence
                        ? `S${p.matchedSequence.sequence_number} — ${p.matchedSequence.title}`
                        : '—'}
                    </td>
                    <td className="py-2">
                      {p.error ? (
                        <span className="text-xs text-red-600">{p.error}</span>
                      ) : (
                        <Badge variant="success" size="sm">
                          OK
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {errorBanner && <p className="text-sm text-red-600">{errorBanner}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="md" onClick={resetToIdle}>
              Changer de fichiers
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={submitting}
              disabled={hasErrors || validCount === 0}
              onClick={() => void launchBatch(parsed)}
            >
              Lancer le batch ({validCount})
            </Button>
            {hasErrors && (
              <p className="text-xs text-amber-700">
                Corrigez les fichiers en erreur pour pouvoir lancer le batch.
              </p>
            )}
          </div>
        </CardBody>
      </Card>
    )
  }

  // running ou done
  const isRunning = state.phase === 'running'
  const totalCost = (batchStatus?.jobs ?? []).reduce(
    (acc, j) => acc + (j.costEur ?? 0),
    0,
  )
  const totalDuration = (batchStatus?.jobs ?? []).reduce(
    (acc, j) => acc + (j.durationSec ?? 0),
    0,
  )
  const failedCount = batchStatus?.counts.failed ?? 0
  const completedCount = batchStatus?.counts.completed ?? 0
  const totalCount = batchStatus?.totalJobs ?? 0

  return (
    <Card variant="flat">
      {header(
        isRunning ? (
          <Badge variant="warning">
            <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />
            Batch en cours
          </Badge>
        ) : failedCount > 0 ? (
          <Badge variant="warning">Batch terminé (échecs partiels)</Badge>
        ) : (
          <Badge variant="success">Batch terminé</Badge>
        ),
      )}
      <CardBody className="space-y-4">
        {!batchStatus && (
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            Chargement de l'état du batch…
          </div>
        )}

        {batchStatus && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Avancement
                </p>
                <p className="text-xl font-semibold text-gray-900 mt-1">
                  {completedCount + failedCount}/{totalCount}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Réussies
                </p>
                <p className="text-xl font-semibold text-emerald-700 mt-1">
                  {completedCount}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Échecs
                </p>
                <p
                  className={cn(
                    'text-xl font-semibold mt-1',
                    failedCount > 0 ? 'text-red-700' : 'text-gray-900',
                  )}
                >
                  {failedCount}
                </p>
              </div>
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  Coût total
                </p>
                <p className="text-xl font-semibold text-gray-900 mt-1">
                  {formatCost(totalCost)}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-200">
                    <th className="py-2 pr-3">N°</th>
                    <th className="py-2 pr-3">Séquence</th>
                    <th className="py-2 pr-3">Statut</th>
                    <th className="py-2 pr-3">Durée</th>
                    <th className="py-2">Coût</th>
                  </tr>
                </thead>
                <tbody>
                  {batchStatus.jobs.map((j) => (
                    <tr
                      key={j.jobId}
                      className="border-b border-gray-100 last:border-b-0 align-top"
                    >
                      <td className="py-2 pr-3 text-gray-700">
                        S{j.sequenceNumber}
                      </td>
                      <td className="py-2 pr-3 text-gray-700">
                        <div className="flex flex-col">
                          <span>{j.sequenceTitle}</span>
                          {j.status === 'failed' && j.error?.message && (
                            <span className="text-xs text-red-600 mt-1">
                              {j.error.message}
                            </span>
                          )}
                          {j.status === 'completed' && j.audioUrl && (
                            <a
                              href={j.audioUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                            >
                              <FileAudio className="w-3 h-3" />
                              Écouter
                            </a>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-3">
                        <Badge
                          variant={statusBadgeVariant(j.status)}
                          size="sm"
                        >
                          {j.status === 'completed' && (
                            <CheckCircle2 className="inline w-3 h-3 mr-1" />
                          )}
                          {j.status === 'failed' && (
                            <XCircle className="inline w-3 h-3 mr-1" />
                          )}
                          {j.status === 'running' && (
                            <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />
                          )}
                          {statusLabel(j.status)}
                        </Badge>
                      </td>
                      <td className="py-2 pr-3 text-gray-700 tabular-nums">
                        {formatDuration(j.durationSec)}
                      </td>
                      <td className="py-2 text-gray-700 tabular-nums">
                        {formatCost(j.costEur)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!isRunning && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-gray-600">
                  Durée totale générée : {formatDuration(totalDuration)}
                </p>
                {failedCount > 0 && (
                  <span className="inline-flex items-center text-xs text-amber-700">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {failedCount} séquence{failedCount > 1 ? 's' : ''} en échec
                    — relancez le batch après correction des scripts.
                  </span>
                )}
              </div>
            )}

            <div>
              <Button
                variant="secondary"
                size="md"
                onClick={resetToIdle}
                disabled={isRunning}
              >
                Nouveau batch
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  )
}

export default FormationAudioBatchBlock
