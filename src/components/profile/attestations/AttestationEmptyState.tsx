'use client'

import { Award, Shield, ShieldCheck } from 'lucide-react'
import Link from 'next/link'

interface Props {
  type: 'formation_online' | 'epp' | 'action_cnp_info_patient'
}

const CONTENT = {
  formation_online: {
    Icon: Award,
    title: 'Aucune attestation de formation',
    text: 'Terminez une formation pour obtenir votre attestation automatiquement.',
    href: '/',
    cta: 'Explorer les formations →',
  },
  epp: {
    Icon: Shield,
    title: 'Aucune attestation EPP',
    text: 'Réalisez un audit clinique complet (T1 + T2) pour générer votre attestation EPP.',
    href: '/formation',
    cta: 'Découvrir les audits →',
  },
  action_cnp_info_patient: {
    Icon: ShieldCheck,
    title: "Aucune attestation de démarche patient",
    text: "Attestez votre démarche d'information patient depuis la bibliothèque de ressources (Axe 3, Action F).",
    href: '/patient/bibliotheque',
    cta: 'Aller à la bibliothèque →',
  },
} as const

export function AttestationEmptyState({ type }: Props) {
  const { Icon, title, text, href, cta } = CONTENT[type]

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-gray-400 dark:text-neutral-500" />
      </div>
      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-sm text-gray-500 dark:text-neutral-400 max-w-xs mb-4">{text}</p>
      <Link
        href={href}
        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline"
      >
        {cta}
      </Link>
    </div>
  )
}
