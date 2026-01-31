'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Formation, UserFormation } from '@/types/database'

export interface FormationWithProgress extends Formation {
  currentSequence: number
  isStarted: boolean
  progressPercent: number
}

export function useFormations(userId?: string) {
  const [formations, setFormations] = useState<Formation[]>([])
  const [currentFormation, setCurrentFormation] = useState<FormationWithProgress | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchFormations() {
      const supabase = createClient()

      try {
        // Récupérer toutes les formations publiées
        const { data: formationsData, error: formationsError } = await supabase
          .from('formations')
          .select('*')
          .eq('is_published', true)
          .order('created_at', { ascending: false })

        if (formationsError) throw formationsError

        setFormations(formationsData || [])

        // Si utilisateur connecté, récupérer sa formation en cours
        if (userId) {
          const { data: userFormation, error: userError } = await supabase
            .from('user_formations')
            .select(`
              *,
              formation:formations(*)
            `)
            .eq('user_id', userId)
            .eq('is_active', true)
            .single()

          if (userError && userError.code !== 'PGRST116') {
            // PGRST116 = no rows returned, ce n'est pas une erreur
            throw userError
          }

          if (userFormation && userFormation.formation) {
            const formation = userFormation.formation as Formation
            setCurrentFormation({
              ...formation,
              currentSequence: userFormation.current_sequence || 1,
              isStarted: true,
              progressPercent: Math.round(((userFormation.current_sequence || 1) / formation.total_sequences) * 100)
            })
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    fetchFormations()
  }, [userId])

  // Démarrer une formation
  const startFormation = async (formationId: string) => {
    if (!userId) return

    const supabase = createClient()

    // Désactiver les autres formations en cours
    await supabase
      .from('user_formations')
      .update({ is_active: false })
      .eq('user_id', userId)

    // Créer la nouvelle inscription
    const { data, error } = await supabase
      .from('user_formations')
      .insert({
        user_id: userId,
        formation_id: formationId,
        is_active: true,
        current_sequence: 1,
        access_type: 'demo'
      })
      .select(`*, formation:formations(*)`)
      .single()

    if (!error && data && data.formation) {
      const formation = data.formation as Formation
      setCurrentFormation({
        ...formation,
        currentSequence: 1,
        isStarted: true,
        progressPercent: Math.round((1 / formation.total_sequences) * 100)
      })
    }
  }

  return { formations, currentFormation, loading, error, startFormation }
}
