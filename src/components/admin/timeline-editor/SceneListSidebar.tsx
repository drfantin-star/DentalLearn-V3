'use client'

import { useMemo, useState } from 'react'

import {
  computeConceptPlacements,
  type ConceptPlacement,
} from '@/lib/timeline/conceptVisibility'
import type { Scene, SceneTemplate, TimelineConcept } from '@/lib/timeline/schema'

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
  /** Concepts de la timeline, intercalés sous leur scène d'ancrage temporel. */
  concepts: TimelineConcept[]
  /** Durée audio (borne le calcul de visibilité des concepts). */
  audioDurationSec: number
  /** Concept sélectionné (surbrillance + sync avec le panneau Concepts). */
  selectedConceptId?: string | null
  /** Clic sur une pastille concept → ouvre/scrolle le panneau Concepts. */
  onSelectConcept?: (id: string) => void
}

const KIND_BADGE_BG: Record<SceneTemplate['kind'], string> = {
  grid: 'bg-sky-500/15 text-sky-300',
  flowchart: 'bg-indigo-500/15 text-indigo-300',
  comparison: 'bg-fuchsia-500/15 text-fuchsia-300',
  figures: 'bg-emerald-500/15 text-emerald-300',
  causal: 'bg-orange-500/15 text-orange-300',
  timeline: 'bg-amber-500/15 text-amber-300',
  // T8 — propagation de l'ajout `recap` dans le discriminated union
  // SceneTemplate. Admin timeline-editor ne gère pas l'édition des scènes
  // recap (générées déterministiquement par buildNewsTimeline), mais le
  // Record doit rester exhaustif pour TypeScript.
  recap: 'bg-teal-500/15 text-teal-300',
}

const KIND_LABEL: Record<SceneTemplate['kind'], string> = {
  grid: 'Grille',
  flowchart: 'Flow',
  comparison: 'Comp.',
  figures: 'Chiffres',
  causal: 'Causal',
  timeline: 'Frise',
  recap: 'Récap',
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

// ─── Pastilles concept (intercalées sous les scènes) ────────────────────────

// Depuis le fix user (rendu « scène + tous ses concepts en dessous », cf.
// `getConceptsForScene` / `SceneWhiteboardWithConcepts`), TOUS les concepts
// éligibles d'une scène sont affichés groupés — la distinction « ✓ visible /
// ⚠ jamais affiché » de l'ancien rendu (concepts qui se succédaient dans les
// gaps inter-scènes) est obsolète et trompeuse, donc retirée.
//
// Ne subsistent que les états qui retirent RÉELLEMENT le concept de la lecture
// (mêmes filtres que `getConceptsForScene`) : `disabled` (hidden === true) et
// `incomplete` (term / definition / at_sec manquant).
const NEUTRAL_ROW_CLASS = 'border-white/5 bg-[color:var(--color-bg-card)]/30'
const NEUTRAL_TITLE =
  'Ce concept s’affiche sous sa scène pendant la lecture.'

const CONCEPT_STATUS_BADGE: Partial<
  Record<
    ConceptPlacement['status'],
    { badge: string; badgeClass: string; rowClass: string; title: string }
  >
> = {
  disabled: {
    badge: 'désactivé',
    badgeClass: 'bg-white/10 text-[color:var(--color-text-muted)]',
    rowClass: 'border-white/5 bg-white/5 opacity-60',
    title: 'Concept masqué via la case « Afficher » dans le panneau Concepts.',
  },
  incomplete: {
    badge: 'incomplet',
    badgeClass: 'bg-white/10 text-[color:var(--color-text-muted)]',
    rowClass: 'border-white/5 bg-white/5 opacity-70',
    title:
      'Terme, définition ou position (at_sec) manquant → ignoré pendant la lecture.',
  },
}

function ConceptChip({
  placement,
  selected,
  onSelect,
}: {
  placement: ConceptPlacement
  selected: boolean
  onSelect?: (id: string) => void
}) {
  const { concept, atSec, status } = placement
  const badgeCfg = CONCEPT_STATUS_BADGE[status]
  const term = concept.term?.trim() || concept.label?.trim() || '(sans terme)'

  return (
    <button
      type="button"
      onClick={() => onSelect?.(concept.id)}
      title={badgeCfg?.title ?? NEUTRAL_TITLE}
      className={`flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-colors hover:border-ds-turquoise/40 ${
        selected
          ? 'border-ds-turquoise/60 bg-ds-turquoise/10'
          : (badgeCfg?.rowClass ?? NEUTRAL_ROW_CLASS)
      }`}
    >
      <span aria-hidden="true" className="text-[color:var(--color-text-muted)]">
        ·
      </span>
      <span className="flex-1 truncate text-xs text-[color:var(--color-text-primary)]">
        {term}
      </span>
      <span className="font-mono text-[9px] text-[color:var(--color-text-muted)]">
        {atSec === null ? '—' : formatSec(atSec)}
      </span>
      {badgeCfg && (
        <span
          className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium ${badgeCfg.badgeClass}`}
        >
          {badgeCfg.badge}
        </span>
      )}
    </button>
  )
}

function ConceptChipList({
  placements,
  selectedConceptId,
  onSelectConcept,
}: {
  placements: ConceptPlacement[]
  selectedConceptId?: string | null
  onSelectConcept?: (id: string) => void
}) {
  if (placements.length === 0) return null
  return (
    <div className="mt-1.5 flex flex-col gap-1 pl-4">
      {placements.map((p) => (
        <ConceptChip
          key={p.concept.id}
          placement={p}
          selected={p.concept.id === selectedConceptId}
          onSelect={onSelectConcept}
        />
      ))}
    </div>
  )
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
  concepts,
  audioDurationSec,
  selectedConceptId,
  onSelectConcept,
}: Props) {
  const [showHelp, setShowHelp] = useState(false)

  const canRegenerate = typeof onRegenerate === 'function'

  // `computeConceptPlacements` reste utilisé pour le GROUPEMENT des concepts
  // sous leur scène d'ancrage (byAnchorScene / beforeFirst / noTimestamp) ;
  // les compteurs visible/never ne sont plus affichés (cf. note ci-dessus).
  const placement = useMemo(
    () => computeConceptPlacements(scenes, concepts, audioDurationSec),
    [scenes, concepts, audioDurationSec]
  )

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
      {concepts.length > 0 && (
        <p className="text-[10px] text-[color:var(--color-text-muted)]">
          {concepts.length} concept{concepts.length > 1 ? 's' : ''}
        </p>
      )}
      {showHelp && (
        <div className="rounded-md border border-white/10 bg-[color:var(--color-bg-card)]/60 p-2.5 text-[11px] leading-relaxed text-[color:var(--color-text-secondary)]">
          L&apos;ordre est cosmétique : il n&apos;affecte pas la lecture audio.
          Les scènes restent jouées à leur <code>start_sec</code>. Pour
          déplacer le moment d&apos;une scène, modifie <code>start_sec</code>
          /<code>end_sec</code> dans le panneau d&apos;édition.
        </div>
      )}

      <div className="overflow-y-auto pr-1">
        {placement.beforeFirst.length > 0 && (
          <div className="mb-1.5">
            <p className="mb-1 pl-1 text-[9px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Avant la 1re scène
            </p>
            <ConceptChipList
              placements={placement.beforeFirst}
              selectedConceptId={selectedConceptId}
              onSelectConcept={onSelectConcept}
            />
          </div>
        )}
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
              const sceneConcepts = placement.byAnchorScene.get(scene.id) ?? []
              return (
                <div
                  className={`group rounded-lg border p-2.5 text-left transition-colors ${
                    active
                      ? 'border-ds-turquoise/60 bg-ds-turquoise/10'
                      : 'border-white/5 bg-[color:var(--color-bg-card)]/40 hover:bg-[color:var(--color-bg-card)]/70'
                  }`}
                >
                  <div className="flex items-start gap-1.5">
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
                  <ConceptChipList
                    placements={sceneConcepts}
                    selectedConceptId={selectedConceptId}
                    onSelectConcept={onSelectConcept}
                  />
                </div>
              )
            }}
          />
        )}
        {placement.noTimestamp.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 pl-1 text-[9px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Sans position (at_sec)
            </p>
            <ConceptChipList
              placements={placement.noTimestamp}
              selectedConceptId={selectedConceptId}
              onSelectConcept={onSelectConcept}
            />
          </div>
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
