'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Enregistre l'événement de complétion (preuve Action B) dans autoeval_completions.
 *
 * SEULE écriture autorisée du module. AUCUNE réponse, AUCUN score n'est transmis
 * (RGPD Art. 9). N'utilise PAS user_points ni useSubmitSequenceResult — ce parcours
 * n'attribue aucun point de gamification.
 */
export function useAutoevalCompletion() {
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function markCompleted(questionnaireId: string): Promise<boolean> {
    setCompleting(true)
    setError(null)
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      setError('Non authentifié')
      setCompleting(false)
      return false
    }

    const { error } = await supabase
      .from('autoeval_completions')
      .insert({ user_id: user.id, questionnaire_id: questionnaireId })

    setCompleting(false)
    if (error) {
      setError(error.message)
      return false
    }
    return true
  }

  return { markCompleted, completing, error }
}
