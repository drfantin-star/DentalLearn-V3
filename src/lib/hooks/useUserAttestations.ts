'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export type AttestationType = 'formation_online' | 'epp'
export type CnpLabellisation = 'en_cours' | 'labellisee' | 'non_applicable'

export interface UserAttestation {
  id: string
  user_id: string
  type: AttestationType
  axe_cp: number | null
  type_action_cnp: string | null
  cnp_labellisation: CnpLabellisation
  source_id: string | null
  title: string
  formateur: string | null
  comite_scientifique: string | null
  started_at: string | null
  completed_at: string
  duree_heures: number | null
  duree_breakdown: Record<string, number> | null
  taux_reussite_quiz: number | null
  taux_completion: number | null
  nb_sequences: number | null
  nb_sequences_total: number | null
  score_t1: number | null
  score_t2: number | null
  delta_score: number | null
  nb_dossiers_t1: number | null
  nb_dossiers_t2: number | null
  pdf_path: string | null
  verification_code: string
  issued_at: string
  created_at: string
}

export function useUserAttestations() {
  const [attestations, setAttestations] = useState<UserAttestation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAttestations() {
      const supabase = createClient()

      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setAttestations([])
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('user_attestations')
          .select('*')
          .eq('user_id', user.id)
          .order('completed_at', { ascending: false })

        if (error) throw error

        setAttestations((data || []) as UserAttestation[])
      } catch (err: any) {
        console.error('Error fetching attestations:', err)
        setError(err.message || 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }

    fetchAttestations()
  }, [])

  const byType = (type: AttestationType) => attestations.filter(a => a.type === type)

  return {
    attestations,
    loading,
    error,
    formationOnline: byType('formation_online'),
    epp: byType('epp'),
    refetch: () => {
      setLoading(true)
      // Trigger via dependency change — simple approach
      window.location.reload()
    }
  }
}
