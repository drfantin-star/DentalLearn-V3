'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface UseSatisfactionSurveyResult {
  hasCompleted: boolean | null
  loading: boolean
  error: string | null
  refetch: () => Promise<void>
}

/**
 * Vérifie si l'utilisateur courant a déjà rempli le questionnaire de satisfaction
 * pour la formation donnée. Utilisé par GenerateAttestationButton pour gater
 * le téléchargement d'attestation type='formation_online'.
 *
 * @param formationId UUID de la formation. Si null, le hook ne fait rien.
 */
export function useSatisfactionSurvey(formationId: string | null): UseSatisfactionSurveyResult {
  const [hasCompleted, setHasCompleted] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const check = useCallback(async () => {
    if (!formationId) {
      setHasCompleted(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data, error: rpcErr } = await supabase.rpc(
        'has_user_completed_satisfaction',
        { p_formation_id: formationId }
      )
      if (rpcErr) throw rpcErr
      setHasCompleted(Boolean(data))
    } catch (err: any) {
      console.error('useSatisfactionSurvey error:', err)
      setError(err.message || 'Erreur de vérification du questionnaire')
      // fail open : on permet la modal si erreur
      setHasCompleted(false)
    } finally {
      setLoading(false)
    }
  }, [formationId])

  useEffect(() => {
    check()
  }, [check])

  return { hasCompleted, loading, error, refetch: check }
}
