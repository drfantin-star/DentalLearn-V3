'use client'

import React from 'react'

// Rendu commun aux fill_blank (DailyQuizModal + quizz de sequence) : affiche la
// phrase de la question avec chaque trou remplace par un SLOT visible (chip
// encadre) au lieu du token brut « ________ » noye dans le texte. Couleurs via
// tokens du design system uniquement (accent / emerald / red), jamais de hex.

const BLANK_TOKEN = '________'

export interface FillBlankSlotDef {
  id: string
  correctAnswer: string
  alternatives?: string[]
}

interface FillBlankSentenceProps {
  questionText: string
  /** Blancs dans l'ordre d'apparition des « ________ » dans questionText. */
  blanks: FillBlankSlotDef[]
  answers: Record<string, string>
  showFeedback?: boolean
  /** Vider un slot rempli (mode saisie, hors feedback). */
  onClearBlank?: (blankId: string) => void
}

function isBlankCorrect(blank: FillBlankSlotDef, answer: string | undefined): boolean {
  if (!answer) return false
  const a = answer.toLowerCase().trim()
  return (
    a === blank.correctAnswer.toLowerCase().trim() ||
    (blank.alternatives?.some(alt => alt.toLowerCase().trim() === a) ?? false)
  )
}

export default function FillBlankSentence({
  questionText,
  blanks,
  answers,
  showFeedback = false,
  onClearBlank,
}: FillBlankSentenceProps) {
  const parts = questionText.split(BLANK_TOKEN)

  return (
    <>
      {parts.map((part, i) => {
        const isLast = i === parts.length - 1
        const blank = blanks[i]
        const answer = blank ? answers[blank.id] : undefined
        const correct = blank ? isBlankCorrect(blank, answer) : false

        let slotClasses = 'border-dashed border-white/40 text-white/40'
        if (showFeedback) {
          slotClasses = correct
            ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
            : 'border-red-400 bg-red-500/15 text-red-300'
        } else if (answer) {
          slotClasses = 'border-accent bg-accent/20 text-white'
        }

        return (
          <React.Fragment key={i}>
            {part}
            {!isLast && blank && (
              <button
                type="button"
                disabled={showFeedback || !answer}
                onClick={() => answer && onClearBlank?.(blank.id)}
                className={`inline-flex items-center justify-center align-middle mx-1 min-w-[3.25rem] px-2.5 py-0.5 rounded-lg border-2 text-sm font-bold transition-premium ${slotClasses}`}
                aria-label={answer ? `Reponse : ${answer}` : 'Trou a completer'}
              >
                {answer || '   '}
              </button>
            )}
            {!isLast && blank && showFeedback && !correct && (
              <span className="text-emerald-400 text-sm font-semibold whitespace-nowrap"> {blank.correctAnswer}</span>
            )}
          </React.Fragment>
        )
      })}
    </>
  )
}
