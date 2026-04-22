'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Award, Shield, Loader2 } from 'lucide-react'
import { useUserAttestations } from '@/lib/hooks/useUserAttestations'
import { AttestationCard } from '@/components/profile/attestations/AttestationCard'
import { AttestationEmptyState } from '@/components/profile/attestations/AttestationEmptyState'

type TabType = 'formation_online' | 'epp'

export default function AttestationsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('formation_online')
  const { formationOnline, epp, loading, error } = useUserAttestations()

  const currentList = activeTab === 'formation_online' ? formationOnline : epp

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-black pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-950 border-b border-gray-200 dark:border-neutral-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/profil"
            className="w-9 h-9 rounded-full bg-gray-100 dark:bg-neutral-800 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-neutral-700 transition-colors"
            aria-label="Retour au profil"
          >
            <ArrowLeft className="w-4 h-4 text-gray-700 dark:text-neutral-300" />
          </Link>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white text-lg leading-tight">
              Mes attestations
            </h1>
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              Certificats Qualiopi · QUA006589
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="max-w-2xl mx-auto px-4">
          <div className="flex gap-1 bg-gray-100 dark:bg-neutral-900 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('formation_online')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'formation_online'
                  ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-neutral-400'
              }`}
            >
              <Award className="w-4 h-4" />
              <span>Formations</span>
              {formationOnline.length > 0 && (
                <span className="text-xs bg-gray-200 dark:bg-neutral-700 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {formationOnline.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('epp')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'epp'
                  ? 'bg-white dark:bg-neutral-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 dark:text-neutral-400'
              }`}
            >
              <Shield className="w-4 h-4" />
              <span>Audits EPP</span>
              {epp.length > 0 && (
                <span className="text-xs bg-gray-200 dark:bg-neutral-700 rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {epp.length}
                </span>
              )}
            </button>
          </div>
          <div className="h-3" />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-4">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl p-4 text-sm text-red-700 dark:text-red-400">
            Erreur lors du chargement : {error}
          </div>
        )}

        {!loading && !error && currentList.length === 0 && (
          <AttestationEmptyState type={activeTab} />
        )}

        {!loading && !error && currentList.length > 0 && (
          <div className="space-y-3">
            {currentList.map(attestation => (
              <AttestationCard key={attestation.id} attestation={attestation} />
            ))}
          </div>
        )}

        {/* Footer info */}
        {!loading && !error && currentList.length > 0 && (
          <div className="mt-8 p-4 bg-gray-100 dark:bg-neutral-900 rounded-xl text-xs text-gray-600 dark:text-neutral-400">
            <p className="font-medium text-gray-900 dark:text-white mb-1">
              À propos de vos attestations
            </p>
            <p className="leading-relaxed">
              Vos attestations sont conservées 6 ans conformément au référentiel de la Certification Périodique.
              Chaque attestation dispose d'un code de vérification unique permettant sa validation par un tiers.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
