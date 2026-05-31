'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { AutoevalParticipant } from './generateAttestationPDF'

interface State {
  count: number
  latestCompletedAt: string | null
  participant: AutoevalParticipant | null
  loading: boolean
}

/**
 * Charge les réalisations d'auto-évaluation santé de l'utilisateur (preuve Action B)
 * + son identité (pour régénérer l'attestation côté client). Lit UNIQUEMENT
 * autoeval_completions — PAS user_attestations. Rien n'est stocké côté serveur.
 */
export function useAutoevalCompletions(): State {
  const [state, setState] = useState<State>({
    count: 0,
    latestCompletedAt: null,
    participant: null,
    loading: true,
  })

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        if (!cancelled) setState((s) => ({ ...s, loading: false }))
        return
      }

      const { data: completions } = await supabase
        .from('autoeval_completions')
        .select('completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, rpps, profession')
        .eq('id', user.id)
        .single()

      if (cancelled) return
      const last = (profile?.last_name ?? '').toUpperCase()
      const first = profile?.first_name ?? ''
      setState({
        count: completions?.length ?? 0,
        latestCompletedAt: completions?.[0]?.completed_at ?? null,
        participant: {
          nom_complet: `Dr ${last} ${first}`.trim(),
          rpps: profile?.rpps ?? '',
          profession: profile?.profession ?? 'Chirurgien-dentiste',
        },
        loading: false,
      })
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
