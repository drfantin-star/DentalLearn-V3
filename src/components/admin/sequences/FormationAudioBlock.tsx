'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Loader2, Mic } from 'lucide-react'

import Badge from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import type { AudioJobStatusResponse } from '@/types/audio-jobs'
import { TimelineSchema } from '@/lib/timeline/schema'

interface FormationAudioBlockProps {
  sequenceId: string
  currentAudioUrl?: string | null
  timelineUrl?: string | null
  // Flag réel `sequences.timeline_published` : true => la timeline est visible
  // côté formation. Bascule le lien « Éditer les scènes → » en badge cliquable
  // « Scènes publiées ».
  timelinePublished?: boolean
}

interface UploadScriptResponse {
  valid: boolean
  repliques: number
  chars: number
  estimatedDurationMin: number
  estimatedCostEur: number
  preview: Array<{ speaker: string; text: string }>
}

type AudioBlockState =
  | { phase: 'idle' }
  | { phase: 'uploading' }
  | { phase: 'ready'; scriptText: string; stats: UploadScriptResponse }
  | { phase: 'generating'; jobId: string; scriptText: string }
  | { phase: 'done'; audioUrl: string; durationSec?: number }
  | { phase: 'error'; errorMessage: string; scriptText?: string }

function formatDuration(sec?: number): string | null {
  if (sec === undefined || sec === null || !Number.isFinite(sec)) return null
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  return `${m}m ${s.toString().padStart(2, '0')}s`
}

async function extractErrorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json()
    if (body?.validation_errors && Array.isArray(body.validation_errors)) {
      return body.validation_errors.join(' • ')
    }
    if (typeof body?.message === 'string') return body.message
    if (typeof body?.error === 'string') return body.error
  } catch {
    // ignore
  }
  return `Erreur HTTP ${res.status}`
}

export function FormationAudioBlock({
  sequenceId,
  currentAudioUrl,
  timelineUrl,
  timelinePublished = false,
}: FormationAudioBlockProps) {
  const initial: AudioBlockState = currentAudioUrl
    ? { phase: 'done', audioUrl: currentAudioUrl }
    : { phase: 'idle' }

  const [state, setState] = useState<AudioBlockState>(initial)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [submittingGenerate, setSubmittingGenerate] = useState(false)
  const [editedScript, setEditedScript] = useState<string>('')
  // Flag défensif : quand l'admin clique « Régénérer » depuis le Cas D, on doit
  // forcer le rendu Cas A même si `currentAudioUrl` est encore renseigné côté
  // parent (le scriptText original n'est pas conservé après le Cas D, donc on
  // ne peut pas relancer directement — il faut un nouvel upload).
  const [userRequestedRegeneration, setUserRequestedRegeneration] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  // §9 handoff — upload manuel d'une timeline.json produite par le pipeline
  // Python (generate_audio_PHASE_2B.py) pour les séquences historiques sans
  // timeline_url.
  const timelineFileInputRef = useRef<HTMLInputElement | null>(null)
  const [timelineUploading, setTimelineUploading] = useState(false)
  const [timelineUploadError, setTimelineUploadError] = useState<string | null>(
    null,
  )
  // null = inconnu/en cours de fetch, true = scènes extraites, false = aucune scène
  const [scenesExtracted, setScenesExtracted] = useState<boolean | null>(null)
  // Suppression manuelle d'une timeline obsolète. `timelineDeleted` masque le
  // badge sans reload : la colonne `timeline_url` (prop) n'est pas resync côté
  // parent après le DELETE, on bascule donc l'UI en React state local.
  const [timelineDeleted, setTimelineDeleted] = useState(false)
  const [deletingTimeline, setDeletingTimeline] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const router = useRouter()

  // Sync prop → state : quand l'admin uploade un MP3, le parent (client
  // component) renseigne `currentAudioUrl` et le redescend en prop, mais
  // `initial` n'est calculé qu'au montage. Sans cette resync le composant
  // resterait figé en 'idle' et le stepper (timeline / extraction de scènes)
  // n'apparaîtrait qu'après un reload manuel. On promeut donc idle → done dès
  // que `currentAudioUrl` est renseigné, en respectant le Cas D « Régénérer »
  // (userRequestedRegeneration) et sans écraser les phases manuelles en cours
  // (uploading/ready/generating/error).
  useEffect(() => {
    if (!currentAudioUrl) return
    if (userRequestedRegeneration) return
    setState((prev) => {
      if (prev.phase === 'idle') {
        return { phase: 'done', audioUrl: currentAudioUrl }
      }
      if (prev.phase === 'done' && prev.audioUrl !== currentAudioUrl) {
        // spread : préserve tout champ futur de la variante done (durationSec…)
        return { ...prev, audioUrl: currentAudioUrl }
      }
      return prev
    })
  }, [currentAudioUrl, userRequestedRegeneration])

  // Fetcher la timeline pour savoir si des scènes ont déjà été extraites.
  // On évite une migration BDD en lisant directement le JSON pointé par
  // `timeline_url`. En cas d'échec (404, JSON invalide, etc.) on retombe sur
  // false pour garder le lien d'extraction disponible.
  useEffect(() => {
    if (!timelineUrl) {
      setScenesExtracted(null)
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(timelineUrl, { cache: 'no-store' })
        if (!res.ok) {
          if (!cancelled) setScenesExtracted(false)
          return
        }
        const json = (await res.json()) as { scenes?: unknown }
        const hasScenes =
          Array.isArray(json?.scenes) && json.scenes.length > 0
        if (!cancelled) setScenesExtracted(hasScenes)
      } catch {
        if (!cancelled) setScenesExtracted(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [timelineUrl])

  // Polling effect for "generating" phase
  useEffect(() => {
    if (state.phase !== 'generating') return
    const jobId = state.jobId
    const scriptText = state.scriptText

    let cancelled = false

    const tick = async () => {
      try {
        const res = await fetch(
          `/api/admin/sequences/${sequenceId}/audio/job-status?jobId=${encodeURIComponent(jobId)}`,
          { method: 'GET' },
        )
        if (!res.ok) return
        const data = (await res.json()) as AudioJobStatusResponse
        if (cancelled) return

        if (data.status === 'completed' && data.audio_url) {
          setState({
            phase: 'done',
            audioUrl: data.audio_url,
            durationSec: data.duration_sec,
          })
        } else if (data.status === 'failed') {
          setState({
            phase: 'error',
            errorMessage: data.error?.message ?? 'Erreur inconnue',
            scriptText,
          })
        } else if (data.status === 'cancelled') {
          setState({ phase: 'idle' })
        }
      } catch {
        // garder l'interval actif, le prochain tick reposera
      }
    }

    // Premier appel immédiat puis toutes les 3 s
    void tick()
    const interval = setInterval(tick, 3000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [state, sequenceId])

  function resetToIdle() {
    setErrorBanner(null)
    setState({ phase: 'idle' })
  }

  async function handleFileSelected(file: File) {
    setErrorBanner(null)
    setState({ phase: 'uploading' })
    try {
      const text = await file.text()
      const res = await fetch(
        `/api/admin/sequences/${sequenceId}/audio/upload-script`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scriptText: text }),
        },
      )
      if (!res.ok) {
        const msg = await extractErrorMessage(res)
        setErrorBanner(msg)
        setState({ phase: 'idle' })
        return
      }
      const stats = (await res.json()) as UploadScriptResponse
      setState({ phase: 'ready', scriptText: text, stats })
      setEditedScript(text)
      setUserRequestedRegeneration(false)
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Erreur de lecture du fichier')
      setState({ phase: 'idle' })
    }
  }

  async function startGeneration(scriptText: string) {
    setErrorBanner(null)
    setSubmittingGenerate(true)
    try {
      const res = await fetch(
        `/api/admin/sequences/${sequenceId}/audio/generate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scriptText, withTimestamps: true }),
        },
      )
      const body = await res.json().catch(() => ({}))

      if (res.status === 202 && typeof body?.jobId === 'string') {
        setState({ phase: 'generating', jobId: body.jobId, scriptText })
        return
      }
      if (res.status === 409 && typeof body?.jobId === 'string') {
        setState({ phase: 'generating', jobId: body.jobId, scriptText })
        return
      }
      const msg =
        (body?.validation_errors && Array.isArray(body.validation_errors)
          ? body.validation_errors.join(' • ')
          : body?.message ?? body?.error) || `Erreur HTTP ${res.status}`
      setErrorBanner(typeof msg === 'string' ? msg : 'Erreur de génération')
    } catch (err) {
      setErrorBanner(err instanceof Error ? err.message : 'Erreur réseau')
    } finally {
      setSubmittingGenerate(false)
    }
  }

  async function handleTimelineFileSelected(file: File) {
    setTimelineUploadError(null)
    setTimelineUploading(true)
    try {
      const text = await file.text()
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch (e) {
        setTimelineUploadError(
          'Fichier JSON invalide : ' +
            (e instanceof Error ? e.message : 'parse error'),
        )
        return
      }
      const parsed = TimelineSchema.safeParse(json)
      if (!parsed.success) {
        // Affichage compact : 3 premières erreurs Zod max.
        const flat = parsed.error.flatten()
        const issues = [
          ...flat.formErrors,
          ...Object.entries(flat.fieldErrors).flatMap(([k, vs]) =>
            (vs ?? []).map((v) => `${k}: ${v}`),
          ),
        ]
        setTimelineUploadError(
          'Schéma timeline invalide : ' +
            issues.slice(0, 3).join(' • ') +
            (issues.length > 3 ? ` (+${issues.length - 3} autres)` : ''),
        )
        return
      }
      if (parsed.data.source_id !== sequenceId) {
        setTimelineUploadError(
          `Timeline pour une autre séquence (source_id="${parsed.data.source_id}" ≠ "${sequenceId}")`,
        )
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(
        `/api/admin/sequences/${sequenceId}/timeline/upload`,
        { method: 'POST', body: formData },
      )
      if (!res.ok) {
        const msg = await extractErrorMessage(res)
        setTimelineUploadError(msg)
        return
      }
      // Succès — la page parent est un client component qui hydrate la séquence
      // via supabase côté navigateur ; router.refresh() ne re-déclenche pas son
      // useEffect, on force donc un reload complet.
      router.refresh()
      if (typeof window !== 'undefined') window.location.reload()
    } catch (err) {
      setTimelineUploadError(
        err instanceof Error ? err.message : 'Erreur de lecture du fichier',
      )
    } finally {
      setTimelineUploading(false)
    }
  }

  async function handleDeleteTimeline() {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Supprimer définitivement la timeline ? Tous les fichiers JSON associés seront effacés.',
      )
    ) {
      return
    }
    setDeleteError(null)
    setDeletingTimeline(true)
    try {
      const res = await fetch(
        `/api/admin/sequences/${sequenceId}/timeline`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        setDeleteError(await extractErrorMessage(res))
        return
      }
      // Succès — on masque le badge et les liens sans reload (React state only).
      setTimelineDeleted(true)
      setScenesExtracted(null)
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : 'Erreur réseau',
      )
    } finally {
      setDeletingTimeline(false)
    }
  }

  async function cancelJob(jobId: string) {
    try {
      await fetch(`/api/admin/sequences/${sequenceId}/audio/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
    } catch {
      // ignore — on revient à idle quoi qu'il arrive
    }
    setState({ phase: 'idle' })
  }

  // ---- Rendu ----

  const header = (badge: React.ReactNode | null) => (
    <CardHeader className="flex items-center justify-between">
      <h2 className="text-lg font-semibold text-gray-900">Audio du cours</h2>
      {badge}
    </CardHeader>
  )

  if (userRequestedRegeneration || state.phase === 'idle' || state.phase === 'uploading') {
    const uploading = state.phase === 'uploading'
    return (
      <Card variant="flat">
        {header(null)}
        <CardBody className="flex flex-col items-center text-center gap-4">
          <div className="p-4 rounded-full bg-gray-100">
            <Mic className="w-8 h-8 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600">
            Aucun audio généré pour cette séquence
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleFileSelected(file)
              e.target.value = ''
            }}
          />
          <Button
            variant="primary"
            size="md"
            loading={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            Uploader un script
          </Button>
          {errorBanner && (
            <p className="text-sm text-red-600 max-w-md">{errorBanner}</p>
          )}
        </CardBody>
      </Card>
    )
  }

  if (state.phase === 'ready') {
    const { stats } = state
    return (
      <Card variant="flat">
        {header(<Badge variant="info">Script prêt</Badge>)}
        <CardBody className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Répliques</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                {stats.repliques}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Durée estimée</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
               {Math.round(stats.estimatedDurationMin * 10) / 10} min
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 p-4">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Coût estimé</p>
              <p className="text-2xl font-semibold text-gray-900 mt-1">
                ~{stats.estimatedCostEur.toFixed(2)}€
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Script dialogue (éditable avant génération)
            </label>
            <textarea
              value={editedScript}
              onChange={(e) => setEditedScript(e.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm font-mono bg-white text-gray-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 resize-y"
              placeholder="Sophie: ...\nMartin: ..."
            />
            <p className="text-xs text-gray-400">
              Modifiez le script si nécessaire. Les stats seront recalculées à la génération.
            </p>
          </div>

          {errorBanner && (
            <p className="text-sm text-red-600">{errorBanner}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="md" onClick={resetToIdle}>
              Changer de script
            </Button>
            <Button
              variant="primary"
              size="md"
              loading={submittingGenerate}
              onClick={() => void startGeneration(editedScript)}
            >
              Générer l'audio
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  if (state.phase === 'generating') {
    const { jobId } = state
    return (
      <Card variant="flat">
        {header(<Badge variant="warning">Génération en cours</Badge>)}
        <CardBody className="flex flex-col items-center text-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <p className="text-sm text-gray-600 max-w-md">
            Génération de l'audio en cours, cette opération peut prendre
            plusieurs minutes...
          </p>
          <Button variant="ghost" size="sm" onClick={() => void cancelJob(jobId)}>
            Annuler
          </Button>
        </CardBody>
      </Card>
    )
  }

  if (state.phase === 'done') {
    const { audioUrl, durationSec } = state
    const durationLabel = formatDuration(durationSec)
    // `timelineDeleted` bascule l'UI vers le bloc « Uploader une timeline »
    // immédiatement après une suppression, sans rechargement de page.
    const hasTimeline = !!timelineUrl && !timelineDeleted
    return (
      <Card variant="flat">
        {header(<Badge variant="success">Audio publié</Badge>)}
        <CardBody className="space-y-4">
          <audio controls src={audioUrl} className="w-full" />
          {durationLabel && (
            <p className="text-sm text-gray-500">Durée : {durationLabel}</p>
          )}
          {hasTimeline ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Badge
                  variant="info"
                  className="bg-white text-ds-turquoise border-ds-turquoise"
                >
                  Timeline disponible
                </Badge>
                {scenesExtracted === true && (
                  <>
                    <Badge variant="success">Scènes extraites</Badge>
                    {timelinePublished ? (
                      // Timeline publiée : badge vert cliquable « Scènes
                      // publiées » à la place du lien, rouvre le même éditeur.
                      <a
                        href={`/admin/timelines/formation/${sequenceId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Scènes publiées — éditer les scènes"
                        // inline-flex : sans ça le Badge (span inline) imbriqué
                        // dans l'<a> n'est pas blockifié comme les badges frères
                        // (enfants directs du flex) et rend plus petit. Aligne la
                        // hauteur sur « Timeline disponible » / « Scènes extraites ».
                        className="inline-flex"
                      >
                        <Badge variant="success">Scènes publiées</Badge>
                      </a>
                    ) : (
                      <a
                        href={`/admin/timelines/formation/${sequenceId}`}
                        className="text-sm text-primary underline underline-offset-2"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Éditer les scènes →
                      </a>
                    )}
                  </>
                )}
                {scenesExtracted === false && (
                  <Link
                    href="/admin/poc/extract-scenes"
                    className="text-sm text-primary underline underline-offset-2"
                  >
                    Extraire les scènes →
                  </Link>
                )}
                <Button
                  variant="secondary"
                  size="sm"
                  loading={deletingTimeline}
                  onClick={() => void handleDeleteTimeline()}
                >
                  Supprimer la timeline
                </Button>
              </div>
              {deleteError && (
                <p className="text-sm text-red-600">{deleteError}</p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  accept=".json,application/json"
                  ref={timelineFileInputRef}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0]
                    if (f) void handleTimelineFileSelected(f)
                    e.target.value = ''
                  }}
                />
                <Button
                  variant="secondary"
                  size="sm"
                  loading={timelineUploading}
                  onClick={() => timelineFileInputRef.current?.click()}
                >
                  {timelineUploading
                    ? 'Upload en cours…'
                    : 'Uploader une timeline (.json)'}
                </Button>
                <span className="text-xs text-gray-500">
                  Pour séquences générées via pipeline Python local
                </span>
              </div>
              {timelineUploadError && (
                <p className="text-sm text-red-600">{timelineUploadError}</p>
              )}
            </div>
          )}
          <div>
            <Button
              variant="secondary"
              size="md"
              onClick={() => {
                setUserRequestedRegeneration(true)
                resetToIdle()
              }}
            >
              Régénérer l'audio
            </Button>
          </div>
        </CardBody>
      </Card>
    )
  }

  // state.phase === 'error'
  const { errorMessage, scriptText } = state
  return (
    <Card variant="flat">
      {header(<Badge variant="danger">Échec de génération</Badge>)}
      <CardBody className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
          <p className="text-sm text-gray-700">La génération audio a échoué.</p>
        </div>
        {errorMessage && (
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
              Détail de l'erreur
            </summary>
            <pre className="mt-2 text-xs text-gray-500 whitespace-pre-wrap break-words">
              {errorMessage}
            </pre>
          </details>
        )}
        {errorBanner && (
          <p className="text-sm text-red-600">{errorBanner}</p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="md" onClick={resetToIdle}>
            Modifier le script
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={submittingGenerate}
            onClick={() => {
              if (scriptText) {
                setEditedScript(scriptText)
                void startGeneration(scriptText)
              } else {
                resetToIdle()
              }
            }}
          >
            Réessayer
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}

export default FormationAudioBlock
