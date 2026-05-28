'use client'

import { memo } from 'react'
import { parseCaseStudyData } from '@/lib/questions/parseCaseStudyData'

export interface CaseStudyQuestionProps {
  options: unknown
  // Énoncé racine (cas LEGACY_ARRAY, où l'énoncé vit dans question_text).
  // Les consumers actuels affichent déjà question_text dans leur en-tête propre
  // et passent donc `undefined` ici pour éviter le doublon ; le prop reste
  // disponible pour un usage standalone.
  rootText?: string
  showFeedback: boolean
  selectedChoiceId: string | null
  onSelectChoice: (choiceId: string) => void
  // Multi-sous-questions (défensif : N === 1 en prod aujourd'hui).
  currentSubQ?: number
  onSubQChange?: (idx: number) => void
}

// Le token Tailwind `primary` vaut #2D1B96 (ancienne constante brute désormais
// interdite en littéral) : on l'utilise pour l'état sélectionné afin de
// reproduire le rendu historique sans coder la couleur en dur.
function CaseStudyQuestionInner({
  options,
  rootText,
  showFeedback,
  selectedChoiceId,
  onSelectChoice,
  currentSubQ = 0,
  onSubQChange,
}: CaseStudyQuestionProps) {
  const parsed = parseCaseStudyData(options)
  if (!parsed) return null

  const subQ = parsed.questions[currentSubQ]
  if (!subQ) return null

  const context = parsed.context
  const isLastSubQ = currentSubQ >= parsed.questions.length - 1
  const enonce = subQ.text || rootText

  return (
    <div className="space-y-4">
      {context?.history && (
        <div className="rounded-2xl p-4" style={{ background: '#0f172a', border: '1px solid #1e3a5f' }}>
          <p className="text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: '#60a5fa' }}>
            Contexte clinique
          </p>
          <p className="text-sm leading-relaxed" style={{ color: '#e5e5e5' }}>
            {context.history}
          </p>
          {context.chief_complaint && (
            <p className="text-sm mt-1 italic" style={{ color: '#a3a3a3' }}>
              {context.chief_complaint}
            </p>
          )}
        </div>
      )}

      {parsed.questions.length > 1 && (
        <p className="text-[11px] text-gray-400">
          Question {currentSubQ + 1} / {parsed.questions.length}
        </p>
      )}

      {enonce && (
        <p className="font-bold text-[15px] leading-snug" style={{ color: '#e5e5e5' }}>
          {enonce}
        </p>
      )}

      <div className="flex flex-col gap-2.5">
        {(subQ.choices || []).map((choice, i) => {
          const isSelected = selectedChoiceId === choice.id
          const isCorrect = choice.correct
          const selectedActive = isSelected && !showFeedback

          let bg = '#242424'
          let border = '#333'
          let textColor = '#e5e5e5'
          if (showFeedback) {
            if (isCorrect) {
              bg = '#F0FDF4'
              border = '#4ADE80'
            } else if (isSelected && !isCorrect) {
              bg = '#FEF2F2'
              border = '#FCA5A5'
            } else {
              textColor = '#94A3B8'
            }
          }

          return (
            <button
              key={choice.id}
              disabled={showFeedback || selectedChoiceId !== null}
              onClick={() => {
                if (showFeedback || selectedChoiceId !== null) return
                onSelectChoice(choice.id)
                if (!isLastSubQ && onSubQChange) {
                  setTimeout(() => onSubQChange(currentSubQ + 1), 600)
                }
              }}
              className={`w-full p-3.5 rounded-2xl text-left transition-all flex items-center gap-3 border-2 ${
                selectedActive ? 'border-primary bg-primary/25' : ''
              }`}
              style={
                selectedActive
                  ? { cursor: 'pointer' }
                  : { background: bg, borderColor: border, cursor: showFeedback ? 'default' : 'pointer' }
              }
            >
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{
                  background: showFeedback && isCorrect ? '#BBF7D0' : showFeedback && isSelected && !isCorrect ? '#FECACA' : '#EEF2FF',
                  color: showFeedback && isCorrect ? '#166534' : showFeedback && isSelected && !isCorrect ? '#991B1B' : '#4F46E5',
                }}
              >
                {showFeedback && isCorrect ? '✓' : showFeedback && isSelected && !isCorrect ? '✗' : String.fromCharCode(65 + i)}
              </span>
              <span className="flex-1 font-semibold text-sm" style={{ color: textColor }}>
                {choice.text}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const CaseStudyQuestion = memo(CaseStudyQuestionInner)

export default CaseStudyQuestion
