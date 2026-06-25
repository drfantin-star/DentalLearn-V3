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
    text: 'Realisez un audit clinique complet (T1 + T2) pour generer votre attestation EPP.',
    href: '/formation',
    cta: 'Decouvrir les audits →',
  },
  action_cnp_info_patient: {
    Icon: ShieldCheck,
    title: "Aucune attestation de demarche patient",
    text: "Attestez votre demarche d'information patient depuis la bibliotheque de ressources (Axe 3, Action F).",
    href: '/patient/bibliotheque',
    cta: 'Aller a la bibliotheque →',
  },
} as const

export function AttestationEmptyState({ type }: Props) {
  const { Icon, title, text, href, cta } = CONTENT[type]

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-white/40" />
      </div>
      <h3 className="font-semibold text-white mb-2">{title}</h3>
      <p className="text-sm text-white/55 max-w-xs mb-4">{text}</p>
      <Link
        href={href}
        className="text-sm font-medium text-accent hover:underline"
      >
        {cta}
      </Link>
    </div>
  )
}
