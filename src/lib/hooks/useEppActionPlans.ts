'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  generatePlanActionsPDF,
  type PlanActionsSuggestion,
} from '@/lib/epp/generatePlanActionsPDF'

// ----------------------------------------------------------------------------
// Plans d'action EPP sauvegardés (Tour 1)
// ----------------------------------------------------------------------------
// Source : user_epp_sessions.plan_actions (blob JSON écrit par le bouton
// « Sauvegarder le plan d'actions » sur la page EPP). Cette table est déjà la
// source de vérité ; on ajoute uniquement une surface de lecture dans
// « Ma Certif → Mes attestations et documents ». Aucune migration.
// ----------------------------------------------------------------------------

interface SavedPlanEntry {
  text: string
  checked_suggestion_ids: string[]
}

export interface EppActionPlan {
  sessionId: string
  auditId: string
  auditTitle: string
  auditSlug: string
  themeSlug: string
  completedAt: string | null
  scoreGlobal: number | null
  nbDossiers: number | null
  planActions: Record<string, SavedPlanEntry>
}

/** Un plan est affichable s'il contient au moins une action (texte ou suggestion cochée). */
function hasContent(plan: Record<string, SavedPlanEntry> | null): boolean {
  if (!plan) return false
  return Object.values(plan).some(
    (e) => (e?.text && e.text.trim().length > 0) || (e?.checked_suggestion_ids?.length ?? 0) > 0
  )
}

export function useEppActionPlans() {
  const [plans, setPlans] = useState<EppActionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlans() {
      const supabase = createClient()
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setPlans([])
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('user_epp_sessions')
          .select('id, audit_id, completed_at, score_global, nb_dossiers, plan_actions, epp_audits(title, slug, theme_slug)')
          .eq('user_id', user.id)
          .eq('tour', 1)
          .not('plan_actions', 'is', null)
          .order('completed_at', { ascending: false })

        if (error) throw error

        const mapped: EppActionPlan[] = (data || [])
          .filter((row: any) => hasContent(row.plan_actions))
          .map((row: any) => {
            // epp_audits peut être renvoyé en objet ou en tableau selon l'inférence
            const auditRel = Array.isArray(row.epp_audits) ? row.epp_audits[0] : row.epp_audits
            return {
              sessionId: row.id,
              auditId: row.audit_id,
              auditTitle: auditRel?.title ?? 'Audit EPP',
              auditSlug: auditRel?.slug ?? '',
              themeSlug: auditRel?.theme_slug ?? '',
              completedAt: row.completed_at,
              scoreGlobal: row.score_global,
              nbDossiers: row.nb_dossiers,
              planActions: row.plan_actions as Record<string, SavedPlanEntry>,
            }
          })

        setPlans(mapped)
      } catch (err: any) {
        console.error('Error fetching EPP action plans:', err)
        setError(err.message || 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }

    fetchPlans()
  }, [])

  return { plans, loading, error }
}

/**
 * Reconstruit les données (critères, réponses, suggestions) d'un plan sauvegardé
 * et déclenche le téléchargement du PDF — identique à celui de la page EPP.
 */
export async function downloadEppActionPlan(plan: EppActionPlan): Promise<void> {
  const supabase = createClient()

  // 1. Critères de l'audit (ordre d'affichage)
  const { data: criteriaData, error: cErr } = await supabase
    .from('epp_criteria')
    .select('id, code, type, label')
    .eq('audit_id', plan.auditId)
    .order('sort_order')
  if (cErr) throw cErr
  const criteria = (criteriaData || []) as Array<{ id: string; code: string; type: string; label: string }>

  // 2. Réponses de la session → responses[dossier][criterionId]
  const { data: respData, error: rErr } = await supabase
    .from('user_epp_responses')
    .select('dossier_number, criterion_id, response')
    .eq('session_id', plan.sessionId)
  if (rErr) throw rErr
  const responses: Record<string, Record<string, 'oui' | 'non' | 'na'>> = {}
  for (const r of respData || []) {
    const key = String((r as any).dossier_number)
    if (!responses[key]) responses[key] = {}
    responses[key][(r as any).criterion_id] = (r as any).response
  }

  // 3. Suggestions d'amélioration → suggestions[criterionId]
  const suggestions: Record<string, PlanActionsSuggestion[]> = {}
  if (criteria.length > 0) {
    const { data: suggData } = await supabase
      .from('epp_improvement_suggestions')
      .select('id, criterion_id, text')
      .in('criterion_id', criteria.map(c => c.id))
      .order('sort_order')
    for (const s of suggData || []) {
      const cid = (s as any).criterion_id
      if (!suggestions[cid]) suggestions[cid] = []
      suggestions[cid].push({ id: (s as any).id, text: (s as any).text })
    }
  }

  // 4. Décomposer le blob plan_actions en planActions (texte) + checkedSuggestions (ids)
  const planActions: Record<string, string> = {}
  const checkedSuggestions: Record<string, string[]> = {}
  Object.entries(plan.planActions).forEach(([code, entry]) => {
    planActions[code] = entry?.text || ''
    checkedSuggestions[code] = entry?.checked_suggestion_ids || []
  })

  await generatePlanActionsPDF({
    audit: { title: plan.auditTitle, slug: plan.auditSlug || plan.themeSlug || 'epp' },
    t1Session: {
      completed_at: plan.completedAt,
      nb_dossiers: plan.nbDossiers,
      score_global: plan.scoreGlobal,
    },
    criteria,
    responses,
    suggestions,
    planActions,
    checkedSuggestions,
  })
}
