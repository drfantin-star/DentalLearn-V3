'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, PenLine, Loader2, ShieldAlert } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { CsContentType } from '@/lib/cs/data'

interface Props {
  mode: 'primary' | 'cosign' | 'readonly'
  contentType: CsContentType
  contentId: string
  memberId: string | null
  validationId: string | null
  leadName: string | null
  amLead: boolean
}

export default function ValidateActions({
  mode,
  contentType,
  contentId,
  memberId,
  validationId,
  leadName,
  amLead,
}: Props) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  // Le user doit disposer d'une fiche cs_members active pour signer :
  // validated_by_lead / secondary référencent cs_members.id.
  if (!memberId) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <div className="flex items-center gap-2 text-gray-900 font-semibold mb-2">
          <ShieldAlert className="w-5 h-5 text-amber-600" />
          Signature indisponible
        </div>
        <p className="text-sm text-gray-600">
          Aucune fiche membre du Comité Scientifique active n&apos;est associée
          à votre compte. Contactez l&apos;administration pour être rattaché.
        </p>
      </div>
    )
  }

  if (mode === 'readonly') {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-5">
        <p className="text-sm text-gray-600">
          {amLead
            ? 'Vous êtes le validateur principal de ce contenu.'
            : 'Ce contenu dispose déjà de deux validateurs.'}
        </p>
      </div>
    )
  }

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    const supabase = createClient()

    try {
      if (mode === 'primary') {
        // Empreinte calculée au moment de la signature (source de vérité).
        const { data: hash, error: hashErr } = await supabase.rpc(
          'compute_content_hash',
          { p_content_type: contentType, p_content_id: contentId }
        )
        if (hashErr || !hash) {
          throw new Error(
            hashErr?.message ?? "Impossible de calculer l'empreinte du contenu."
          )
        }

        const { error: insErr } = await supabase
          .from('editorial_validations')
          .insert({
            content_type: contentType,
            content_id: contentId,
            content_hash: hash as string,
            validated_by_lead: memberId,
            comments: comment.trim() ? comment.trim() : null,
            is_current: true,
          })
        if (insErr) throw new Error(insErr.message)
      } else {
        // cosign
        if (!validationId) throw new Error('Validation cible introuvable.')
        const { error: rpcErr } = await supabase.rpc(
          'add_secondary_validation',
          {
            p_validation_id: validationId,
            p_comments: comment.trim() ? comment.trim() : null,
          }
        )
        if (rpcErr) throw new Error(rpcErr.message)
      }

      setDone(true)
      router.refresh()
      // Retour à la file après un court instant de confirmation.
      setTimeout(() => router.push('/cs'), 1200)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Une erreur est survenue.')
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex items-center gap-2 text-emerald-700 font-semibold">
          <CheckCircle2 className="w-5 h-5" />
          {mode === 'primary' ? 'Validation enregistrée' : 'Co-signature enregistrée'}
        </div>
        <p className="text-sm text-emerald-700/80 mt-1">
          Redirection vers la file d&apos;attente…
        </p>
      </div>
    )
  }

  const isCosign = mode === 'cosign'

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5">
      <h3 className="font-semibold text-gray-900 mb-1">
        {isCosign ? 'Co-signer la validation' : 'Valider ce contenu'}
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        {isCosign
          ? `Validé par ${leadName ?? 'un membre'}. Votre co-signature ajoute un second validateur distinct.`
          : 'Votre validation atteste que ce contenu a été relu et approuvé.'}
      </p>

      <label className="block text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
        Commentaire (facultatif)
      </label>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={3}
        className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary resize-none"
        placeholder="Remarque, réserve, précision…"
        disabled={submitting}
      />

      {error && (
        <p className="text-sm text-red-600 mt-3" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={submitting}
        className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-semibold px-4 py-3 transition-colors disabled:opacity-60"
      >
        {submitting ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : isCosign ? (
          <PenLine className="w-5 h-5" />
        ) : (
          <CheckCircle2 className="w-5 h-5" />
        )}
        {submitting
          ? 'Enregistrement…'
          : isCosign
            ? 'Co-signer'
            : 'Valider'}
      </button>
    </div>
  )
}
