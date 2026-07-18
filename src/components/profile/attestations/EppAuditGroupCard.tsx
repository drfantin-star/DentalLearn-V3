import { Shield } from 'lucide-react'
import { axeBannerStyle } from '@/lib/cp/axeColors'
import type { EppAuditGroup } from '@/lib/epp/groupEppDocuments'
import { AttestationCard } from './AttestationCard'
import { EppActionPlanCard } from './EppActionPlanCard'
import { EppComparisonCard } from './EppComparisonCard'

interface Props {
  group: EppAuditGroup
}

/**
 * Un bloc par audit EPP : titre affiché une seule fois, regroupant ses
 * documents (attestation, plan d'actions T1, comparatif T1/T2) en lignes
 * compactes plutôt qu'en 3 cartes distinctes répétant le même titre.
 */
export function EppAuditGroupCard({ group }: Props) {
  return (
    <div className="glass-card transition-premium rounded-2xl overflow-hidden">
      <div className="px-4 py-3" style={{ backgroundImage: axeBannerStyle(2) }}>
        <div className="flex items-center gap-2 text-white">
          <Shield className="w-4 h-4 flex-shrink-0" />
          <h3 className="font-bold text-[15px] leading-tight">{group.auditTitle}</h3>
        </div>
      </div>

      <div className="divide-y divide-white/10">
        {group.attestation && <AttestationCard attestation={group.attestation} variant="compact" />}
        {group.actionPlan && <EppActionPlanCard plan={group.actionPlan} variant="compact" />}
        {group.comparison && <EppComparisonCard comparison={group.comparison} variant="compact" />}
      </div>
    </div>
  )
}
