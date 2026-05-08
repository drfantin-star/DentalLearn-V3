'use client'

import type { CardContent, SceneTemplate } from '@/lib/timeline/schema'

import { CardContentEditor } from '../CardContentEditor'

type GridTemplate = Extract<SceneTemplate, { kind: 'grid' }>

interface Props {
  template: GridTemplate
  onChange: (next: GridTemplate) => void
}

export function GridEditor({ template, onChange }: Props) {
  function setCard(idx: number, card: CardContent) {
    const cards = template.cards.slice()
    cards[idx] = card
    onChange({ ...template, cards })
  }

  function addCard() {
    onChange({
      ...template,
      cards: [...template.cards, { text: 'Nouvelle card' }],
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
          Nombre de colonnes
        </label>
        <select
          value={template.columns}
          onChange={(e) =>
            onChange({ ...template, columns: Number(e.target.value) })
          }
          className="rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2 py-1 text-sm text-white focus:border-ds-turquoise focus:outline-none"
        >
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </div>

      <div className="space-y-2">
        {template.cards.map((card, idx) => (
          <div key={idx} className="relative">
            <CardContentEditor
              card={card}
              onChange={(next) => setCard(idx, next)}
              label={`Card ${idx + 1}`}
            />
            {template.cards.length > 1 && (
              <button
                type="button"
                onClick={() => removeCard(idx)}
                className="absolute right-2 top-2 rounded p-1 text-[color:var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-300"
                aria-label="Retirer cette card"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addCard}
        className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-[color:var(--color-text-secondary)] hover:border-ds-turquoise/40 hover:text-white"
      >
        + Ajouter une card
      </button>
    </div>
  )
}
