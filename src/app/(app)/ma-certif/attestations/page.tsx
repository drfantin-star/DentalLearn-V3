'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Award, Shield, ShieldCheck, HeartPulse, Loader2 } from 'lucide-react'
import { useUserAttestations } from '@/lib/hooks/useUserAttestations'
import { useAutoevalCompletions } from '@/lib/autoeval/useAutoevalCompletions'
import { AttestationCard } from '@/components/profile/attestations/AttestationCard'
import { AttestationEmptyState } from '@/components/profile/attestations/AttestationEmptyState'
import AutoevalAttestationTab from '@/components/profile/attestations/AutoevalAttestationTab'
import { EppActionPlanCard } from '@/components/profile/attestations/EppActionPlanCard'
import { useEppActionPlans } from '@/lib/hooks/useEppActionPlans'

type TabType = 'formation_online' | 'epp' | 'action_cnp_info_patient' | 'autoeval'

export default function MaCertifAttestationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('formation_online')
  const { formationOnline, epp, actionF, loading, error } = useUserAttestations()
  const autoeval = useAutoevalCompletions()
  const { plans: actionPlans, loading: plansLoading } = useEppActionPlans()

  const currentList =
    activeTab === 'formation_online'
      ? formationOnline
      : activeTab === 'epp'
        ? epp
        : activeTab === 'action_cnp_info_patient'
          ? actionF
          : []

  return (
    <div className="min-h-screen pb-24" style={{ background: '#0F0F0F' }}>
      {/* Header */}
      <div className="sticky top-0 z-10" style={{ background: '#1a1a1a', borderBottom: '0.5px solid #2a2a2a' }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/ma-certif"
            className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-premium"
            aria-label="Retour a Ma Certif"
          >
            <ArrowLeft className="w-4 h-4 text-white/70" />
          </Link>
          <div>
            <h1 className="font-bold text-white text-lg leading-tight">
              Mes attestations et documents
            </h1>
            <p className="text-xs text-white/55">
              Certificats Qualiopi · QUA006589
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: '#111111' }}>
            <button
              onClick={() => setActiveTab('formation_online')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-premium ${
                activeTab === 'formation_online' ? 'text-white shadow-sm' : 'text-white/55'
              }`}
              style={activeTab === 'formation_online' ? { background: '#242424' } : {}}
            >
              <Award className="w-4 h-4" />
              <span>Formations</span>
              {formationOnline.length > 0 && (
                <span className="text-xs bg-white/10 rounded-full px-1.5 py-0.5 min-w-[20px] text-center text-white/70">
                  {formationOnline.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('epp')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-premium ${
                activeTab === 'epp' ? 'text-white shadow-sm' : 'text-white/55'
              }`}
              style={activeTab === 'epp' ? { background: '#242424' } : {}}
            >
              <Shield className="w-4 h-4" />
              <span>Audits EPP</span>
              {epp.length > 0 && (
                <span className="text-xs bg-white/10 rounded-full px-1.5 py-0.5 min-w-[20px] text-center text-white/70">
                  {epp.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('action_cnp_info_patient')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-premium ${
                activeTab === 'action_cnp_info_patient' ? 'text-white shadow-sm' : 'text-white/55'
              }`}
              style={activeTab === 'action_cnp_info_patient' ? { background: '#242424' } : {}}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Demarche patient</span>
              {actionF.length > 0 && (
                <span className="text-xs bg-white/10 rounded-full px-1.5 py-0.5 min-w-[20px] text-center text-white/70">
                  {actionF.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('autoeval')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-premium ${
                activeTab === 'autoeval' ? 'text-white shadow-sm' : 'text-white/55'
              }`}
              style={activeTab === 'autoeval' ? { background: '#242424' } : {}}
            >
              <HeartPulse className="w-4 h-4" />
              <span>Sante praticien</span>
              {autoeval.count > 0 && (
                <span className="text-xs bg-white/10 rounded-full px-1.5 py-0.5 min-w-[20px] text-center text-white/70">
                  {autoeval.count}
                </span>
              )}
            </button>
          </div>
          <div className="h-3" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {activeTab === 'autoeval' ? (
          <AutoevalAttestationTab
            count={autoeval.count}
            latestCompletedAt={autoeval.latestCompletedAt}
            participant={autoeval.participant}
            loading={autoeval.loading}
          />
        ) : (
          <>
            {loading && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-white/40" />
              </div>
            )}

            {error && (
              <div className="bg-red-900/20 border border-red-900/40 rounded-xl p-4 text-sm text-red-400">
                Erreur lors du chargement : {error}
              </div>
            )}

            {!loading && !error && currentList.length === 0 &&
              !(activeTab === 'epp' && (actionPlans.length > 0 || plansLoading)) && (
              <AttestationEmptyState type={activeTab} />
            )}

            {!loading && !error && currentList.length > 0 && (
              <div className="space-y-3">
                {currentList.map(attestation => (
                  <AttestationCard key={attestation.id} attestation={attestation} />
                ))}
              </div>
            )}

            {/* Plans d'action EPP sauvegardes (Tour 1) */}
            {!error && activeTab === 'epp' && actionPlans.length > 0 && (
              <div className={currentList.length > 0 ? 'mt-8' : ''}>
                <h2 className="text-sm font-semibold text-white/70 mb-3 px-1">
                  Plans d&apos;action sauvegardes
                </h2>
                <div className="space-y-3">
                  {actionPlans.map(plan => (
                    <EppActionPlanCard key={plan.sessionId} plan={plan} />
                  ))}
                </div>
              </div>
            )}

            {!loading && !error && currentList.length > 0 && (
              <div className="mt-8 p-4 rounded-xl text-xs text-white/55" style={{ background: 'rgba(255,255,255,0.05)' }}>
                <p className="font-medium text-white mb-1">
                  A propos de vos attestations
                </p>
                <p className="leading-relaxed">
                  Vos attestations sont conservees 6 ans conformement au referentiel de la Certification Periodique.
                  Chaque attestation dispose d'un code de verification unique permettant sa validation par un tiers.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
