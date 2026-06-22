'use client'

import type { CardContent, CardVariant } from '@/lib/timeline/schema'

/**
 * Édition d'une `CardContent` (POC-T6.3).
 *
 * Champs :
 *  - text (required, max 60)
 *  - subtitle (optional, max 50)
 *  - variant (default | highlight | warning | success)
 *
 * Compteurs de caractères avec couleur progressive selon proximité limite.
 */

const TEXT_LIMIT = 60
const SUBTITLE_LIMIT = 50

interface Props {
  card: CardContent
  onChange: (next: CardContent) => void
  showVariantPicker?: boolean
  showSubtitle?: boolean
  label?: string
}

const VARIANTS: Array<{ value: CardVariant | 'default'; label: string }> = [
  { value: 'default', label: 'Aucun' },
  { value: 'highlight', label: 'Mise en avant' },
  { value: 'warning', label: 'Attention' },
  { value: 'success', label: 'Positif' },
]

function counterColor(value: string, limit: number): string {
  const len = value.length
  if (len > limit) return 'text-red-400'
  if (len >= Math.floor(limit * 0.85)) return 'text-orange-400'
  return 'text-[color:var(--color-text-muted)]'
}

function inputBorder(value: string, limit: number): string {
  return value.length > limit
    ? 'border-red-500 bg-red-500/10'
    : 'border-white/10 bg-[color:var(--color-bg-input)] focus:border-ds-turquoise'
}

export function CardContentEditor({
  card,
  onChange,
  showVariantPicker = true,
  showSubtitle = true,
  label,
}: Props) {
  return (
    <div className="space-y-2 rounded-lg border border-white/5 bg-[color:var(--color-bg-card)]/40 p-3">
      {label && (
        <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
          {label}
        </p>
      )}

      <div>
        <input
          type="text"
          value={card.text}
          onChange={(e) => onChange({ ...card, text: e.target.value })}
          placeholder="Texte de la card"
          className={`w-full rounded-md border px-2.5 py-1.5 text-sm text-white focus:outline-none ${inputBorder(
            card.text,
            TEXT_LIMIT
          )}`}
        />
        <div className="mt-0.5 flex justify-end">
          <span
            className={`font-mono text-[10px] ${counterColor(card.text, TEXT_LIMIT)}`}
          >
            {card.text.length}/{TEXT_LIMIT}
          </span>
        </div>
      </div>

      {showSubtitle && (
        <div>
          <input
            type="text"
            value={card.subtitle ?? ''}
            onChange={(e) => {
              const next = { ...card }
              const v = e.target.value
              if (v.length === 0) {
                delete next.subtitle
              } else {
                next.subtitle = v
              }
              onChange(next)
            }}
            placeholder="Sous-titre (optionnel)"
            className={`w-full rounded-md border px-2.5 py-1.5 text-xs text-[color:var(--color-text-secondary)] focus:outline-none ${inputBorder(
              card.subtitle ?? '',
              SUBTITLE_LIMIT
            )}`}
          />
          <div className="mt-0.5 flex justify-end">
            <span
              className={`font-mono text-[10px] ${counterColor(
                card.subtitle ?? '',
                SUBTITLE_LIMIT
              )}`}
            >
              {(card.subtitle ?? '').length}/{SUBTITLE_LIMIT}
            </span>
          </div>
        </div>
      )}

      {showVariantPicker && (
        <div className="flex flex-wrap gap-1">
          {VARIANTS.map((v) => {
            const current = card.variant ?? 'default'
            const active = current === v.value
            return (
              <button
                key={v.value}
                type="button"
                onClick={() => {
                  const next = { ...card }
                  if (v.value === 'default') delete next.variant
                  else next.variant = v.value
                  onChange(next)
                }}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  active
                    ? 'bg-ds-turquoise text-axe3'
                    : 'bg-white/5 text-[color:var(--color-text-secondary)] hover:bg-white/10'
                }`}
              >
                {v.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
