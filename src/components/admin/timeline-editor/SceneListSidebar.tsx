'use client'

import type { Scene, SceneTemplate } from '@/lib/timeline/schema'

/**
 * Sidebar gauche — liste des scènes (POC-T6.1.c + T6.2).
 *
 * BLOC 1 : sélection + ajout + suppression. Pas de drag-reorder (BLOC 2).
 */

interface Props {
  scenes: Scene[]
  selectedSceneId: string | null
  onSelect: (id: string) => void
  onAdd: () => void
  onDelete: (id: string) => void
  onRegenerate?: () => void // disabled placeholder en BLOC 1
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
  onRegenerate,
}: Props) {
  return (
    <div className="flex h-full flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Scènes ({scenes.length})
        </h2>
      </header>

      <ul className="flex flex-col gap-1.5 overflow-y-auto">
        {scenes.length === 0 && (
          <li className="rounded-lg bg-[color:var(--color-bg-card)]/40 p-3 text-xs italic text-[color:var(--color-text-muted)]">
            Aucune scène — clique sur « + Ajouter ».
          </li>
        )}
        {scenes.map((scene, idx) => {
          const active = scene.id === selectedSceneId
          const kind = scene.template.kind
          return (
            <li key={scene.id}>
              <div
                className={`group flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors ${
                  active
                    ? 'border-ds-turquoise/60 bg-ds-turquoise/10'
                    : 'border-white/5 bg-[color:var(--color-bg-card)]/40 hover:bg-[color:var(--color-bg-card)]/70'
                }`}
              >
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
                      active ? 'text-white' : 'text-[color:var(--color-text-primary)]'
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
                      `Supprimer la scène « ${scene.title?.trim() || '(sans titre)'} » ?`
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
            </li>
          )
        })}
      </ul>

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
          disabled
          title="Disponible en BLOC 2"
          className="rounded-lg bg-white/5 px-3 py-2 text-xs font-medium text-[color:var(--color-text-muted)] opacity-60"
        >
          Régénérer via LLM (BLOC 2)
        </button>
      </div>
    </div>
  )
}
