'use client'

import type { AnswerValue, QuestionnaireItem } from '@/lib/autoeval/types'

interface Props {
  item: QuestionnaireItem
  value: AnswerValue | undefined
  onChange: (v: AnswerValue) => void
}

const SELECTED = 'border-[#EC4899] bg-[#EC4899]/15 text-white'
const IDLE = 'border-[#333] bg-[#1a1a1a] text-[#d4d4d4] hover:border-[#555]'

/** Oui / Non (deux boutons côte à côte). */
export default function YesNoInput({ item, value, onChange }: Props) {
  const options = item.options ?? [
    { label: 'Oui', value: 'oui' },
    { label: 'Non', value: 'non' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const selected = value === opt.value
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={selected}
            className={`rounded-2xl border p-3.5 text-center text-sm font-semibold transition-colors ${
              selected ? SELECTED : IDLE
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
