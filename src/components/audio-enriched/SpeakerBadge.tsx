'use client'

import { memo } from 'react'

import type { Speaker } from '@/lib/timeline/schema'

/**
 * Badge identifiant le speaker d'un segment (Sophie ou Martin).
 *
 * Couleurs alignées sur le design system DentalLearn :
 *  - Sophie (praticienne, ton chaleureux) : turquoise (`ds-turquoise`).
 *  - Martin (expert, ton froid/pro)       : bleu (`ds-blue`).
 *
 * Mémoïsé car le composant est rendu autant de fois qu'il y a de segments
 * (≈ 26 segments sur le pilote) et son rendu est entièrement piloté par
 * `speaker` qui ne change jamais après le premier render d'un segment donné.
 */

interface SpeakerBadgeProps {
  speaker: Speaker
  className?: string
}

const SPEAKER_LABEL: Record<Speaker, string> = {
  sophie: 'Sophie',
  martin: 'Martin',
}

const SPEAKER_INITIAL: Record<Speaker, string> = {
  sophie: 'S',
  martin: 'M',
}

const SPEAKER_PASTILLE: Record<Speaker, string> = {
  // Sophie : turquoise, texte bleu profond → contraste fort.
  sophie: 'bg-ds-turquoise text-ds-blue-dark',
  // Martin : bleu profond, texte blanc → contraste fort.
  martin: 'bg-ds-blue text-white',
}

const SPEAKER_NAME: Record<Speaker, string> = {
  sophie: 'text-ds-turquoise',
  martin: 'text-ds-blue',
}

function SpeakerBadgeBase({ speaker, className }: SpeakerBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-2 ${className ?? ''}`}
      aria-label={`Locuteur : ${SPEAKER_LABEL[speaker]}`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${SPEAKER_PASTILLE[speaker]}`}
        aria-hidden="true"
      >
        {SPEAKER_INITIAL[speaker]}
      </span>
      <span className={`text-sm font-semibold ${SPEAKER_NAME[speaker]}`}>
        {SPEAKER_LABEL[speaker]}
      </span>
    </div>
  )
}

export const SpeakerBadge = memo(SpeakerBadgeBase)
SpeakerBadge.displayName = 'SpeakerBadge'
