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
 * Onglet « Sante praticien » (Axe 4 — Action B). Lit autoeval_completions et
 * regenere l'attestation cote client a la demande. Decouple de user_attestations :
 * aucun PDF stocke, donc pas de code de verification (rien a verifier cote serveur).
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
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    )
  }

  if (!latestCompletedAt) {
    return (
      <div className="text-center py-12 px-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-900/30 mb-4">
          <HeartPulse className="w-7 h-7 text-amber-500" />
        </div>
        <h3 className="font-semibold text-white">Aucune auto-evaluation</h3>
        <p className="text-sm text-white/55 mt-1">
          Realisez l'auto-evaluation de votre sante (Action B) depuis l'espace Sante praticien.
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
    <div className="glass-card transition-premium rounded-2xl overflow-hidden">
      {/* Header colore (axe 4) */}
      <div className="bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <HeartPulse className="w-4 h-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">
              Auto-evaluation sante
            </span>
          </div>
          <span className="text-xs text-white/90 font-medium">Axe 4 — Sante praticien</span>
        </div>
      </div>

      {/* Corps */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-white text-[15px] leading-tight">
            Auto-evaluation de la sante du praticien
          </h3>
          <p className="text-xs text-white/55 mt-0.5">Action B</p>
        </div>

        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1 text-white/70">
            <Calendar className="w-3.5 h-3.5" />
            <span>Derniere realisation : {formatDate(latestCompletedAt)}</span>
          </div>
          {count > 1 && (
            <div className="text-white/55">
              {count} realisations enregistrees
            </div>
          )}
        </div>

        <button
          onClick={handleDownload}
          disabled={downloading || !participant}
          className="w-full flex items-center justify-center gap-2 bg-white text-gray-900 hover:bg-neutral-100 px-4 py-2.5 rounded-xl text-sm font-semibold transition-premium disabled:opacity-50"
        >
          {downloading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Generation…</span>
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              <span>Retelecharger l'attestation</span>
            </>
          )}
        </button>

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-white/40">
          <Lock className="w-3 h-3 mt-0.5 flex-shrink-0" />
          Par confidentialite, cette attestation ne comporte aucun resultat et n'est pas conservee :
          elle est regeneree sur votre appareil a chaque telechargement.
        </p>
      </div>
    </div>
  )
}
