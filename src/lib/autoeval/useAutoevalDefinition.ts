'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Questionnaire, QuestionnaireBlock } from './types'

/**
 * Charge la définition d'un questionnaire actif (blocs + items + routage) en une
 * requête jointe. Lecture seule — aucune réponse n'est lue ni écrite ici.
 */
export function useAutoevalDefinition(slug = 'sante-axe4') {
  const [questionnaire, setQuestionnaire] = useState<Questionnaire | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    async function load() {
      const { data, error } = await supabase
        .from('questionnaires')
        .select(
          `id, slug, titre, description, axe_cp, intro_text, time_estimate_min,
           blocks:questionnaire_blocks (
             id, questionnaire_id, ordre, titre, type_bloc, verrouille, scoring_rule, recap_config,
             items:questionnaire_items (
               id, block_id, ordre, libelle, libelle_en, type_input, options, sens, reverse, factual_card
             )
           ),
           routing:questionnaire_routing ( id, ordre, condition, carte )`
        )
        .eq('slug', slug)
        .eq('actif', true)
        .single()

      if (cancelled) return
      if (error || !data) {
        setError(error?.message ?? 'Questionnaire introuvable')
        setLoading(false)
        return
      }

      // Tri client-side (l'ordre des relations imbriquées n'est pas garanti).
      const blocks = (data.blocks as QuestionnaireBlock[])
        .map((b) => ({ ...b, items: [...(b.items ?? [])].sort((x, y) => x.ordre - y.ordre) }))
        .sort((a, b) => a.ordre - b.ordre)
      const routing = [...(data.routing ?? [])].sort((a, b) => a.ordre - b.ordre)

      setQuestionnaire({ ...data, blocks, routing } as Questionnaire)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [slug])

  return { questionnaire, loading, error }
}
