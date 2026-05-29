'use client'

import { useEffect, useState } from 'react'
import { Download, HeartPulse } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { downloadBlob } from '@/lib/attestations/saveAttestation'
import {
  generateAttestationPDF,
  getAttestationFilename,
  type AutoevalParticipant,
} from '@/lib/autoeval/generateAttestationPDF'

/**
 * Carte de preuve Action B sur /profil : affiche la dernière auto-évaluation santé
 * réalisée et permet de RE-télécharger l'attestation (régénérée côté client à la
 * demande — aucun PDF stocké, aucune ligne user_attestations). Découplée du RadarCP.
 */
export default function AutoevalProofCard() {
  const [completedAt, setCompletedAt] = useState<string | null>(null)
  const [participant, setParticipant] = useState<AutoevalParticipant | null>(null)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: completion } = await supabase
        .from('autoeval_completions')
        .select('completed_at')
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled || !completion) return
      setCompletedAt(completion.completed_at)

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, rpps, profession')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      const last = (profile?.last_name ?? '').toUpperCase()
      const first = profile?.first_name ?? ''
      setParticipant({
        nom_complet: `Dr ${last} ${first}`.trim(),
        rpps: profile?.rpps ?? '',
        profession: profile?.profession ?? 'Chirurgien-dentiste',
      })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  // Pas d'auto-évaluation réalisée → on n'affiche rien.
  if (!completedAt) return null

  const handleDownload = async () => {
    if (!participant) return
    setGenerating(true)
    try {
      const blob = await generateAttestationPDF(participant, completedAt)
      downloadBlob(blob, getAttestationFilename())
    } finally {
      setGenerating(false)
    }
  }

  const dateLabel = new Date(completedAt).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      className="p-4"
      style={{ background: '#242424', border: '0.5px solid #333', borderRadius: '16px' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#EC4899]/15">
          <HeartPulse className="h-5 w-5 text-[#EC4899]" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-[#e5e5e5]">Auto-évaluation santé (Action B)</div>
          <div className="text-xs text-[#6b7280]">Dernière réalisation : {dateLabel}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleDownload}
        disabled={!participant || generating}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-[#EC4899] bg-[#EC4899]/10 py-2.5 text-xs font-bold text-[#EC4899] transition-opacity enabled:hover:opacity-90 disabled:opacity-40"
      >
        <Download size={15} />
        {generating ? 'Génération…' : "Retélécharger l'attestation"}
      </button>
    </div>
  )
}
