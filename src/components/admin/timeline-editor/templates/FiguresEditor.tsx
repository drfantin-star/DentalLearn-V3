'use client'

import type { SceneTemplate } from '@/lib/timeline/schema'

type FiguresTemplate = Extract<SceneTemplate, { kind: 'figures' }>
type Figure = FiguresTemplate['figures'][number]

interface Props {
  template: FiguresTemplate
  onChange: (next: FiguresTemplate) => void
}

const MAX_FIGURES = 3

export function FiguresEditor({ template, onChange }: Props) {
  function setFigure(idx: number, figure: Figure) {
    const figures = template.figures.slice()
    figures[idx] = figure
    onChange({ ...template, figures })
  }

  function addFigure() {
    if (template.figures.length >= MAX_FIGURES) return
    onChange({
      ...template,
      figures: [...template.figures, { value: '0', label: 'À éditer' }],
    })
  }

  function removeFigure(idx: number) {
    if (template.figures.length <= 1) return
    onChange({
      ...template,
      figures: template.figures.filter((_, i) => i !== idx),
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {template.figures.map((figure, idx) => (
          <div
            key={idx}
            className="relative space-y-2 rounded-lg border border-white/5 bg-[color:var(--color-bg-card)]/40 p-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
              Chiffre clé {idx + 1}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                value={figure.value}
                onChange={(e) => setFigure(idx, { ...figure, value: e.target.value })}
                placeholder="50%"
                className="rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2.5 py-1.5 text-lg font-bold text-white focus:border-ds-turquoise focus:outline-none"
              />
              <input
                type="text"
                value={figure.label}
                onChange={(e) => setFigure(idx, { ...figure, label: e.target.value })}
                placeholder="Libellé"
                className="rounded-md border border-white/10 bg-[color:var(--color-bg-input)] px-2.5 py-1.5 text-sm text-white focus:border-ds-turquoise focus:outline-none"
              />
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-[color:var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={figure.emphasis ?? false}
                onChange={(e) => {
                  const next = { ...figure }
                  if (e.target.checked) next.emphasis = true
                  else delete next.emphasis
                  setFigure(idx, next)
                }}
                className="accent-ds-turquoise"
              />
              Mise en avant
            </label>
            {template.figures.length > 1 && (
              <button
                type="button"
                onClick={() => removeFigure(idx)}
                className="absolute right-2 top-2 rounded p-1 text-[color:var(--color-text-muted)] hover:bg-red-500/15 hover:text-red-300"
                aria-label="Retirer ce chiffre"
              >
                ×
              </button>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addFigure}
        disabled={template.figures.length >= MAX_FIGURES}
        className="rounded-lg border border-dashed border-white/15 px-3 py-1.5 text-xs text-[color:var(--color-text-secondary)] hover:border-ds-turquoise/40 hover:text-white disabled:opacity-40"
      >
        + Chiffre ({template.figures.length}/{MAX_FIGURES})
      </button>
    </div>
  )
}
