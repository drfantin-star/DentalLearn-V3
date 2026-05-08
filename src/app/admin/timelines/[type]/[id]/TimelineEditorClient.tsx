'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { DirtyStateIndicator } from '@/components/admin/timeline-editor/DirtyStateIndicator'
import { PublishToggleButton } from '@/components/admin/timeline-editor/PublishToggleButton'
import { SceneEditor } from '@/components/admin/timeline-editor/SceneEditor'
import { SceneListSidebar } from '@/components/admin/timeline-editor/SceneListSidebar'
import { TimelinePreviewPanel } from '@/components/admin/timeline-editor/TimelinePreviewPanel'
import { getActiveScene } from '@/lib/timeline/getActiveScene'
import { getDefaultTemplatePayload } from '@/lib/timeline/template-defaults'
import type { Scene, Timeline } from '@/lib/timeline/schema'

/**
 * Client universel d'édition de timeline (POC-T6.1.c → T6.3 + patches A/B/C).
 *
 * Layout : 3 colonnes desktop, stack vertical mobile.
 *
 * État local :
 *  - timeline (Timeline | null) — peut être null si la source n'a jamais
 *    été générée (cas news pré-T8).
 *  - selectedSceneId
 *  - isDirty / isSaving
 *  - currentTime, isPlaying — état audio pur (Patch C, plus de toggle UX)
 *  - audioDurationSec — cascade timeline.duration_sec → audio.duration runtime
 *    → fallback 300 (Patch A, fix add-scene avec course_duration_seconds null)
 *  - sceneToRender (memo) — calculée à partir de isPlaying / currentTime /
 *    selectedSceneId (Patch B, plus de conflit currentTime ↔ sélection)
 *  - published
 *
 * Sauvegarde : PUT /api/admin/timelines/{type}/{id} avec timeline complète.
 */

type SourceType = 'formation' | 'news'

interface Props {
  type: SourceType
  id: string
  initialTimeline: Timeline | null
  initialPublished: boolean
  initialVersions: string[]
  sourceTitle: string
  /** Affiché en haut quand pas de timeline (cas news pré-T8). */
  noTimelineMessage?: string
}

interface ToastState {
  kind: 'success' | 'error'
  message: string
}

function newSceneId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `sc-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Convertit le `details` retourné par la route API (issu de
 * `ZodError.flatten()`) en chaîne lisible. Pour les erreurs nested d'un
 * `.refine()` au niveau scène (ex : start_sec < end_sec), Zod range
 * l'erreur dans `formErrors` puisque le `path` est nested. On fait un
 * effort raisonnable pour afficher au moins un message clair.
 */
function formatZodFlattened(
  details: unknown
): string | null {
  if (!details || typeof details !== 'object') return null
  const d = details as {
    formErrors?: string[]
    fieldErrors?: Record<string, string[]>
  }
  const parts: string[] = []
  if (d.formErrors && d.formErrors.length > 0) {
    parts.push(...d.formErrors)
  }
  if (d.fieldErrors) {
    for (const [field, errs] of Object.entries(d.fieldErrors)) {
      if (errs && errs.length > 0) parts.push(`${field}: ${errs.join(', ')}`)
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null
}

const FALLBACK_DURATION_SEC = 300

export function TimelineEditorClient({
  type,
  id,
  initialTimeline,
  initialPublished,
  sourceTitle,
  noTimelineMessage,
}: Props) {
  const [timeline, setTimeline] = useState<Timeline | null>(initialTimeline)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(
    initialTimeline?.scenes[0]?.id ?? null
  )
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [published, setPublished] = useState(initialPublished)
  const [toast, setToast] = useState<ToastState | null>(null)

  // Patch A — Cascade durée audio. Initialisée depuis timeline.duration_sec
  // (priorité 1, peuplée par T2 en BDD), surchargée par audio.duration runtime
  // si le browser remonte une durée différente (priorité 2), fallback 300s
  // si rien (priorité 3, log explicite).
  const [audioDurationSec, setAudioDurationSec] = useState<number>(() => {
    const fromTimeline = initialTimeline?.duration_sec
    if (fromTimeline && fromTimeline > 0) return fromTimeline
    // eslint-disable-next-line no-console
    console.warn(
      `[TimelineEditor] No reliable audio duration for source ${id}, using fallback ${FALLBACK_DURATION_SEC}s — will be replaced by browser metadata once <audio> loads.`
    )
    return FALLBACK_DURATION_SEC
  })

  // Ref vers l'élément <audio> contrôlé par TimelinePreviewPanel.
  // Utilisé pour seek programmatique au clic d'une scène en sidebar.
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Avertissement avant fermeture si dirty.
  useEffect(() => {
    if (!isDirty) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [isDirty])

  // Auto-dismiss toast.
  useEffect(() => {
    if (!toast) return
    const tid = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(tid)
  }, [toast])

  const selectedScene = useMemo(() => {
    if (!timeline || !selectedSceneId) return null
    return timeline.scenes.find((s) => s.id === selectedSceneId) ?? null
  }, [timeline, selectedSceneId])

  const siblingScenes = useMemo(() => {
    if (!timeline || !selectedSceneId) return []
    return timeline.scenes.filter((s) => s.id !== selectedSceneId)
  }, [timeline, selectedSceneId])

  // Patch B+C — Calcule la scène à rendre dans la preview.
  //  - Si lecture en cours : on suit `currentTime` via `getActiveScene`.
  //  - Sinon : on rend la scène sélectionnée en sidebar.
  const sceneToRender = useMemo<Scene | null>(() => {
    if (!timeline) return null
    if (isPlaying) {
      return getActiveScene(currentTime, timeline.scenes)
    }
    return selectedScene
  }, [isPlaying, currentTime, selectedScene, timeline])

  // Patch C — Quand la scène sélectionnée change ET qu'on n'est pas en
  // lecture, on seek le curseur audio au début de la scène (UX option β).
  useEffect(() => {
    if (isPlaying || !selectedScene || !audioRef.current) return
    const target = selectedScene.start_sec
    if (Math.abs(audioRef.current.currentTime - target) > 0.5) {
      try {
        audioRef.current.currentTime = target
      } catch {
        // ignore : peut throw si l'audio n'est pas encore chargé
      }
    }
  }, [selectedSceneId, isPlaying, selectedScene])

  // Patch A — Callback duration detected depuis loadedmetadata.
  const handleDurationDetected = useCallback(
    (duration: number) => {
      if (
        duration > 0 &&
        Number.isFinite(duration) &&
        Math.abs(duration - audioDurationSec) > 1
      ) {
        setAudioDurationSec(duration)
      }
    },
    [audioDurationSec]
  )

  const updateScene = useCallback((next: Scene) => {
    setTimeline((cur) => {
      if (!cur) return cur
      return {
        ...cur,
        scenes: cur.scenes.map((s) => (s.id === next.id ? next : s)),
      }
    })
    setIsDirty(true)
  }, [])

  // Patch A — Add scene avec cascade durée + bornes safe.
  const addScene = useCallback(() => {
    setTimeline((cur) => {
      if (!cur) return cur
      const dur = audioDurationSec
      let startSec: number
      let endSec: number
      if (dur > 20) {
        startSec = dur / 2
        endSec = Math.min(startSec + 20, dur)
      } else if (dur >= 5) {
        startSec = 0
        endSec = dur
      } else {
        // Cas dégénéré : on alerte l'admin et on n'ajoute rien.
        if (typeof window !== 'undefined') {
          window.alert(
            'Impossible de créer une scène : durée audio invalide. Recharge la page ou contacte un développeur.'
          )
        }
        return cur
      }
      // Garde-fou : strict <
      if (endSec <= startSec) endSec = startSec + 1

      const newScene: Scene = {
        id: newSceneId(),
        title: 'Nouvelle scène',
        start_sec: startSec,
        end_sec: endSec,
        template: getDefaultTemplatePayload('grid'),
      }
      const nextScenes = [...cur.scenes, newScene]
      setSelectedSceneId(newScene.id)
      return { ...cur, scenes: nextScenes }
    })
    setIsDirty(true)
  }, [audioDurationSec])

  const deleteScene = useCallback((sceneId: string) => {
    setTimeline((cur) => {
      if (!cur) return cur
      const idx = cur.scenes.findIndex((s) => s.id === sceneId)
      if (idx < 0) return cur
      const nextScenes = cur.scenes.filter((s) => s.id !== sceneId)
      // Sélectionner une scène voisine.
      const fallback =
        nextScenes[idx] ?? nextScenes[idx - 1] ?? nextScenes[0] ?? null
      setSelectedSceneId(fallback?.id ?? null)
      return { ...cur, scenes: nextScenes }
    })
    setIsDirty(true)
  }, [])

  async function handleSave() {
    if (!timeline) return
    setIsSaving(true)
    try {
      const res = await fetch(`/api/admin/timelines/${type}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeline }),
      })
      const data = await res.json()
      if (!res.ok) {
        const detail =
          formatZodFlattened(data?.details) ??
          data?.message ??
          data?.error ??
          'Erreur inconnue'
        setToast({
          kind: 'error',
          message: `Sauvegarde refusée : ${detail}`,
        })
        return
      }
      setIsDirty(false)
      setToast({
        kind: 'success',
        message: `Sauvegardé (version ${data.version}).`,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setToast({ kind: 'error', message: `Erreur réseau : ${msg}` })
    } finally {
      setIsSaving(false)
    }
  }

  async function handlePublish(next: boolean) {
    try {
      const res = await fetch(`/api/admin/timelines/${type}/${id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: next }),
      })
      const data = await res.json()
      if (!res.ok) {
        setToast({
          kind: 'error',
          message: `Publication refusée : ${data?.message ?? data?.error ?? 'erreur'}`,
        })
        return
      }
      setPublished(data.published)
      setToast({
        kind: 'success',
        message: data.published
          ? 'Timeline publiée.'
          : 'Timeline dépubliée (retour brouillon).',
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setToast({ kind: 'error', message: `Erreur réseau : ${msg}` })
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--color-bg)] text-[color:var(--color-text-primary)]">
      {/* ─── Header ───────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/5 bg-[color:var(--color-bg)]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Éditeur timeline · {type === 'formation' ? 'Formation' : 'News'}
            </p>
            <h1 className="truncate text-base font-semibold text-white">
              {sourceTitle}
            </h1>
          </div>

          <DirtyStateIndicator isDirty={isDirty} isSaving={isSaving} />

          <PublishToggleButton
            published={published}
            onPublish={handlePublish}
            disabled={!timeline}
          />

          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving || !timeline}
            className="rounded-lg bg-ds-turquoise px-4 py-1.5 text-xs font-semibold text-axe3 hover:bg-ds-turquoise-dark disabled:opacity-50"
          >
            {isSaving ? 'Sauvegarde…' : 'Enregistrer'}
          </button>

          <Link
            href={
              type === 'formation' ? '/admin/poc/extract-scenes' : '/admin/news'
            }
            className="text-xs text-[color:var(--color-text-muted)] hover:text-ds-turquoise"
          >
            ← Retour
          </Link>
        </div>
      </header>

      {/* ─── Body ─────────────────────────────────────────────── */}
      {!timeline ? (
        <div className="mx-auto max-w-3xl p-6">
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6">
            <h2 className="mb-2 text-base font-semibold text-amber-300">
              Aucune timeline générée
            </h2>
            <p className="text-sm text-amber-100">
              {noTimelineMessage ??
                "Cette source n'a pas encore de timeline. Pour les formations, lance le pipeline T2 puis l'extraction LLM (T5). Pour les news, la timeline déterministe sera disponible après T8."}
            </p>
          </div>
        </div>
      ) : (
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-4 p-4 lg:grid-cols-[280px_1fr_360px]">
          {/* Sidebar */}
          <aside className="lg:max-h-[calc(100vh-90px)] lg:overflow-y-auto">
            <SceneListSidebar
              scenes={timeline.scenes}
              selectedSceneId={selectedSceneId}
              onSelect={(sceneId) => setSelectedSceneId(sceneId)}
              onAdd={addScene}
              onDelete={deleteScene}
            />
          </aside>

          {/* Center */}
          <section>
            <TimelinePreviewPanel
              audioUrl={timeline.audio_url}
              sceneToRender={sceneToRender}
              onTimeUpdate={setCurrentTime}
              onPlayingChange={setIsPlaying}
              onDurationDetected={handleDurationDetected}
              audioRef={audioRef}
            />
          </section>

          {/* Right editor */}
          <aside className="lg:max-h-[calc(100vh-90px)]">
            {selectedScene ? (
              <SceneEditor
                scene={selectedScene}
                onChange={updateScene}
                audioDurationSec={audioDurationSec}
                siblingScenes={siblingScenes}
              />
            ) : (
              <div className="rounded-xl bg-[color:var(--color-bg-card)]/30 p-6 text-center text-sm italic text-[color:var(--color-text-muted)]">
                Aucune scène sélectionnée.
              </div>
            )}
          </aside>
        </div>
      )}

      {/* ─── Toast ────────────────────────────────────────────── */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 right-4 z-50 max-w-md rounded-lg border px-4 py-3 text-sm shadow-lg ${
            toast.kind === 'success'
              ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-100'
              : 'border-red-500/40 bg-red-500/15 text-red-100'
          }`}
        >
          {toast.message}
        </div>
      )}
    </main>
  )
}
