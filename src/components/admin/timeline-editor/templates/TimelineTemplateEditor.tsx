'use client'

import type { SceneTemplate } from '@/lib/timeline/schema'

import { DragHandle, SortableList } from '../SortableList'

type TimelineTpl = Extract<SceneTemplate, { kind: 'timeline' }>
type TimelineEvent = NonNullable<TimelineTpl['events']>[number]

interface Props {
  template: TimelineTpl
  onChange: (next: TimelineTpl) => void
}

/**
 * Éditeur frise chronologique (POC-T6.3 + drag-reorder T6.4.c) — naming
 * `TimelineTemplateEditor` pour éviter la collision avec le type racine
 * `Timeline`.
 *
 * On édite uniquement le mode "events" (spec POC §5.2). Le mode legacy
 * "steps" reste valide côté schéma mais n'est pas exposé en édition.
 */
function migrateLegacyIfNeeded(t: TimelineTpl): TimelineTpl {
  if (t.events && t.events.length > 0) return t
  if (t.steps && t.steps.length > 0) {
    const events: TimelineEvent[] = t.steps.map((s, i) => ({
      at_label: `Étape ${i + 1}`,
      text: s.text,
    }))
    return { kind: 'timeline', events }
  }
  return {
    kind: 'timeline',
    events: [{ at_label: 'Étape 1', text: 'À éditer' }],
  }
}

export function TimelineTemplateEditor({
  template: rawTemplate,
  onChange,
}: Props) {
  const template = migrateLegacyIfNeeded(rawTemplate)
  const events = template.events ?? []

  function setEvent(idx: number, next: TimelineEvent) {
    const newEvents = events.map((e, i) => (i === idx ? next : e))
    onChange({ kind: 'timeline', events: newEvents })
  }

  function addEvent() {
    onChange({
      kind: 'timeline',
      events: [
        ...events,
        { at_label: `Étape ${events.length + 1}`, text: 'À éditer' },
      ],
    })
  }

  function removeEvent(idx: number) {
    if (events.length <= 1) return
    onChange({
      kind: 'timeline',
      events: events.filter((_, i) => i !== idx),
    })
  }

  return (
    <div className="space-y-2">
      <SortableList
        items={events}
        getItemId={(_, idx) => `tl-event-${idx}`}
        onReorder={(reordered) =>
          onChange({ kind: 'timeline', events: reordered })
        }
        className="space-y-2"
        renderItem={(ev, idx, handleProps) => (
          <div className="flex items-stretch gap-1.5">
            <div className="flex flex-col items-center pt-3">
              <DragHandle
                {...handleProps}
                ariaLabel={`Réordonner l'évènement ${idx + 1}`}
              />
            </div>
            <div className="relative flex-1 space-y-2 rounded-lg border border-white/5 bg-[color:var(--color-bg-card)]/40 p-3">
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
                Évènement {idx + 1}
              </p>
              <input
                type="text"
                value={ev.at_label}
                onChange={(e) =>
                  setEvent(idx, { ...ev, at_label: e.target.value })
                }
                placeholder="J0 / 6 mois / Étape 1"
                className="w-full rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2.5 py-1.5 text-sm font-semibold text-white focus:border-ds-turquoise focus:outline-none"
              />
              <input
                type="text"
                value={ev.text}
                onChange={(e) => setEvent(idx, { ...ev, text: e.target.value })}
                placeholder="Description"
                className="w-full rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2.5 py-1.5 text-sm text-white focus:border-ds-turquoise focus:outline-none"
              />
              {events.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeEvent(idx)}
                  className="absolute right-2 top-2 rounded p-1 text-[color:var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-300"
                  aria-label="Retirer cet évènement"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        )}
      />

      <button
        type="button"
        onClick={addEvent}
        className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-[color:var(--color-text-secondary)] hover:border-ds-turquoise/40 hover:text-white"
      >
        + Évènement
      </button>
    </div>
  )
}
