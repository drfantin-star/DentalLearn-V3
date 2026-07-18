import type { UserAttestation } from '@/lib/hooks/useUserAttestations'
import type { EppActionPlan } from '@/lib/hooks/useEppActionPlans'
import type { EppComparison } from '@/lib/hooks/useEppComparisons'

export interface EppAuditGroup {
  auditId: string
  auditTitle: string
  attestation?: UserAttestation
  actionPlan?: EppActionPlan
  comparison?: EppComparison
}

/**
 * Regroupe les 3 sources de documents EPP (attestations, plans d'action,
 * comparatifs) par audit — `attestation.source_id`, `plan.auditId` et
 * `comparison.auditId` désignent tous le même `epp_audits.id`. Trie le
 * résultat par activité la plus récente.
 */
export function groupEppDocumentsByAudit(
  attestations: UserAttestation[],
  actionPlans: EppActionPlan[],
  comparisons: EppComparison[]
): EppAuditGroup[] {
  const groups = new Map<string, EppAuditGroup>()

  const getOrCreate = (auditId: string, auditTitle: string): EppAuditGroup => {
    let group = groups.get(auditId)
    if (!group) {
      group = { auditId, auditTitle }
      groups.set(auditId, group)
    }
    return group
  }

  for (const attestation of attestations) {
    const auditId = attestation.source_id || attestation.id
    getOrCreate(auditId, attestation.title).attestation = attestation
  }

  for (const plan of actionPlans) {
    getOrCreate(plan.auditId, plan.auditTitle).actionPlan = plan
  }

  for (const comparison of comparisons) {
    getOrCreate(comparison.auditId, comparison.auditTitle).comparison = comparison
  }

  const mostRecentActivity = (group: EppAuditGroup): string =>
    [
      group.attestation?.completed_at,
      group.comparison?.t2CompletedAt,
      group.actionPlan?.completedAt,
    ]
      .filter(Boolean)
      .sort()
      .pop() || ''

  return Array.from(groups.values()).sort((a, b) =>
    mostRecentActivity(b).localeCompare(mostRecentActivity(a))
  )
}
