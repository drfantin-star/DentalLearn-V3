'use client'

import { Check } from 'lucide-react'
import type { AnswerValue, QuestionnaireItem } from '@/lib/autoeval/types'

interface Props {
  item: QuestionnaireItem
  value: AnswerValue | undefined
  onChange: (v: AnswerValue) => void
}

const SELECTED = 'border-pink-500 bg-pink-500/15 text-white'
const IDLE = 'border-[#333] bg-[#1a1a1a] text-[#d4d4d4] hover:border-[#555]'

/** Choix multiple : la valeur est un tableau de `value` (string). */
export default function MultiInput({ item, value, onChange }: Props) {
  const options = item.options ?? []
  const selectedValues = Array.isArray(value) ? value : []

  const toggle = (v: string) => {
    onChange(
      selectedValues.includes(v)
        ? selectedValues.filter((x) => x !== v)
        : [...selectedValues, v]
    )
  }

  return (
    <div className="space-y-2">
      {options.map((opt) => {
        const v = String(opt.value)
        const selected = selectedValues.includes(v)
        return (
          <button
            key={v}
            type="button"
            onClick={() => toggle(v)}
            aria-pressed={selected}
            className={`flex w-full items-center gap-3 rounded-2xl border p-3.5 text-left text-sm font-semibold transition-colors ${
              selected ? SELECTED : IDLE
            }`}
          >
            <span
              className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border ${
                selected ? 'border-pink-500 bg-pink-500' : 'border-[#555]'
              }`}
            >
              {selected && <Check size={14} className="text-white" />}
            </span>
            <span>{opt.label}</span>
          </button>
        )
      })}
    </div>
  )
}
