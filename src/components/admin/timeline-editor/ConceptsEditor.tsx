'use client'

import { useState } from 'react'

import type { TimelineConcept } from '@/lib/timeline/schema'

/**
 * Éditeur des concepts (POC-T6.5.b).
 *
 * Affiché en panneau dépliable, collapsed par défaut. Permet :
 *  - Toggle « Afficher » via `hidden` (additif schéma)
 *  - Édition `term` (max 60) + `definition` (max 300)
 *  - Suppression (avec confirm)
 *  - Ajout manuel (modal léger), source = "généré_manuel"
 *
 * `at_sec` est lecture seule en V1 (formaté mm:ss).
 */

const TERM_LIMIT = 60
const DEF_LIMIT = 300

interface Props {
  concepts: TimelineConcept[]
  audioDurationSec: number
  onChange: (next: TimelineConcept[]) => void
}

function formatSec(sec: number | undefined): string {
  if (sec === undefined || sec === null || Number.isNaN(sec)) return '—'
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function newConceptId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `concept-${crypto.randomUUID().slice(0, 8)}`
  }
  return `concept-${Math.random().toString(36).slice(2, 10)}`
}

function counterColor(value: string, limit: number): string {
  if (value.length > limit) return 'text-red-400'
  if (value.length >= Math.floor(limit * 0.85)) return 'text-orange-400'
  return 'text-[color:var(--color-text-muted)]'
}

export function ConceptsEditor({
  concepts,
  audioDurationSec,
  onChange,
}: Props) {
  const [expanded, setExpanded] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  function setConcept(idx: number, next: TimelineConcept) {
    onChange(concepts.map((c, i) => (i === idx ? next : c)))
  }

  function deleteConcept(idx: number) {
    const c = concepts[idx]
    const label = c.term?.trim() || c.label?.trim() || '(sans nom)'
    const ok = window.confirm(`Supprimer le concept « ${label} » ?`)
    if (ok) onChange(concepts.filter((_, i) => i !== idx))
  }

  function addManual(input: { term: string; definition: string; at_sec: number }) {
    const newConcept: TimelineConcept = {
      id: newConceptId(),
      label: input.term,
      term: input.term,
      definition: input.definition,
      at_sec: input.at_sec,
      // start_sec/end_sec sont obligatoires côté schéma — on les colle sur
      // at_sec pour un concept manuel (pas de fenêtre de surbrillance précise).
      start_sec: input.at_sec,
      end_sec: input.at_sec + 0.001,
      source: 'généré_manuel',
    }
    onChange([...concepts, newConcept])
    setShowAddModal(false)
  }

  return (
    <section className="rounded-xl border border-white/5 bg-[color:var(--color-bg-card)]/30">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Concepts ({concepts.length})
        </span>
        <span
          className={`text-[color:var(--color-text-muted)] transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-white/5 px-4 py-3">
          {concepts.length === 0 ? (
            <p className="text-xs italic text-[color:var(--color-text-muted)]">
              Aucun concept extrait. Clique sur « + Ajouter manuellement » pour
              en créer un.
            </p>
          ) : (
            <ul className="space-y-2">
              {concepts.map((concept, idx) => {
                const term = concept.term ?? concept.label ?? ''
                const definition = concept.definition ?? ''
                const isHidden = concept.hidden === true
                return (
                  <li
                    key={concept.id ?? idx}
                    className={`space-y-2 rounded-lg border p-3 transition-colors ${
                      isHidden
                        ? 'border-white/5 bg-white/5 opacity-60'
                        : 'border-white/10 bg-[color:var(--color-bg-card)]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[color:var(--color-text-secondary)]">
                        <input
                          type="checkbox"
                          checked={!isHidden}
                          onChange={(e) => {
                            const next = { ...concept }
                            if (e.target.checked) {
                              delete next.hidden
                            } else {
                              next.hidden = true
                            }
                            setConcept(idx, next)
                          }}
                          className="accent-ds-turquoise"
                        />
                        Afficher
                      </label>
                      <span className="font-mono text-[10px] text-[color:var(--color-text-muted)]">
                        {formatSec(concept.at_sec ?? concept.start_sec)}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteConcept(idx)}
                        aria-label={`Supprimer le concept ${term || idx + 1}`}
                        className="rounded p-1 text-[color:var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-300"
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
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        </svg>
                      </button>
                    </div>
                    <div>
                      <input
                        type="text"
                        value={term}
                        onChange={(e) => {
                          const v = e.target.value
                          setConcept(idx, {
                            ...concept,
                            term: v,
                            label: v || concept.label,
                          })
                        }}
                        placeholder="Terme"
                        className="w-full rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2.5 py-1.5 text-sm font-medium text-white focus:border-ds-turquoise focus:outline-none"
                      />
                      <div className="mt-0.5 flex justify-end">
                        <span
                          className={`font-mono text-[10px] ${counterColor(term, TERM_LIMIT)}`}
                        >
                          {term.length}/{TERM_LIMIT}
                        </span>
                      </div>
                    </div>
                    <div>
                      <textarea
                        value={definition}
                        onChange={(e) =>
                          setConcept(idx, {
                            ...concept,
                            definition: e.target.value,
                          })
                        }
                        rows={3}
                        placeholder="Définition (max 300 caractères)"
                        className="w-full rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2.5 py-1.5 text-xs text-white focus:border-ds-turquoise focus:outline-none"
                      />
                      <div className="mt-0.5 flex justify-between">
                        {concept.source && (
                          <span className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                            {concept.source}
                          </span>
                        )}
                        <span
                          className={`font-mono text-[10px] ${counterColor(definition, DEF_LIMIT)}`}
                        >
                          {definition.length}/{DEF_LIMIT}
                        </span>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-[color:var(--color-text-secondary)] hover:border-ds-turquoise/40 hover:text-white"
          >
            + Ajouter manuellement
          </button>
        </div>
      )}

      {showAddModal && (
        <AddConceptModal
          audioDurationSec={audioDurationSec}
          onCancel={() => setShowAddModal(false)}
          onConfirm={addManual}
        />
      )}
    </section>
  )
}

interface AddModalProps {
  audioDurationSec: number
  onCancel: () => void
  onConfirm: (input: {
    term: string
    definition: string
    at_sec: number
  }) => void
}

function AddConceptModal({
  audioDurationSec,
  onCancel,
  onConfirm,
}: AddModalProps) {
  const [term, setTerm] = useState('')
  const [definition, setDefinition] = useState('')
  const [atSec, setAtSec] = useState<string>('0')

  const atSecNum = Number(atSec)
  const atSecValid =
    Number.isFinite(atSecNum) && atSecNum >= 0 && atSecNum <= audioDurationSec
  const termValid = term.trim().length > 0 && term.length <= TERM_LIMIT
  const defValid =
    definition.trim().length > 0 && definition.length <= DEF_LIMIT
  const valid = atSecValid && termValid && defValid

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ajouter un concept manuellement"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="w-full max-w-md space-y-4 rounded-xl border border-white/10 bg-[color:var(--color-bg-card)] p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-white">
          Ajouter un concept
        </h3>

        <div className="space-y-1">
          <label className="text-xs text-[color:var(--color-text-secondary)]">
            Terme
          </label>
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            maxLength={TERM_LIMIT + 5}
            placeholder="ex : Dentine tertiaire"
            className="w-full rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2.5 py-1.5 text-sm text-white focus:border-ds-turquoise focus:outline-none"
          />
          <div className="flex justify-end">
            <span
              className={`font-mono text-[10px] ${counterColor(term, TERM_LIMIT)}`}
            >
              {term.length}/{TERM_LIMIT}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-[color:var(--color-text-secondary)]">
            Définition
          </label>
          <textarea
            value={definition}
            onChange={(e) => setDefinition(e.target.value)}
            rows={3}
            maxLength={DEF_LIMIT + 5}
            placeholder="Définition courte (max 300 caractères)"
            className="w-full rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2.5 py-1.5 text-xs text-white focus:border-ds-turquoise focus:outline-none"
          />
          <div className="flex justify-end">
            <span
              className={`font-mono text-[10px] ${counterColor(definition, DEF_LIMIT)}`}
            >
              {definition.length}/{DEF_LIMIT}
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-[color:var(--color-text-secondary)]">
            Position (secondes, 0 – {Math.round(audioDurationSec)})
          </label>
          <input
            type="number"
            min={0}
            max={Math.round(audioDurationSec)}
            step={1}
            value={atSec}
            onChange={(e) => setAtSec(e.target.value)}
            className={`w-full rounded-md border bg-[color:var(--color-bg-input)] px-2.5 py-1.5 text-sm text-white focus:outline-none ${
              atSecValid
                ? 'border-white/10 focus:border-ds-turquoise'
                : 'border-red-500 bg-red-500/10'
            }`}
          />
          {!atSecValid && (
            <p className="text-[10px] text-red-400">
              Doit être un nombre entre 0 et {Math.round(audioDurationSec)}.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)] hover:bg-white/10"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() =>
              onConfirm({
                term: term.trim(),
                definition: definition.trim(),
                at_sec: atSecNum,
              })
            }
            className="rounded-lg bg-ds-turquoise px-3 py-1.5 text-xs font-semibold text-axe3 hover:bg-ds-turquoise-dark disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  )
}
