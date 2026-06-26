'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Award, Loader2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { generateFormationPDF, getFormationPDFFilename } from '@/lib/attestations/generateFormationPDF'
import { generateEppPDF, getEppPDFFilename } from '@/lib/attestations/generateEppPDF'
import { saveAttestation, generateVerificationCode, downloadBlob } from '@/lib/attestations/saveAttestation'
import { TYPE_CNP_BY_AXE, type AttestationOrganisme } from '@/lib/attestations/types'
import { SatisfactionSurveyModal } from './SatisfactionSurveyModal'

interface Props {
  type: 'formation_online' | 'epp'
  sourceId: string
  label?: string
  className?: string
  onGenerated?: (attestationId: string) => void
}

export function GenerateAttestationButton({
  type,
  sourceId,
  label,
  className,
  onGenerated,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rppsMissing, setRppsMissing] = useState(false)
  const [showSurveyModal, setShowSurveyModal] = useState(false)
  const [surveyContext, setSurveyContext] = useState<{ formationTitle: string } | null>(null)
  // Condition d'acquisition 100 % (PARTIE_A_v4 §4.3) — formations CP uniquement.
  const [acqGate, setAcqGate] = useState<{ ok: boolean; remaining: number } | null>(null)
  const router = useRouter()

  // Pré-calcul du verrou d'acquisition : on désactive le bouton tant que
  // toutes les questions de la formation CP ne sont pas acquises.
  useEffect(() => {
    if (type !== 'formation_online') {
      setAcqGate({ ok: true, remaining: 0 })
      return
    }
    let active = true
    ;(async () => {
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data: formationRow } = await supabase
          .from('formations')
          .select('axe_cp')
          .eq('id', sourceId)
          .single()
        // Hors périmètre CP : pas de condition d'acquisition.
        if (formationRow?.axe_cp == null) {
          if (active) setAcqGate({ ok: true, remaining: 0 })
          return
        }
        const { data: blocs } = await supabase.rpc('get_bloc_acquisition_status', {
          p_user_id: user.id,
          p_formation_id: sourceId,
        })
        const rows = (blocs ?? []) as { total_questions: number; acquired_questions: number }[]
        const total = rows.reduce((s, b) => s + b.total_questions, 0)
        const acquired = rows.reduce((s, b) => s + b.acquired_questions, 0)
        if (active) setAcqGate({ ok: acquired >= total, remaining: Math.max(0, total - acquired) })
      } catch (err) {
        console.error('acquisition gate error:', err)
        // fail open : handleClick re-vérifie et bloque si besoin.
        if (active) setAcqGate({ ok: true, remaining: 0 })
      }
    })()
    return () => {
      active = false
    }
  }, [type, sourceId])

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    setRppsMissing(false)

    try {
      const supabase = createClient()

      // 1. Auth + profil
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) throw new Error('Non authentifié')

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name, last_name, rpps, profession')
        .eq('id', user.id)
        .single()

      if (!profile) throw new Error('Profil introuvable')

      if (!profile.rpps || profile.rpps.trim() === '') {
        setRppsMissing(true)
        return
      }

      const participant = {
        nom_complet: `Dr ${(profile.last_name || '').toUpperCase()} ${profile.first_name || ''}`.trim(),
        rpps: profile.rpps,
        profession: profile.profession || 'Chirurgien-dentiste',
      }

      // 2. Vérifier qu'une attestation n'existe pas déjà
      const { data: existing } = await supabase
        .from('user_attestations')
        .select('id, pdf_path')
        .eq('user_id', user.id)
        .eq('type', type)
        .eq('source_id', sourceId)
        .maybeSingle()

      if (existing) {
        onGenerated?.(existing.id)
        router.push('/ma-certif/attestations')
        return
      }

      // 2bis. Gating questionnaire de satisfaction (Qualiopi #30) — uniquement formation_online
      if (type === 'formation_online') {
        const { data: hasCompleted, error: rpcErr } = await supabase.rpc(
          'has_user_completed_satisfaction',
          { p_formation_id: sourceId }
        )
        if (rpcErr) {
          console.error('has_user_completed_satisfaction error:', rpcErr)
          // fail open : on ouvre la modal pour ne pas bloquer en cas d'erreur RPC
        }
        if (!hasCompleted) {
          const { data: formationRow } = await supabase
            .from('formations')
            .select('title')
            .eq('id', sourceId)
            .single()
          setSurveyContext({ formationTitle: formationRow?.title || 'Formation' })
          setShowSurveyModal(true)
          setLoading(false)
          return
        }
      }

      // 3. Générer le PDF selon le type
      const verificationCode = generateVerificationCode()
      let blob: Blob
      let filename: string
      let metadata: Parameters<typeof saveAttestation>[0]['metadata']

      // T7 — Calcul organisme dynamique selon contexte user × formation.
      // Pour les EPP, on passe formation_id = null (politique V1 : EPP = Dentalschool).
      const organismeFormationId = type === 'formation_online' ? sourceId : null
      const [organismeName, organismeQualiopi, organismeOdpc] = await Promise.all([
        supabase.rpc('attestation_organisme_for', {
          p_user_id: user.id,
          p_formation_id: organismeFormationId,
        }),
        supabase.rpc('attestation_qualiopi_for', {
          p_user_id: user.id,
          p_formation_id: organismeFormationId,
        }),
        supabase.rpc('attestation_odpc_for', {
          p_user_id: user.id,
          p_formation_id: organismeFormationId,
        }),
      ])
      if (organismeName.error) throw new Error(`RPC organisme : ${organismeName.error.message}`)
      const organisme: AttestationOrganisme = {
        nom: (organismeName.data as string | null) ?? 'EROJU SAS — Dentalschool',
        qualiopi: (organismeQualiopi.data as string | null) ?? null,
        odpc: (organismeOdpc.data as string | null) ?? null,
      }

      if (type === 'formation_online') {
        // Vérifier complétion 100 % via RPC
        const { data: isComplete } = await supabase.rpc('is_formation_fully_completed', {
          p_user_id: user.id,
          p_formation_id: sourceId,
        })
        if (!isComplete) {
          throw new Error('La formation doit être complétée à 100 % pour générer l\'attestation')
        }

        // Récupérer les métriques
        const { data: metrics, error: metricsErr } = await supabase
          .rpc('get_formation_completion_metrics', {
            p_user_id: user.id,
            p_formation_id: sourceId,
          })
          .single()
        if (metricsErr || !metrics) throw new Error('Erreur récupération métriques')
        const m = metrics as any

        // Récupérer la formation
        const { data: formation } = await supabase
          .from('formations')
          .select('title, slug, axe_cp, instructor_name, cp_hours')
          .eq('id', sourceId)
          .single()
        if (!formation) throw new Error('Formation introuvable')

        // Condition d'acquisition 100 % (PARTIE_A_v4 §2.4 Niveau 3 / §4.3) —
        // formations CP uniquement. Bloque la génération tant que toutes les
        // questions ne sont pas acquises.
        let acquisition: { acquired: number; total: number } | undefined
        if (formation.axe_cp != null) {
          const { data: blocs } = await supabase.rpc('get_bloc_acquisition_status', {
            p_user_id: user.id,
            p_formation_id: sourceId,
          })
          const rows = (blocs ?? []) as { total_questions: number; acquired_questions: number }[]
          const total = rows.reduce((s, b) => s + b.total_questions, 0)
          const acquired = rows.reduce((s, b) => s + b.acquired_questions, 0)
          if (acquired < total) {
            throw new Error(
              `${total - acquired} question(s) restent à acquérir avant de générer votre attestation.`
            )
          }
          acquisition = { acquired, total }
        }

        const dureeHeures = formation.cp_hours || 6
        const typeCnp = TYPE_CNP_BY_AXE[formation.axe_cp || 1] || 'D'

        blob = await generateFormationPDF({
          participant,
          formation: {
            id: sourceId,
            title: formation.title,
            axe_cp: formation.axe_cp,
            type_cnp: typeCnp,
            formateur: formation.instructor_name || 'Dr Julie Fantin',
            slug: formation.slug,
          },
          parcours: {
            started_at: m.started_at,
            completed_at: m.completed_at,
            duree_heures: dureeHeures,
            nb_sequences: m.nb_sequences_done,
            nb_sequences_total: m.nb_sequences_total,
            taux_reussite_quiz: Number(m.taux_reussite_quiz || 0),
            taux_completion: Number(m.taux_completion || 0),
          },
          acquisition,
          verification_code: verificationCode,
          organisme,
        })

        filename = getFormationPDFFilename(formation.slug)
        metadata = {
          title: formation.title,
          axe_cp: formation.axe_cp,
          type_action_cnp: typeCnp,
          formateur: formation.instructor_name || undefined,
          started_at: m.started_at,
          completed_at: m.completed_at,
          duree_heures: dureeHeures,
          nb_sequences: m.nb_sequences_done,
          nb_sequences_total: m.nb_sequences_total,
          taux_reussite_quiz: Number(m.taux_reussite_quiz || 0),
          taux_completion: Number(m.taux_completion || 0),
        }
      } else {
        // EPP
        const { data: eppMetrics, error: eppErr } = await supabase
          .rpc('get_epp_attestation_metrics', {
            p_user_id: user.id,
            p_audit_id: sourceId,
          })
          .single()
        if (eppErr || !eppMetrics) throw new Error('Erreur récupération métriques EPP')
        const e = eppMetrics as any

        if (!e.is_ready) {
          throw new Error('Les Tours 1 et 2 doivent être complétés pour générer l\'attestation EPP')
        }

        // Récupérer l'audit pour avoir le slug
        const { data: audit } = await supabase
          .from('epp_audits')
          .select('slug, theme_slug')
          .eq('id', sourceId)
          .single()
        if (!audit) throw new Error('Audit EPP introuvable')

        blob = await generateEppPDF({
          participant,
          audit: {
            id: sourceId,
            title: e.audit_title,
            theme_slug: audit.theme_slug,
            slug: audit.slug,
          },
          tours: {
            t1_completed_at: e.t1_completed_at,
            t1_nb_dossiers: e.t1_nb_dossiers,
            t1_score: Number(e.t1_score),
            t2_completed_at: e.t2_completed_at,
            t2_nb_dossiers: e.t2_nb_dossiers,
            t2_score: Number(e.t2_score),
            delta_score: Number(e.delta_score),
          },
          verification_code: verificationCode,
          organisme,
        })

        filename = getEppPDFFilename(audit.slug)
        metadata = {
          title: e.audit_title,
          axe_cp: 2,
          type_action_cnp: 'B',
          completed_at: e.t2_completed_at,
          duree_heures: Number(e.duree_forfaitaire || 6),
          duree_breakdown: e.duree_breakdown || undefined,
          score_t1: Number(e.t1_score),
          score_t2: Number(e.t2_score),
          delta_score: Number(e.delta_score),
          nb_dossiers_t1: e.t1_nb_dossiers,
          nb_dossiers_t2: e.t2_nb_dossiers,
        }
      }

      // 4. Upload Storage + insert DB
      const { attestationId } = await saveAttestation({
        userId: user.id,
        type,
        sourceId,
        blob,
        verificationCode,
        metadata,
      })

      // 5. Téléchargement immédiat
      downloadBlob(blob, filename)

      // 6. Redirection
      onGenerated?.(attestationId)
      setTimeout(() => router.push('/ma-certif/attestations'), 800)
    } catch (err: any) {
      console.error('Erreur génération attestation :', err)
      setError(err.message || 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  if (rppsMissing) {
    return (
      <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4 space-y-3">
        <div className="flex items-start gap-2 text-amber-300">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold">N° RPPS requis</p>
            <p className="text-xs text-amber-200/80 mt-1">
              Votre numéro RPPS est nécessaire pour générer votre attestation officielle.
              Complétez votre profil pour continuer.
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/profil/edit')}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          Compléter mon profil
        </button>
      </div>
    )
  }

  const acquisitionBlocked = !!acqGate && !acqGate.ok

  return (
    <div className="space-y-2">
      <button
        onClick={handleClick}
        disabled={loading || acquisitionBlocked}
        className={
          className ??
          'w-full flex items-center justify-center gap-2 bg-white text-[#0a0a0a] hover:bg-[#e5e5e5] px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
        }
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Génération du PDF…</span>
          </>
        ) : (
          <>
            <Award className="w-4 h-4" />
            <span>{label ?? 'Obtenir mon attestation'}</span>
          </>
        )}
      </button>
      {acquisitionBlocked && (
        <p className="text-xs text-amber-400 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {acqGate!.remaining} question{acqGate!.remaining > 1 ? 's' : ''} reste{acqGate!.remaining > 1 ? 'nt' : ''} à acquérir avant de générer votre attestation.
        </p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}

      {showSurveyModal && surveyContext && type === 'formation_online' && (
        <SatisfactionSurveyModal
          isOpen={showSurveyModal}
          formationId={sourceId}
          formationTitle={surveyContext.formationTitle}
          onClose={() => setShowSurveyModal(false)}
          onSubmitted={() => {
            setShowSurveyModal(false)
            // Relance la génération maintenant que la satisfaction est enregistrée
            handleClick()
          }}
        />
      )}
    </div>
  )
}
