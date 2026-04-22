'use client'

import { useState } from 'react'
import { Download, Shield, Calendar, Clock, Award, TrendingUp, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { UserAttestation } from '@/lib/hooks/useUserAttestations'

interface AttestationCardProps {
  attestation: UserAttestation
}

const AXE_LABELS: Record<number, string> = {
  1: 'Axe 1 — Connaissances',
  2: 'Axe 2 — Qualité',
  3: 'Axe 3 — Relation patient',
  4: 'Axe 4 — Santé praticien',
}

const AXE_COLORS: Record<number, string> = {
  1: 'from-blue-600 to-blue-500',
  2: 'from-emerald-600 to-emerald-500',
  3: 'from-pink-600 to-pink-500',
  4: 'from-amber-600 to-amber-500',
}

export function AttestationCard({ attestation }: AttestationCardProps) {
  const [downloading, setDownloading] = useState(false)

  const isFormation = attestation.type === 'formation_online'
  const isEpp = attestation.type === 'epp'
  const axeColor = attestation.axe_cp ? AXE_COLORS[attestation.axe_cp] : 'from-gray-600 to-gray-500'
  const axeLabel = attestation.axe_cp ? AXE_LABELS[attestation.axe_cp] : null

  const handleDownload = async () => {
    if (!attestation.pdf_path) {
      alert('L\'attestation PDF est en cours de génération. Merci de revenir dans quelques instants.')
      return
    }

    setDownloading(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.storage
        .from('attestations')
        .createSignedUrl(attestation.pdf_path, 60)

      if (error) throw error
      if (!data?.signedUrl) throw new Error('URL non disponible')

      window.open(data.signedUrl, '_blank')
    } catch (err: any) {
      console.error('Download error:', err)
      alert('Impossible de télécharger le PDF. Veuillez réessayer.')
    } finally {
      setDownloading(false)
    }
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
  }

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl overflow-hidden border border-gray-200 dark:border-neutral-800 shadow-sm">
      {/* Header coloré selon axe */}
      <div className={`bg-gradient-to-r ${axeColor} px-4 py-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            {isFormation ? (
              <Award className="w-4 h-4" />
            ) : (
              <Shield className="w-4 h-4" />
            )}
            <span className="text-xs font-semibold uppercase tracking-wide">
              {isFormation ? 'Formation en ligne' : 'Audit EPP'}
            </span>
          </div>
          {axeLabel && (
            <span className="text-xs text-white/90 font-medium">
              {axeLabel}
            </span>
          )}
        </div>
      </div>

      {/* Corps */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-gray-900 dark:text-white text-[15px] leading-tight">
            {attestation.title}
          </h3>
          {attestation.formateur && (
            <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
              {attestation.formateur}
            </p>
          )}
        </div>

        {/* Métriques selon type */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1 text-gray-600 dark:text-neutral-300">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(attestation.completed_at)}</span>
          </div>
          {attestation.duree_heures && (
            <div className="flex items-center gap-1 text-gray-600 dark:text-neutral-300">
              <Clock className="w-3.5 h-3.5" />
              <span>{attestation.duree_heures}h</span>
            </div>
          )}
          {isFormation && attestation.taux_reussite_quiz !== null && (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <Award className="w-3.5 h-3.5" />
              <span>{attestation.taux_reussite_quiz}% de réussite</span>
            </div>
          )}
          {isEpp && attestation.delta_score !== null && (
            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                T1 {attestation.score_t1}% → T2 {attestation.score_t2}% (+{attestation.delta_score}pts)
              </span>
            </div>
          )}
        </div>

        {/* Label CNP si applicable */}
        {attestation.type_action_cnp && (
          <div className="text-xs text-gray-500 dark:text-neutral-400">
            <span className="font-medium">Type {attestation.type_action_cnp}</span>
            {attestation.cnp_labellisation === 'en_cours' && (
              <span className="ml-1 italic">— labellisation CNP en cours</span>
            )}
            {attestation.cnp_labellisation === 'labellisee' && (
              <span className="ml-1 text-emerald-600 dark:text-emerald-400">— labellisée CNP ✓</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-neutral-100 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Téléchargement…</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Télécharger PDF</span>
              </>
            )}
          </button>
          <a
            href={`/verify/${attestation.verification_code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 px-3 py-2.5"
            title="Page publique de vérification"
          >
            Vérifier
          </a>
        </div>

        <div className="text-[10px] text-gray-400 dark:text-neutral-500 font-mono pt-1">
          Code : {attestation.verification_code}
        </div>
      </div>
    </div>
  )
}
