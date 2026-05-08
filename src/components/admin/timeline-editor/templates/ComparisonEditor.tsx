'use client'

import type { CardContent, SceneTemplate } from '@/lib/timeline/schema'

import { CardContentEditor } from '../CardContentEditor'

type ComparisonTemplate = Extract<SceneTemplate, { kind: 'comparison' }>
type Side = 'left' | 'right'

interface Props {
  template: ComparisonTemplate
  onChange: (next: ComparisonTemplate) => void
}

export function ComparisonEditor({ template, onChange }: Props) {
  function setSideTitle(side: Side, title: string) {
    onChange({
      ...template,
      [side]: { ...template[side], title },
    })
  }

  function setSideCard(side: Side, idx: number, card: CardContent) {
    const cards = template[side].cards.slice()
    cards[idx] = card
    onChange({
      ...template,
      [side]: { ...template[side], cards },
    })
  }

  function addCard(side: Side) {
    onChange({
      ...template,
      [side]: {
        ...template[side],
        cards: [...template[side].cards, { text: 'Nouveau' }],
      },
    })
  }

  function removeCard(side: Side, idx: number) {
    if (template[side].cards.length <= 1) return
    onChange({
      ...template,
      [side]: {
        ...template[side],
        cards: template[side].cards.filter((_, i) => i !== idx),
      },
    })
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {(['left', 'right'] as Side[]).map((side) => (
        <div key={side} className="space-y-3 rounded-lg bg-[color:var(--color-bg-card)]/30 p-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-[color:var(--color-text-muted)]">
              {side === 'left' ? 'Colonne gauche' : 'Colonne droite'}
            </label>
            <input
              type="text"
              value={template[side].title}
              onChange={(e) => setSideTitle(side, e.target.value)}
              placeholder="Titre"
              className="w-full rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2.5 py-1.5 text-sm text-white focus:border-ds-turquoise focus:outline-none"
            />
          </div>
          <div className="space-y-2">
            {template[side].cards.map((card, idx) => (
              <div key={idx} className="relative">
                <CardContentEditor
                  card={card}
                  onChange={(next) => setSideCard(side, idx, next)}
                  label={`Item ${idx + 1}`}
                />
                {template[side].cards.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeCard(side, idx)}
                    className="absolute right-2 top-2 rounded p-1 text-[color:var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-300"
                    aria-label="Retirer"
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => addCard(side)}
            className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-[color:var(--color-text-secondary)] hover:border-ds-turquoise/40 hover:text-white"
          >
            + Item
          </button>
        </div>
      ))}
    </div>
  )
}
