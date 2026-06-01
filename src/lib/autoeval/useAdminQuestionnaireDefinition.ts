'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Questionnaire, QuestionnaireBlock } from './types'

/** Questionnaire chargé côté admin : inclut le flag `actif` (éditable). */
export type AdminQuestionnaire = Questionnaire & { actif: boolean }

/**
 * Variante ADMIN de `useAutoevalDefinition` :
 *  - charge par `slug` SANS filtre `actif` (un questionnaire inactif reste éditable) ;
 *  - inclut la colonne `actif` ;
 *  - expose `reload()` pour rafraîchir après une écriture.
 *
 * Lecture seule ici — les écritures passent par `adminMutations.ts`. Le client
 * Supabase est en session (RLS : SELECT authenticated, écriture super_admin).
 */
export function useAdminQuestionnaireDefinition(slug: string) {
  const [questionnaire, setQuestionnaire] = useState<AdminQuestionnaire | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('questionnaires')
      .select(
        `id, slug, titre, description, axe_cp, actif, intro_text, time_estimate_min,
         blocks:questionnaire_blocks (
           id, questionnaire_id, ordre, titre, type_bloc, verrouille, scoring_rule, recap_config,
           items:questionnaire_items (
             id, block_id, ordre, libelle, libelle_en, type_input, options, sens, reverse, factual_card
           )
         ),
         routing:questionnaire_routing ( id, ordre, condition, carte )`
      )
      .eq('slug', slug)
      .single()

    if (error || !data) {
      setError(error?.message ?? 'Questionnaire introuvable')
      setQuestionnaire(null)
      setLoading(false)
      return
    }

    // Tri client-side (l'ordre des relations imbriquées n'est pas garanti).
    const blocks = (data.blocks as QuestionnaireBlock[])
      .map((b) => ({ ...b, items: [...(b.items ?? [])].sort((x, y) => x.ordre - y.ordre) }))
      .sort((a, b) => a.ordre - b.ordre)
    const routing = [...(data.routing ?? [])].sort((a, b) => a.ordre - b.ordre)

    setError(null)
    setQuestionnaire({ ...data, blocks, routing } as AdminQuestionnaire)
    setLoading(false)
  }, [slug])

  useEffect(() => {
    load()
  }, [load])

  return { questionnaire, loading, error, reload: load }
}
