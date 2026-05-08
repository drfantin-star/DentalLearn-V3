'use client'

import { useState } from 'react'

import type { Scene, SceneTemplate } from '@/lib/timeline/schema'

import { DragHandle, SortableList } from './SortableList'

/**
 * Sidebar gauche — liste des scènes (POC-T6.1.c + T6.2 + T6.4.b + T6.5.a).
 *
 * BLOC 2 :
 *  - Drag-reorder cosmétique : seul l'ordre du tableau `timeline.scenes` change.
 *    Les `start_sec` / `end_sec` restent intacts (cf. tooltip "?").
 *  - Bouton « Régénérer via LLM » actif quand `onRegenerate` est passé
 *    (formations uniquement — la page news ne le passe pas).
 */

interface Props {
  scenes: Scene[]
  selectedSceneId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  /** Drop d'un drag-reorder cosmétique. */
  onReorder: (next: Scene[]) => void
  /** Si fourni → bouton Régénérer LLM cliquable. Sinon disabled. */
  onRegenerate?: () => void
  /** Spinner sur le bouton Régénérer + locke l'UI. */
  isRegenerating?: boolean
}

const KIND_BADGE_BG: Record<SceneTemplate['kind'], string> = {
  grid: 'bg-sky-500/15 text-sky-300',
  flowchart: 'bg-indigo-500/15 text-indigo-300',
  comparison: 'bg-fuchsia-500/15 text-fuchsia-300',
  figures: 'bg-emerald-500/15 text-emerald-300',
  causal: 'bg-orange-500/15 text-orange-300',
  timeline: 'bg-amber-500/15 text-amber-300',
}

const KIND_LABEL: Record<SceneTemplate['kind'], string> = {
  grid: 'Grille',
  flowchart: 'Flow',
  comparison: 'Comp.',
  figures: 'Chiffres',
  causal: 'Causal',
  timeline: 'Frise',
}

function formatRange(start: number, end: number): string {
  return `${formatSec(start)} – ${formatSec(end)}`
}

function formatSec(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function SceneListSidebar({
  scenes,
  selectedSceneId,
  onSelect,
  onAdd,
  onDelete,
  onReorder,
  onRegenerate,
  isRegenerating = false,
}: Props) {
  const [showHelp, setShowHelp] = useState(false)

  const canRegenerate = typeof onRegenerate === 'function'

  return (
    <div className="flex h-full flex-col gap-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
            Scènes ({scenes.length})
          </h2>
          <button
            type="button"
            aria-label="Aide drag-reorder"
            onClick={() => setShowHelp((s) => !s)}
            className="flex h-4 w-4 items-center justify-center rounded-full border border-white/15 text-[9px] text-[color:var(--color-text-muted)] hover:border-ds-turquoise/40 hover:text-ds-turquoise"
          >
            ?
          </button>
        </div>
      </header>
      {showHelp && (
        <div className="rounded-md border border-white/10 bg-[color:var(--color-bg-card)]/60 p-2.5 text-[11px] leading-relaxed text-[color:var(--color-text-secondary)]">
          L&apos;ordre est cosmétique : il n&apos;affecte pas la lecture audio.
          Les scènes restent jouées à leur <code>start_sec</code>. Pour
          déplacer le moment d&apos;une scène, modifie <code>start_sec</code>
          /<code>end_sec</code> dans le panneau d&apos;édition.
        </div>
      )}

      <div className="overflow-y-auto pr-1">
        {scenes.length === 0 ? (
          <p className="rounded-lg bg-[color:var(--color-bg-card)]/40 p-3 text-xs italic text-[color:var(--color-text-muted)]">
            Aucune scène — clique sur « + Ajouter ».
          </p>
        ) : (
          <SortableList
            items={scenes}
            getItemId={(scene) => scene.id}
            onReorder={onReorder}
            className="flex flex-col gap-1.5"
            renderItem={(scene, idx, handleProps) => {
              const active = scene.id === selectedSceneId
              const kind = scene.template.kind
              return (
                <div
                  className={`group flex items-start gap-1.5 rounded-lg border p-2.5 text-left transition-colors ${
                    active
                      ? 'border-ds-turquoise/60 bg-ds-turquoise/10'
                      : 'border-white/5 bg-[color:var(--color-bg-card)]/40 hover:bg-[color:var(--color-bg-card)]/70'
                  }`}
                >
                  <DragHandle {...handleProps} ariaLabel={`Réordonner la scène ${idx + 1}`} />
                  <button
                    type="button"
                    onClick={() => onSelect(scene.id)}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider ${KIND_BADGE_BG[kind]}`}
                      >
                        {KIND_LABEL[kind]}
                      </span>
                      <span className="text-[10px] text-[color:var(--color-text-muted)]">
                        #{idx + 1}
                      </span>
                    </div>
                    <p
                      className={`mt-1 text-sm font-medium ${
                        active
                          ? 'text-white'
                          : 'text-[color:var(--color-text-primary)]'
                      }`}
                    >
                      {scene.title?.trim() || '(sans titre)'}
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-[color:var(--color-text-muted)]">
                      {formatRange(scene.start_sec, scene.end_sec)}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const ok = window.confirm(
                        `Supprimer la scène « ${
                          scene.title?.trim() || '(sans titre)'
                        } » ?`
                      )
                      if (ok) onDelete(scene.id)
                    }}
                    aria-label={`Supprimer la scène ${idx + 1}`}
                    className="rounded p-1 text-[color:var(--color-text-muted)] opacity-0 transition-opacity hover:bg-red-500/15 hover:text-red-300 group-hover:opacity-100"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                </div>
              )
            }}
          />
        )}
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-dashed border-white/15 bg-[color:var(--color-bg-card)]/40 px-3 py-2 text-xs font-medium text-[color:var(--color-text-secondary)] hover:border-ds-turquoise/40 hover:text-white"
        >
          + Ajouter une scène
        </button>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={!canRegenerate || isRegenerating}
          title={
            canRegenerate
              ? 'Régénérer la timeline via Claude Sonnet 4.6'
              : 'Régénération LLM non disponible pour ce type de source'
          }
          className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
            canRegenerate && !isRegenerating
              ? 'border border-ds-turquoise/40 bg-ds-turquoise/10 text-ds-turquoise hover:bg-ds-turquoise/20'
              : 'bg-white/5 text-[color:var(--color-text-muted)] opacity-60'
          }`}
        >
          {isRegenerating && (
            <svg
              className="h-3 w-3 animate-spin"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" opacity="0.3" />
              <path d="M22 12a10 10 0 0 1-10 10" />
            </svg>
          )}
          {isRegenerating ? 'Génération…' : 'Régénérer via LLM'}
        </button>
      </div>
    </div>
  )
}
