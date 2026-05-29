'use client'

import { useMemo, useReducer, useState } from 'react'
import { computeBlockRecap } from '@/lib/autoeval/scoring'
import type { Answers, AnswerValue, Questionnaire, QuestionnaireItem } from '@/lib/autoeval/types'
import ScaleInput from './inputs/ScaleInput'
import YesNoInput from './inputs/YesNoInput'
import ChoiceInput from './inputs/ChoiceInput'
import MultiInput from './inputs/MultiInput'
import BlockRecapModal from './BlockRecapModal'

interface Props {
  questionnaire: Questionnaire
  onComplete: (answers: Answers) => void
}

type Action = { type: 'set'; itemId: string; value: AnswerValue }
function answersReducer(state: Answers, action: Action): Answers {
  switch (action.type) {
    case 'set':
      return { ...state, [action.itemId]: action.value }
    default:
      return state
  }
}

function ItemInput({
  item,
  value,
  onChange,
}: {
  item: QuestionnaireItem
  value: AnswerValue | undefined
  onChange: (v: AnswerValue) => void
}) {
  switch (item.type_input) {
    case 'yesno':
      return <YesNoInput item={item} value={value} onChange={onChange} />
    case 'choice':
      return <ChoiceInput item={item} value={value} onChange={onChange} />
    case 'multi':
      return <MultiInput item={item} value={value} onChange={onChange} />
    case 'scale':
    default:
      return <ScaleInput item={item} value={value} onChange={onChange} />
  }
}

function isAnswered(v: AnswerValue | undefined): boolean {
  if (v === undefined || v === null) return false
  if (Array.isArray(v)) return v.length > 0
  return true
}

/**
 * Parcours bloc par bloc. Réponses en mémoire (useReducer) — AUCUNE persistance,
 * AUCune reprise : quitter = recommencer (contrainte RGPD voulue).
 */
export default function AutoEvalPlayer({ questionnaire, onComplete }: Props) {
  const [answers, dispatch] = useReducer(answersReducer, {})
  const [blockIndex, setBlockIndex] = useState(0)
  const [showRecap, setShowRecap] = useState(false)

  const blocks = questionnaire.blocks
  const block = blocks[blockIndex]
  const isLastBlock = blockIndex === blocks.length - 1

  const allAnswered = useMemo(
    () => block.items.every((it) => isAnswered(answers[it.id])),
    [block, answers]
  )

  const recap = useMemo(
    () => (showRecap ? computeBlockRecap(block, answers, questionnaire.routing) : null),
    [showRecap, block, answers, questionnaire.routing]
  )

  const handleContinue = () => {
    if (isLastBlock) {
      onComplete(answers)
      return
    }
    setShowRecap(false)
    setBlockIndex((i) => i + 1)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Progression */}
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-[#9ca3af]">
          <span>
            Volet {blockIndex + 1} / {blocks.length}
          </span>
          <span>{block.titre}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#2a2a2a]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#EC4899] to-[#A78BFA] transition-all"
            style={{ width: `${((blockIndex + (allAnswered ? 1 : 0)) / blocks.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="space-y-6">
        {block.items.map((item, idx) => (
          <div key={item.id}>
            <p className="mb-3 text-sm font-semibold leading-relaxed text-white">
              <span className="mr-1.5 text-[#EC4899]">{idx + 1}.</span>
              {item.libelle}
            </p>
            <ItemInput
              item={item}
              value={answers[item.id]}
              onChange={(v) => dispatch({ type: 'set', itemId: item.id, value: v })}
            />
          </div>
        ))}
      </div>

      {/* Action */}
      <button
        type="button"
        disabled={!allAnswered}
        onClick={() => setShowRecap(true)}
        className="mt-8 w-full rounded-2xl bg-[#EC4899] py-3.5 text-sm font-bold text-white transition-opacity enabled:hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {allAnswered ? 'Valider ce volet' : 'Répondez à toutes les questions'}
      </button>

      {recap && (
        <BlockRecapModal recap={recap} isLast={isLastBlock} onContinue={handleContinue} />
      )}
    </div>
  )
}
