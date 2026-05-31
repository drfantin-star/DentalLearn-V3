'use client'

import type { AnswerValue, QuestionnaireItem } from '@/lib/autoeval/types'

interface Props {
  item: QuestionnaireItem
  value: AnswerValue | undefined
  onChange: (v: AnswerValue) => void
}

const SELECTED = 'border-[#EC4899] bg-[#EC4899]/15 text-white'
const IDLE = 'border-[#333] bg-[#1a1a1a] text-[#d4d4d4] hover:border-[#555]'

/**
 * Échelle ordonnée (CBI, fréquence maison…). Mode enquête : pas de bonne/mauvaise
 * réponse, accent rose sur la sélection.
 */
export default function ScaleInput({ item, value, onChange }: Props) {
  const options = item.options ?? []
  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left text-sm font-semibold transition-colors ${
              selected ? SELECTED : IDLE
            }`}
          >
            <span
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border ${
                selected ? 'border-[#EC4899] bg-[#EC4899]' : 'border-[#555]'
              }`}
            >
              {selected && <span className="h-2 w-2 rounded-full bg-white" />}
            </span>
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
