'use client'

import { useState } from 'react'
import { Download, Shield, ShieldCheck, Calendar, Clock, Award, TrendingUp, FileText, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { axeBannerStyle } from '@/lib/cp/axeColors'
import type { UserAttestation } from '@/lib/hooks/useUserAttestations'

interface AttestationCardProps {
  attestation: UserAttestation
  /** 'compact' : utilisé dans un EppAuditGroupCard, masque le bandeau/titre déjà affichés au niveau du groupe. */
  variant?: 'standalone' | 'compact'
}

const AXE_LABELS: Record<number, string> = {
  1: 'Axe 1 — Connaissances',
  2: 'Axe 2 — Qualite',
  3: 'Axe 3 — Relation patient',
  4: 'Axe 4 — Sante praticien',
}

export function AttestationCard({ attestation, variant = 'standalone' }: AttestationCardProps) {
  const [downloading, setDownloading] = useState(false)
  const isCompact = variant === 'compact'

  const isFormation = attestation.type === 'formation_online'
  const isEpp = attestation.type === 'epp'
  const isActionF = attestation.type === 'action_cnp_info_patient'
  const nbRessources =
    isActionF && typeof attestation.metadata?.nb_ressources === 'number'
      ? (attestation.metadata.nb_ressources as number)
      : null
  const axeBannerBg = axeBannerStyle(attestation.axe_cp)
  const axeLabel = attestation.axe_cp ? AXE_LABELS[attestation.axe_cp] : null

  const handleDownload = async () => {
    if (!attestation.pdf_path) {
      alert("L'attestation PDF est en cours de generation. Merci de revenir dans quelques instants.")
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
      alert('Impossible de telecharger le PDF. Veuillez reessayer.')
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

  const cardClass = isCompact
    ? 'transition-premium'
    : 'glass-card transition-premium rounded-2xl overflow-hidden'

  return (
    <div className={cardClass}>
      {/* Header colore selon axe (style inline : derive de la palette CP) — masque en mode compact, redondant avec l'en-tete du groupe */}
      {!isCompact && (
        <div className="px-4 py-3" style={{ backgroundImage: axeBannerBg }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white">
              {isFormation ? (
                <Award className="w-4 h-4" />
              ) : isActionF ? (
                <ShieldCheck className="w-4 h-4" />
              ) : (
                <Shield className="w-4 h-4" />
              )}
              <span className="text-xs font-semibold uppercase tracking-wide">
                {isFormation
                  ? 'Formation en ligne'
                  : isActionF
                    ? "Demarche d'information patient"
                    : 'Audit EPP'}
              </span>
            </div>
            {axeLabel && (
              <span className="text-xs text-white/90 font-medium">
                {axeLabel}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Corps */}
      <div className={isCompact ? 'p-3 space-y-2' : 'p-4 space-y-3'}>
        <div>
          <h3 className={isCompact ? 'text-xs font-semibold uppercase tracking-wide text-white/55' : 'font-bold text-white text-[15px] leading-tight'}>
            {isCompact ? 'Attestation' : attestation.title}
          </h3>
          {!isCompact && attestation.formateur && (
            <p className="text-xs text-white/55 mt-0.5">
              {attestation.formateur}
            </p>
          )}
        </div>

        {/* Metriques selon type */}
        <div className="flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1 text-white/70">
            <Calendar className="w-3.5 h-3.5" />
            <span>{formatDate(attestation.completed_at)}</span>
          </div>
          {attestation.duree_heures && (
            <div className="flex items-center gap-1 text-white/70">
              <Clock className="w-3.5 h-3.5" />
              <span>{attestation.duree_heures}h</span>
            </div>
          )}
          {isFormation && attestation.taux_reussite_quiz !== null && (
            <div className="flex items-center gap-1 text-emerald-400 font-medium">
              <Award className="w-3.5 h-3.5" />
              <span>{attestation.taux_reussite_quiz}% de reussite</span>
            </div>
          )}
          {isEpp && attestation.delta_score !== null && (
            <div className="flex items-center gap-1 text-emerald-400 font-medium">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>
                T1 {attestation.score_t1}% → T2 {attestation.score_t2}% (+{attestation.delta_score}pts)
              </span>
            </div>
          )}
          {isActionF && nbRessources !== null && (
            <div className="flex items-center gap-1 text-white/70">
              <FileText className="w-3.5 h-3.5" />
              <span>
                {nbRessources} ressource{nbRessources > 1 ? 's' : ''} attestee
                {nbRessources > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>

        {/* Label CNP si applicable */}
        {attestation.type_action_cnp && (
          <div className="text-xs text-white/55">
            <span className="font-medium">
              {isActionF ? 'Action F' : `Type ${attestation.type_action_cnp}`}
            </span>
            {!isActionF && attestation.cnp_labellisation === 'en_cours' && (
              <span className="ml-1 italic">— labellisation CNP en cours</span>
            )}
            {attestation.cnp_labellisation === 'labellisee' && (
              <span className="ml-1 text-emerald-400">— labellisee CNP ✓</span>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 bg-white text-gray-900 hover:bg-neutral-100 px-4 py-2.5 rounded-xl text-sm font-semibold transition-premium disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Telechargement…</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Telecharger PDF</span>
              </>
            )}
          </button>
          <a
            href={`/verify/${attestation.verification_code}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/55 hover:text-white/90 px-3 py-2.5 transition-premium"
            title="Page publique de verification"
          >
            Verifier
          </a>
        </div>

        <div className="text-[10px] text-white/40 font-mono pt-1">
          Code : {attestation.verification_code}
        </div>
      </div>
    </div>
  )
}
