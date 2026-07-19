'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useAutoevalDefinition } from '@/lib/autoeval/useAutoevalDefinition'
import type { Answers } from '@/lib/autoeval/types'
import AutoEvalIntro from './AutoEvalIntro'
import AutoEvalPlayer from './AutoEvalPlayer'
import AutoEvalSynthese from './AutoEvalSynthese'

type Phase = 'intro' | 'running' | 'done'

/**
 * Machine d'état du parcours : intro → running → done. État 100 % local
 * (pas de persistance, pas de reprise — voulu).
 */
export default function AutoEvalFlow() {
  const { questionnaire, loading, error } = useAutoevalDefinition('sante-axe4')
  const [phase, setPhase] = useState<Phase>('intro')
  const [answers, setAnswers] = useState<Answers>({})

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="animate-spin text-pink-500" size={28} />
      </div>
    )
  }

  if (error || !questionnaire) {
    return (
      <div className="mx-auto max-w-lg px-4 py-10 text-center">
        <p className="text-sm text-[#9ca3af]">
          Ce questionnaire n'est pas disponible pour le moment.
        </p>
      </div>
    )
  }

  if (phase === 'intro') {
    return <AutoEvalIntro questionnaire={questionnaire} onStart={() => setPhase('running')} />
  }

  if (phase === 'running') {
    return (
      <AutoEvalPlayer
        questionnaire={questionnaire}
        onComplete={(a) => {
          setAnswers(a)
          setPhase('done')
          window.scrollTo({ top: 0 })
        }}
      />
    )
  }

  return <AutoEvalSynthese questionnaire={questionnaire} answers={answers} />
}
