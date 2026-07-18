'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { generateComparisonPDF, type ComparisonPdfCriterion } from '@/lib/epp/generateComparisonPDF'

// ----------------------------------------------------------------------------
// Comparatifs T1/T2 EPP sauvegardés
// ----------------------------------------------------------------------------
// Même logique que useEppActionPlans.ts : pas de PDF stocké, le document est
// régénéré à la demande à partir de user_epp_sessions (T1 + T2) et
// user_epp_responses — sources de vérité déjà en place. Surface de lecture
// ajoutée dans « Ma Certif → Mes attestations et documents » uniquement.
// Aucune migration.
// ----------------------------------------------------------------------------

export interface EppComparison {
  auditId: string
  auditTitle: string
  auditSlug: string
  themeSlug: string
  t1SessionId: string
  t2SessionId: string
  t1CompletedAt: string | null
  t2CompletedAt: string | null
  scoreT1: number | null
  scoreT2: number | null
  nbDossiersT1: number | null
  nbDossiersT2: number | null
}

export function useEppComparisons() {
  const [comparisons, setComparisons] = useState<EppComparison[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchComparisons() {
      const supabase = createClient()
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          setComparisons([])
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('user_epp_sessions')
          .select('id, audit_id, tour, completed_at, score_global, nb_dossiers, epp_audits(title, slug, theme_slug)')
          .eq('user_id', user.id)
          .in('tour', [1, 2])
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false })

        if (error) throw error

        // Regroupe par audit_id, ne garde que les paires T1+T2 toutes deux terminées.
        const byAudit = new Map<string, any[]>()
        for (const row of data || []) {
          const list = byAudit.get(row.audit_id) || []
          list.push(row)
          byAudit.set(row.audit_id, list)
        }

        const mapped: EppComparison[] = []
        byAudit.forEach((rows) => {
          const t1 = rows.find((r) => r.tour === 1)
          const t2 = rows.find((r) => r.tour === 2)
          if (!t1 || !t2) return
          const auditRel = Array.isArray(t1.epp_audits) ? t1.epp_audits[0] : t1.epp_audits
          mapped.push({
            auditId: t1.audit_id,
            auditTitle: auditRel?.title ?? 'Audit EPP',
            auditSlug: auditRel?.slug ?? '',
            themeSlug: auditRel?.theme_slug ?? '',
            t1SessionId: t1.id,
            t2SessionId: t2.id,
            t1CompletedAt: t1.completed_at,
            t2CompletedAt: t2.completed_at,
            scoreT1: t1.score_global,
            scoreT2: t2.score_global,
            nbDossiersT1: t1.nb_dossiers,
            nbDossiersT2: t2.nb_dossiers,
          })
        })

        mapped.sort((a, b) => (b.t2CompletedAt || '').localeCompare(a.t2CompletedAt || ''))
        setComparisons(mapped)
      } catch (err: any) {
        console.error('Error fetching EPP comparisons:', err)
        setError(err.message || 'Erreur de chargement')
      } finally {
        setLoading(false)
      }
    }

    fetchComparisons()
  }, [])

  return { comparisons, loading, error }
}

/**
 * Recalcule le %conformité par critère pour T1 et T2, puis déclenche le
 * téléchargement du PDF comparatif — identique à celui de l'écran EPP
 * (logique reprise de loadComparisonData dans epp/page.tsx).
 */
export async function downloadEppComparison(comparison: EppComparison): Promise<void> {
  const supabase = createClient()

  const { data: criteriaData, error: cErr } = await supabase
    .from('epp_criteria')
    .select('id, code, type, label')
    .eq('audit_id', comparison.auditId)
    .order('sort_order')
  if (cErr) throw cErr
  const criteria = (criteriaData || []) as Array<{ id: string; code: string; type: string; label: string }>

  const { data: respData, error: rErr } = await supabase
    .from('user_epp_responses')
    .select('session_id, criterion_id, response')
    .in('session_id', [comparison.t1SessionId, comparison.t2SessionId])
  if (rErr) throw rErr

  const counts: Record<string, Record<string, { oui: number; non: number }>> = {
    [comparison.t1SessionId]: {},
    [comparison.t2SessionId]: {},
  }
  for (const r of respData || []) {
    const bucket = counts[(r as any).session_id]
    if (!bucket) continue
    const criterionId = (r as any).criterion_id
    if (!bucket[criterionId]) bucket[criterionId] = { oui: 0, non: 0 }
    if ((r as any).response === 'oui') bucket[criterionId].oui++
    else if ((r as any).response === 'non') bucket[criterionId].non++
  }

  const pctFor = (sessionId: string, criterionId: string) => {
    const c = counts[sessionId][criterionId]
    if (!c || c.oui + c.non === 0) return null
    return Math.round((c.oui / (c.oui + c.non)) * 100)
  }

  const pdfCriteria: ComparisonPdfCriterion[] = criteria.map((c) => ({
    code: c.code,
    type: c.type,
    label: c.label,
    t1Pct: pctFor(comparison.t1SessionId, c.id),
    t2Pct: pctFor(comparison.t2SessionId, c.id),
  }))

  const scoreT1 = comparison.scoreT1 || 0
  const scoreT2 = comparison.scoreT2 || 0
  const eppValidated = scoreT2 > scoreT1 || (scoreT1 >= 80 && scoreT2 >= scoreT1)

  await generateComparisonPDF({
    audit: { title: comparison.auditTitle, slug: comparison.auditSlug || comparison.themeSlug || 'epp' },
    scoreT1,
    scoreT2,
    nbDossiersT1: comparison.nbDossiersT1,
    nbDossiersT2: comparison.nbDossiersT2,
    eppValidated,
    criteria: pdfCriteria,
  })
}
