'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Download, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { downloadBlob } from '@/lib/attestations/saveAttestation'
import { aggregateResults, computeBlockRecap } from '@/lib/autoeval/scoring'
import { useAutoevalCompletion } from '@/lib/autoeval/useAutoevalCompletion'
import {
  generateAttestationPDF,
  getAttestationFilename,
  type AutoevalParticipant,
} from '@/lib/autoeval/generateAttestationPDF'
import { generateBilanPDF, getBilanFilename } from '@/lib/autoeval/generateBilanPDF'
import type { Answers, Questionnaire } from '@/lib/autoeval/types'
import ResourceCard from './ResourceCard'

interface Props {
  questionnaire: Questionnaire
  answers: Answers
}

/**
 * Synthèse finale (section 6). Marque la complétion UNE fois (preuve Action B),
 * propose le bilan (qui reste sur l'appareil) et l'attestation. Aucun résultat
 * n'est transmis : tout est calculé et rendu en PDF côté client.
 */
export default function AutoEvalSynthese({ questionnaire, answers }: Props) {
  const { markCompleted } = useAutoevalCompletion()
  const markedRef = useRef(false)
  const [participant, setParticipant] = useState<AutoevalParticipant | null>(null)
  const [generating, setGenerating] = useState<'bilan' | 'attestation' | null>(null)

  const completedAt = useMemo(() => new Date(), [])
  const results = useMemo(() => aggregateResults(questionnaire, answers), [questionnaire, answers])
  const blockRecaps = useMemo(
    () => questionnaire.blocks.map((b) => computeBlockRecap(b, answers, questionnaire.routing)),
    [questionnaire, answers]
  )

  // Complétion enregistrée une seule fois + récupération de l'identité (PDF).
  useEffect(() => {
    if (markedRef.current) return
    markedRef.current = true
    markCompleted(questionnaire.id)

    const supabase = createClient()
    async function loadParticipant() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, rpps, profession')
        .eq('id', user.id)
        .single()
      const last = (data?.last_name ?? '').toUpperCase()
      const first = data?.first_name ?? ''
      setParticipant({
        nom_complet: `Dr ${last} ${first}`.trim(),
        rpps: data?.rpps ?? '',
        profession: data?.profession ?? 'Chirurgien-dentiste',
      })
    }
    loadParticipant()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleBilan = async () => {
    if (!participant) return
    setGenerating('bilan')
    try {
      const blob = await generateBilanPDF({
        participant,
        completedAt,
        blocks: blockRecaps,
        results,
      })
      downloadBlob(blob, getBilanFilename())
    } finally {
      setGenerating(null)
    }
  }

  const handleAttestation = async () => {
    if (!participant) return
    setGenerating('attestation')
    try {
      const blob = await generateAttestationPDF(participant, completedAt)
      downloadBlob(blob, getAttestationFilename())
    } finally {
      setGenerating(null)
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      {/* Disclaimer */}
      <div className="rounded-2xl border border-[#333] bg-[#1a1a1a] p-4">
        <p className="text-xs italic leading-relaxed text-[#d4d4d4]">
          Ce bilan est un miroir, pas un diagnostic. Vos réponses ne sont pas conservées sur nos
          serveurs et ne sont partagées avec personne — ni Ordre, ni employeur.
        </p>
      </div>

      {/* Top 3 */}
      {results.topPreoccupations.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 text-base font-black text-white">Ce qui ressort</h3>
          <div className="space-y-2">
            {results.topPreoccupations.map((p, i) => (
              <div
                key={`${p.label}-${i}`}
                className="flex items-center gap-3 rounded-2xl border border-[#333] bg-[#1a1a1a] p-3.5"
              >
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-pink-500/15 text-sm font-bold text-pink-500">
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-white">{p.label}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Ressources */}
      {results.cards.length > 0 && (
        <section className="mt-6">
          <h3 className="mb-3 text-base font-black text-white">Ressources utiles</h3>
          <div className="space-y-3">
            {results.cards.map((card) => (
              <ResourceCard key={card.key} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* Clôture positive */}
      <p className="mt-6 rounded-2xl bg-gradient-to-br from-pink-500/15 to-violet-400/15 p-4 text-sm font-semibold leading-relaxed text-white">
        Prendre soin de soi est la première condition de soins de qualité. Vous venez de faire un
        pas — c'est déjà ça.
      </p>

      {/* Téléchargements */}
      <section className="mt-6 space-y-3">
        <div>
          <button
            type="button"
            onClick={handleBilan}
            disabled={!participant || generating !== null}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-pink-500 bg-pink-500/10 py-3.5 text-sm font-bold text-pink-500 transition-opacity enabled:hover:opacity-90 disabled:opacity-40"
          >
            <FileText size={18} />
            {generating === 'bilan' ? 'Génération…' : 'Télécharger mon bilan'}
          </button>
          <p className="mt-1.5 flex items-start gap-1.5 px-1 text-[11px] leading-relaxed text-[#9ca3af]">
            <AlertCircle size={13} className="mt-0.5 flex-shrink-0 text-amber-400" />
            Ce bilan n'est pas conservé. Téléchargez-le maintenant si vous le souhaitez — vous ne
            pourrez pas le récupérer plus tard.
          </p>
        </div>

        <button
          type="button"
          onClick={handleAttestation}
          disabled={!participant || generating !== null}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-pink-500 py-3.5 text-sm font-bold text-white transition-opacity enabled:hover:opacity-90 disabled:opacity-40"
        >
          <Download size={18} />
          {generating === 'attestation' ? 'Génération…' : 'Télécharger mon attestation'}
        </button>
        <p className="px-1 text-[11px] leading-relaxed text-[#9ca3af]">
          Votre attestation de réalisation reste retéléchargeable depuis votre profil.
        </p>
      </section>
    </div>
  )
}
