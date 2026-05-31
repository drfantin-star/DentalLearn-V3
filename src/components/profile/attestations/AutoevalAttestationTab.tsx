'use client'

import { useState } from 'react'
import { Calendar, Download, HeartPulse, Loader2, Lock } from 'lucide-react'
import { downloadBlob } from '@/lib/attestations/saveAttestation'
import {
  generateAttestationPDF,
  getAttestationFilename,
} from '@/lib/autoeval/generateAttestationPDF'
import type { AutoevalParticipant } from '@/lib/autoeval/generateAttestationPDF'

interface Props {
  count: number
  latestCompletedAt: string | null
  participant: AutoevalParticipant | null
  loading: boolean
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * Onglet « Santé praticien » (Axe 4 — Action B). Lit autoeval_completions et
 * régénère l'attestation côté client à la demande. Découplé de user_attestations :
 * aucun PDF stocké, donc pas de code de vérification (rien à vérifier côté serveur).
 */
export default function AutoevalAttestationTab({
  count,
  latestCompletedAt,
  participant,
  loading,
}: Props) {
  const [downloading, setDownloading] = useState(false)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!latestCompletedAt) {
    return (
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/20 mb-4">
          <HeartPulse className="w-7 h-7 text-amber-500" />
        </div>
        <h3 className="font-semibold text-gray-900 dark:text-white">Aucune auto-évaluation</h3>
        <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
          Réalisez l'auto-évaluation de votre santé (Action B) depuis l'espace Santé praticien.
        </p>
      </div>
    )
  }

  const handleDownload = async () => {
    if (!participant) return
    setDownloading(true)
    try {
      const blob = await generateAttestationPDF(participant, latestCompletedAt)
      downloadBlob(blob, getAttestationFilename())
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-sm">
      {/* Header coloré (axe 4) */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <HeartPulse className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Auto-évaluation santé
            </span>
          </div>
          <span className="text-xs text-white/90 font-medium">Axe 4 — Santé praticien</span>
        </div>
      </div>

      {/* Corps */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-[15px] leading-tight">
            Auto-évaluation de la santé du praticien
          </h3>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Action B</p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1 text-gray-600 dark:text-neutral-300">
            <Calendar className="w-3.5 h-3.5" />
            <span>Dernière réalisation : {formatDate(latestCompletedAt)}</span>
          </div>
          {count > 1 && (
            <div className="text-gray-500 dark:text-neutral-400">
              {count} réalisations enregistrées
            </div>
          )}
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading || !participant}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-neutral-100 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        >
          {downloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Génération…</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Retélécharger l'attestation</span>
            </>
          )}
        </button>

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-gray-400 dark:text-neutral-500">
          <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
          Par confidentialité, cette attestation ne comporte aucun résultat et n'est pas conservée :
          elle est régénérée sur votre appareil à chaque téléchargement.
        </p>
      </div>
    </div>
  )
}
