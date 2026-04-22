'use client'

import { Award, Shield } from 'lucide-react'
import Link from 'next/link'

interface Props {
  type: 'formation_online' | 'epp'
}

export function AttestationEmptyState({ type }: Props) {
  const isFormation = type === 'formation_online'

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        {isFormation ? (
          <Award className="w-8 h-8 text-gray-400 dark:text-neutral-500" />
        ) : (
          <Shield className="w-8 h-8 text-gray-400 dark:text-neutral-500" />
        )}
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
        {isFormation ? 'Aucune attestation de formation' : 'Aucune attestation EPP'}
      </h3>
      <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-xs mb-4">
        {isFormation
          ? 'Terminez une formation pour obtenir votre attestation automatiquement.'
          : 'Réalisez un audit clinique complet (T1 + T2) pour générer votre attestation EPP.'}
      </p>
      <Link
        href={isFormation ? '/' : '/formation'}
        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        {isFormation ? 'Explorer les formations →' : 'Découvrir les audits →'}
      </Link>
    </div>
  )
}
