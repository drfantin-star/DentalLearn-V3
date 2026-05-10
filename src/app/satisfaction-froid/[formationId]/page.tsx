'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Star,
  Check,
  X,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  AlertCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ImpactKey =
  | 'protocols'
  | 'materials'
  | 'patient_communication'
  | 'clinical_confidence'
  | 'no_change'
  | 'other'

const IMPACT_OPTIONS: Array<{ key: ImpactKey; label: string }> = [
  { key: 'protocols', label: 'Modification de protocoles' },
  { key: 'materials', label: 'Changement de matériel / produits' },
  { key: 'patient_communication', label: 'Meilleure communication patient' },
  { key: 'clinical_confidence', label: 'Gain de confiance clinique' },
  { key: 'no_change', label: 'Aucun changement notable' },
  { key: 'other', label: 'Autre' },
]

type Status =
  | { kind: 'loading' }
  | { kind: 'unauthenticated' }
  | { kind: 'not_eligible' }
  | { kind: 'already_replied' }
  | { kind: 'ready'; sourceSurveyId: string; formationTitle: string }
  | { kind: 'submitted' }
  | { kind: 'error'; message: string }

function StarRating({
  value,
  onChange,
  ariaLabelPrefix,
}: {
  value: number
  onChange: (v: number) => void
  ariaLabelPrefix: string
}) {
  const [hover, setHover] = useState(0)
  const display = hover || value
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= display
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${ariaLabelPrefix} : ${n} sur 5`}
            className="p-1.5 rounded-lg transition-transform active:scale-90 hover:scale-110"
          >
            <Star
              size={32}
              className={filled ? 'text-amber-400' : 'text-[#3a3a3a]'}
              fill={filled ? 'currentColor' : 'none'}
              strokeWidth={1.75}
            />
          </button>
        )
      })}
    </div>
  )
}

export default function ColdSurveyPage() {
  const params = useParams<{ formationId: string }>()
  const formationId = params?.formationId
  const router = useRouter()

  const [status, setStatus] = useState<Status>({ kind: 'loading' })

  // Form state
  const [appliedRating, setAppliedRating] = useState(0)
  const [selectedImpacts, setSelectedImpacts] = useState<ImpactKey[]>([])
  const [otherText, setOtherText] = useState('')
  const [stillRecommend, setStillRecommend] = useState<boolean | null>(null)
  const [desiredTopic, setDesiredTopic] = useState('')
  const [freeComment, setFreeComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showValidationError, setShowValidationError] = useState(false)

  useEffect(() => {
    if (!formationId) return
    const load = async () => {
      try {
        const supabase = createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
          setStatus({ kind: 'unauthenticated' })
          return
        }

        const { data: eligibility, error: eligErr } = await supabase
          .rpc('check_cold_survey_eligibility', { p_formation_id: formationId })
          .single()

        if (eligErr) throw eligErr

        const e = eligibility as {
          is_eligible: boolean
          has_already_replied: boolean
          cold_survey_due_at: string | null
        } | null

        if (e?.has_already_replied) {
          setStatus({ kind: 'already_replied' })
          return
        }

        if (!e?.is_eligible) {
          setStatus({ kind: 'not_eligible' })
          return
        }

        // Récupère l'id de la satisfaction à chaud (RLS = own row)
        // + le titre de la formation pour l'affichage.
        const [{ data: parentSurvey }, { data: formationRow }] = await Promise.all([
          supabase
            .from('satisfaction_surveys')
            .select('id')
            .eq('user_id', user.id)
            .eq('formation_id', formationId)
            .maybeSingle(),
          supabase
            .from('formations')
            .select('title')
            .eq('id', formationId)
            .maybeSingle(),
        ])

        if (!parentSurvey) {
          setStatus({ kind: 'not_eligible' })
          return
        }

        setStatus({
          kind: 'ready',
          sourceSurveyId: parentSurvey.id as string,
          formationTitle: (formationRow?.title as string) || 'Formation',
        })
      } catch (err: any) {
        console.error('Cold survey load error:', err)
        setStatus({
          kind: 'error',
          message: err.message || 'Erreur de chargement',
        })
      }
    }
    load()
  }, [formationId])

  const otherChecked = selectedImpacts.includes('other')

  const formValid = useMemo(() => {
    if (appliedRating < 1 || appliedRating > 5) return false
    if (selectedImpacts.length === 0) return false
    if (otherChecked && otherText.trim() === '') return false
    if (stillRecommend === null) return false
    return true
  }, [appliedRating, selectedImpacts, otherChecked, otherText, stillRecommend])

  const toggleImpact = (key: ImpactKey) => {
    setSelectedImpacts((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    )
  }

  const handleSubmit = async () => {
    if (!formValid) {
      setShowValidationError(true)
      return
    }
    if (status.kind !== 'ready' || !formationId) return

    setSubmitting(true)
    setSubmitError(null)
    setShowValidationError(false)

    try {
      const supabase = createClient()
      const { data: { user }, error: authErr } = await supabase.auth.getUser()
      if (authErr || !user) {
        setStatus({ kind: 'unauthenticated' })
        return
      }

      const { error: insertErr } = await supabase.from('cold_surveys').insert({
        user_id: user.id,
        formation_id: formationId,
        source_survey_id: status.sourceSurveyId,
        applied_in_practice: appliedRating,
        practice_impacts: selectedImpacts,
        practice_impacts_other: otherChecked ? otherText.trim() || null : null,
        still_recommend: stillRecommend,
        desired_topic: desiredTopic.trim() || null,
        free_comment: freeComment.trim() || null,
      })

      if (insertErr) {
        if (insertErr.code === '23505') {
          // Déjà répondu — comportement idempotent.
          setStatus({ kind: 'submitted' })
          return
        }
        throw insertErr
      }

      setStatus({ kind: 'submitted' })
    } catch (err: any) {
      console.error('Cold survey submit error:', err)
      setSubmitError(err.message || 'Erreur lors de l\'enregistrement')
    } finally {
      setSubmitting(false)
    }
  }

  // ----- Renders selon status -----

  if (status.kind === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#a78bfa]" />
      </div>
    )
  }

  if (status.kind === 'unauthenticated') {
    if (typeof window !== 'undefined' && formationId) {
      router.replace(`/login?redirect=/satisfaction-froid/${formationId}`)
    }
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <Loader2 className="w-8 h-8 animate-spin text-[#a78bfa]" />
      </div>
    )
  }

  if (status.kind === 'error') {
    return (
      <CenteredCard>
        <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2" style={{ color: '#e5e5e5' }}>Une erreur est survenue</h1>
        <p className="text-sm mb-5" style={{ color: '#a3a3a3' }}>{status.message}</p>
        <BackHomeLink />
      </CenteredCard>
    )
  }

  if (status.kind === 'not_eligible') {
    return (
      <CenteredCard>
        <AlertCircle className="w-10 h-10 text-amber-400 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2" style={{ color: '#e5e5e5' }}>
          Cette formation n'est pas dans votre parcours
        </h1>
        <p className="text-sm mb-5" style={{ color: '#a3a3a3' }}>
          Le questionnaire à froid n'est disponible que pour les formations que vous avez terminées et évaluées il y a plus de 3 mois.
        </p>
        <BackHomeLink />
      </CenteredCard>
    )
  }

  if (status.kind === 'already_replied') {
    return (
      <CenteredCard>
        <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2" style={{ color: '#e5e5e5' }}>Merci, déjà répondu !</h1>
        <p className="text-sm mb-5" style={{ color: '#a3a3a3' }}>
          Votre retour à froid a déjà été enregistré pour cette formation.
        </p>
        <BackHomeLink />
      </CenteredCard>
    )
  }

  if (status.kind === 'submitted') {
    return (
      <CenteredCard>
        <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
        <h1 className="text-xl font-bold mb-2" style={{ color: '#e5e5e5' }}>Merci pour votre retour !</h1>
        <p className="text-sm mb-5" style={{ color: '#a3a3a3' }}>
          Vos réponses nous aident à améliorer continuellement DentalLearn.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-white text-[#0a0a0a] hover:bg-[#e5e5e5] px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          Retour à mes formations
        </Link>
      </CenteredCard>
    )
  }

  // status.kind === 'ready'
  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 sm:py-10" style={{ background: '#0a0a0a' }}>
      <div className="max-w-2xl mx-auto space-y-6">
        <header className="space-y-1">
          <p className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#a78bfa' }}>
            Retour à froid · 3 mois après
          </p>
          <h1 className="text-2xl font-bold" style={{ color: '#e5e5e5' }}>
            {status.formationTitle}
          </h1>
          <p className="text-sm" style={{ color: '#a3a3a3' }}>
            5 questions rapides pour mesurer l'impact réel de la formation sur votre pratique.
          </p>
        </header>

        {/* Q1 — Application */}
        <section className="rounded-2xl p-5 space-y-3" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <div>
            <h2 className="text-base font-semibold" style={{ color: '#e5e5e5' }}>
              Avez-vous appliqué dans votre pratique ce que vous avez appris ?
            </h2>
            <p className="text-xs mt-1" style={{ color: '#737373' }}>
              1 = pas du tout · 5 = systématiquement
            </p>
          </div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <StarRating
              value={appliedRating}
              onChange={setAppliedRating}
              ariaLabelPrefix="Application en pratique"
            />
            <span className="text-xs" style={{ color: '#a3a3a3' }}>
              {appliedRating > 0 ? `${appliedRating}/5` : 'Non noté'}
            </span>
          </div>
        </section>

        {/* Q2 — Impacts */}
        <section className="rounded-2xl p-5 space-y-3" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e5e5e5' }}>
            Quel impact concret cette formation a-t-elle eu sur votre pratique ?
          </h2>
          <p className="text-xs" style={{ color: '#737373' }}>
            Plusieurs réponses possibles (au moins 1).
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {IMPACT_OPTIONS.map((opt) => {
              const checked = selectedImpacts.includes(opt.key)
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => toggleImpact(opt.key)}
                  aria-pressed={checked}
                  className="text-left p-3 rounded-xl border-2 flex items-center gap-3 transition-all active:scale-[0.99]"
                  style={
                    checked
                      ? { background: 'rgba(45,27,150,0.25)', borderColor: '#7c5cff', color: '#e5e5e5' }
                      : { background: '#0a0a0a', borderColor: '#2a2a2a', color: '#a3a3a3' }
                  }
                >
                  <span
                    className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                    style={
                      checked
                        ? { background: '#7c5cff', color: '#0a0a0a' }
                        : { border: '1.5px solid #3a3a3a' }
                    }
                  >
                    {checked && <Check size={14} strokeWidth={3} />}
                  </span>
                  <span className="text-sm">{opt.label}</span>
                </button>
              )
            })}
          </div>
          {otherChecked && (
            <textarea
              value={otherText}
              onChange={(e) => setOtherText(e.target.value)}
              placeholder="Précisez l'autre impact…"
              rows={2}
              className="w-full px-3 py-2 rounded-xl text-sm resize-y outline-none focus:ring-2 focus:ring-[#7c5cff]"
              style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
            />
          )}
        </section>

        {/* Q3 — Recommend */}
        <section className="rounded-2xl p-5 space-y-3" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <h2 className="text-base font-semibold" style={{ color: '#e5e5e5' }}>
            Recommanderiez-vous toujours DentalLearn 3 mois après ?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStillRecommend(true)}
              aria-pressed={stillRecommend === true}
              className="h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
              style={
                stillRecommend === true
                  ? { background: 'rgba(6,78,59,0.4)', borderColor: '#059669', color: '#10b981' }
                  : { background: '#0a0a0a', borderColor: '#2a2a2a', color: '#a3a3a3' }
              }
            >
              <Check size={22} />
              <span className="text-base font-bold">Oui</span>
            </button>
            <button
              type="button"
              onClick={() => setStillRecommend(false)}
              aria-pressed={stillRecommend === false}
              className="h-20 rounded-2xl border-2 flex flex-col items-center justify-center gap-1 transition-all active:scale-95"
              style={
                stillRecommend === false
                  ? { background: 'rgba(69,10,10,0.4)', borderColor: '#ef4444', color: '#f87171' }
                  : { background: '#0a0a0a', borderColor: '#2a2a2a', color: '#a3a3a3' }
              }
            >
              <X size={22} />
              <span className="text-base font-bold">Non</span>
            </button>
          </div>
        </section>

        {/* Q4 — Desired topic */}
        <section className="rounded-2xl p-5 space-y-2" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <label className="text-base font-semibold block" style={{ color: '#e5e5e5' }}>
            Quel sujet souhaiteriez-vous voir traité prochainement ?
            <span className="text-xs font-normal ml-1" style={{ color: '#737373' }}>(optionnel)</span>
          </label>
          <textarea
            value={desiredTopic}
            onChange={(e) => setDesiredTopic(e.target.value)}
            placeholder="Une thématique, une indication, un cas clinique…"
            rows={2}
            className="w-full px-3 py-2 rounded-xl text-sm resize-y outline-none focus:ring-2 focus:ring-[#7c5cff]"
            style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
          />
        </section>

        {/* Q5 — Free comment */}
        <section className="rounded-2xl p-5 space-y-2" style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}>
          <label className="text-base font-semibold block" style={{ color: '#e5e5e5' }}>
            Verbatim libre
            <span className="text-xs font-normal ml-1" style={{ color: '#737373' }}>(optionnel)</span>
          </label>
          <textarea
            value={freeComment}
            onChange={(e) => setFreeComment(e.target.value)}
            placeholder="Tout retour libre que vous souhaitez partager…"
            rows={3}
            className="w-full px-3 py-2 rounded-xl text-sm resize-y outline-none focus:ring-2 focus:ring-[#7c5cff]"
            style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', color: '#e5e5e5' }}
          />
        </section>

        {showValidationError && !formValid && (
          <p className="text-red-400 text-sm">
            Merci de répondre aux questions obligatoires (note d'application, au moins un impact, recommandation).
            {otherChecked && otherText.trim() === '' && ' Précisez l\'autre impact.'}
          </p>
        )}
        {submitError && <p className="text-red-400 text-sm">{submitError}</p>}

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold border"
            style={{ borderColor: '#2a2a2a', color: '#a3a3a3' }}
          >
            <ArrowLeft size={14} />
            Plus tard
          </Link>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 inline-flex items-center justify-center gap-2 bg-white text-[#0a0a0a] hover:bg-[#e5e5e5] px-4 py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Enregistrement…
              </>
            ) : (
              'Envoyer mes réponses'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

function CenteredCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen px-4 flex items-center justify-center" style={{ background: '#0a0a0a' }}>
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{ background: '#1a1a1a', border: '1px solid #2a2a2a' }}
      >
        {children}
      </div>
    </div>
  )
}

function BackHomeLink() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2 bg-white text-[#0a0a0a] hover:bg-[#e5e5e5] px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
    >
      Retour à mes formations
    </Link>
  )
}
