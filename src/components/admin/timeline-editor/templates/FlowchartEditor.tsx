'use client'

import type { CardContent, SceneTemplate } from '@/lib/timeline/schema'

import { CardContentEditor } from '../CardContentEditor'
import { DragHandle, SortableList } from '../SortableList'

type FlowchartTemplate = Extract<SceneTemplate, { kind: 'flowchart' }>

interface Props {
  template: FlowchartTemplate
  onChange: (next: FlowchartTemplate) => void
  /** Fenetre de la scene courante (warnings bornes hors-fenetre). */
  sceneWindow?: { startSec: number; endSec: number }
}

const MAX_STEPS = 5

export function FlowchartEditor({ template, onChange, sceneWindow }: Props) {
  function setCard(idx: number, card: CardContent) {
    const cards = template.cards.slice()
    cards[idx] = card
    onChange({ ...template, cards })
  }

  function addCard() {
    if (template.cards.length >= MAX_STEPS) return
    onChange({
      ...template,
      cards: [
        ...template.cards,
        { text: `Étape ${template.cards.length + 1}` },
      ],
    })
  }

  function removeCard(idx: number) {
    if (template.cards.length <= 1) return
    onChange({
      ...template,
      cards: template.cards.filter((_, i) => i !== idx),
    })
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[color:var(--color-text-secondary)]">
          Orientation
        </label>
        <select
          value={template.orientation ?? 'horizontal'}
          onChange={(e) =>
            onChange({
              ...template,
              orientation: e.target.value as 'horizontal' | 'vertical',
            })
          }
          className="rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2 py-1 text-sm text-white focus:border-ds-turquoise focus:outline-none"
        >
          <option value="horizontal">Horizontale</option>
          <option value="vertical">Verticale</option>
        </select>
      </div>

      <SortableList
        items={template.cards}
        getItemId={(_, idx) => `flow-step-${idx}`}
        onReorder={(cards) => onChange({ ...template, cards })}
        className="space-y-2"
        renderItem={(card, idx, handleProps) => (
          <div className="flex items-stretch gap-1.5">
            <div className="flex flex-col items-center pt-3">
              <DragHandle
                {...handleProps}
                ariaLabel={`Réordonner l'étape ${idx + 1}`}
              />
            </div>
            <div className="relative flex-1">
              <CardContentEditor
                card={card}
                onChange={(next) => setCard(idx, next)}
                label={`Étape ${idx + 1}`}
                sceneWindow={sceneWindow}
              />
              {template.cards.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeCard(idx)}
                  className="absolute right-2 top-2 rounded p-1 text-[color:var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-300"
                  aria-label="Retirer cette étape"
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
        onClick={addCard}
        disabled={template.cards.length >= MAX_STEPS}
        className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-[color:var(--color-text-secondary)] hover:border-ds-turquoise/40 hover:text-white disabled:opacity-40"
      >
        + Ajouter une étape ({template.cards.length}/{MAX_STEPS})
      </button>
    </div>
  )
}
