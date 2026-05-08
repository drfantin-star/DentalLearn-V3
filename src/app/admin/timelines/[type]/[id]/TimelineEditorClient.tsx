'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { DirtyStateIndicator } from '@/components/admin/timeline-editor/DirtyStateIndicator'
import { PublishToggleButton } from '@/components/admin/timeline-editor/PublishToggleButton'
import { SceneEditor } from '@/components/admin/timeline-editor/SceneEditor'
import { SceneListSidebar } from '@/components/admin/timeline-editor/SceneListSidebar'
import { TimelinePreviewPanel } from '@/components/admin/timeline-editor/TimelinePreviewPanel'
import { getDefaultTemplatePayload } from '@/lib/timeline/template-defaults'
import type { Scene, Timeline } from '@/lib/timeline/schema'

/**
 * Client universel d'édition de timeline (POC-T6.1.c → T6.3).
 *
 * Layout : 3 colonnes desktop, stack vertical mobile.
 *  - Sidebar gauche : liste scènes + add/delete + bouton "régénérer LLM"
 *    (disabled — placeholder BLOC 2)
 *  - Centre : `<TimelinePreviewPanel>` (audio HTML natif + StructuredWhiteboard)
 *  - Droite : `<SceneEditor>` (métadonnées + template)
 *
 * État local :
 *  - timeline (Timeline | null) — peut être null si la source n'a jamais
 *    été générée (cas news pré-T8).
 *  - selectedSceneId
 *  - isDirty / isSaving
 *  - currentTime, audioMode
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
  const [audioMode, setAudioMode] = useState<'fixed' | 'sync'>('fixed')
  const [published, setPublished] = useState(initialPublished)
  const [toast, setToast] = useState<ToastState | null>(null)

  // Notes locales par scène (intention pédagogique non persistée — V1).
  const [pedagogicalIntents, setPedagogicalIntents] = useState<
    Record<string, string>
  >({})

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
    const id = setTimeout(() => setToast(null), 4500)
    return () => clearTimeout(id)
  }, [toast])

  const selectedScene = useMemo(() => {
    if (!timeline || !selectedSceneId) return null
    return timeline.scenes.find((s) => s.id === selectedSceneId) ?? null
  }, [timeline, selectedSceneId])

  const siblingScenes = useMemo(() => {
    if (!timeline || !selectedSceneId) return []
    return timeline.scenes.filter((s) => s.id !== selectedSceneId)
  }, [timeline, selectedSceneId])

  const updateScene = useCallback(
    (next: Scene) => {
      setTimeline((cur) => {
        if (!cur) return cur
        return {
          ...cur,
          scenes: cur.scenes.map((s) => (s.id === next.id ? next : s)),
        }
      })
      setIsDirty(true)
    },
    []
  )

  const addScene = useCallback(() => {
    setTimeline((cur) => {
      if (!cur) return cur
      const audioDuration = cur.duration_sec
      const start = audioDuration / 2
      const end = Math.min(start + 20, audioDuration)
      const newScene: Scene = {
        id: newSceneId(),
        title: 'Nouvelle scène',
        start_sec: start,
        end_sec: end,
        template: getDefaultTemplatePayload('grid'),
      }
      const nextScenes = [...cur.scenes, newScene]
      setSelectedSceneId(newScene.id)
      return { ...cur, scenes: nextScenes }
    })
    setIsDirty(true)
  }, [])

  const deleteScene = useCallback(
    (sceneId: string) => {
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
    },
    []
  )

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
          data?.details?.fieldErrors
            ? JSON.stringify(data.details.fieldErrors)
            : data?.details?.formErrors?.join('; ') ??
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
              scenes={timeline.scenes}
              currentTime={currentTime}
              onTimeUpdate={setCurrentTime}
              selectedScene={selectedScene}
              audioMode={audioMode}
              onAudioModeChange={setAudioMode}
            />
          </section>

          {/* Right editor */}
          <aside className="lg:max-h-[calc(100vh-90px)]">
            {selectedScene ? (
              <SceneEditor
                scene={selectedScene}
                onChange={updateScene}
                audioDurationSec={timeline.duration_sec}
                siblingScenes={siblingScenes}
                pedagogicalIntent={pedagogicalIntents[selectedScene.id] ?? ''}
                onPedagogicalIntentChange={(s) =>
                  setPedagogicalIntents((cur) => ({
                    ...cur,
                    [selectedScene.id]: s,
                  }))
                }
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
