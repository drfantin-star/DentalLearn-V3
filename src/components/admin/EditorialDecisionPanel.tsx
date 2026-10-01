'use client'

// Décision éditoriale d'une synthèse news, directement sur sa page de détail.
//
// Pourquoi ici plutôt que seulement dans /admin/editorial-validations : la
// décision suppose d'avoir LU la synthèse. Un écran de liste force à ouvrir,
// lire, revenir, retrouver la ligne, puis cliquer — l'aller-retour décourage
// la relecture, qui est justement le seul moment où le jugement éditorial se
// fait. Ici, le panneau est à côté du texte qu'il juge.
//
// Trois mécanismes distincts sont réunis, et il faut les garder distincts :
//   - VALIDER / RÉVOQUER passent par editorial_validations (RPC
//     validate_content / revoke_validation). C'est la traçabilité Qualiopi :
//     qui a validé, quand, avec quel membre du comité scientifique.
//   - REJETER / RÉTABLIR passent par news_syntheses.status (RPC
//     reject_news_syntheses / restore_news_syntheses, cf. 20260924a). Ce n'est
//     pas une validation négative : la synthèse quitte toutes les surfaces de
//     lecture, qui filtrent déjà status='active'.
//   - « Stale » signifie que le contenu a été modifié APRÈS sa validation
//     (comparaison de hash côté RPC). Ce n'est ni validé ni rejeté.

import { useState } from 'react'
import {
  ShieldCheck,
  Ban,
  RotateCcw,
  AlertTriangle,
  Loader2,
  X,
  Trash2,
  CheckCircle2,
} from 'lucide-react'
import {
  useCsMembers,
  useRejectSyntheses,
  useRestoreSyntheses,
  useRevokeValidation,
  useValidateContent,
  useValidationStatus,
} from '@/lib/hooks/useEditorialValidations'
import {
  REJECTION_REASONS,
  rejectionReasonLabel,
  type RejectionReason,
} from '@/types/editorialValidations'

const CARD = 'bg-white rounded-2xl shadow-sm border border-gray-200 p-6'

function formatDateFr(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

interface Props {
  synthesisId: string
  /** news_syntheses.status — 'active', 'rejected', 'failed'… */
  status: string
  isEditoriallyValidated: boolean
  rejectionReason: string | null
  rejectedAt: string | null
  /** Recharge les données de la page après une décision. */
  onChanged: () => void
}

export default function EditorialDecisionPanel({
  synthesisId,
  status,
  isEditoriallyValidated,
  rejectionReason,
  rejectedAt,
  onChanged,
}: Props) {
  const {
    status: validation,
    loading: statusLoading,
    refetch: refetchStatus,
  } = useValidationStatus('news_synthesis', synthesisId)
  const { members } = useCsMembers({ activeOnly: true })

  const { validate, loading: validating } = useValidateContent()
  const { revoke, loading: revoking } = useRevokeValidation()
  const { reject, loading: rejecting } = useRejectSyntheses()
  const { restore, loading: restoring } = useRestoreSyntheses()

  const [modal, setModal] = useState<null | 'validate' | 'reject' | 'revoke'>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const leads = members.filter((m) => m.is_lead)
  const secondaries = members.filter((m) => !m.is_lead)

  const isRejected = status === 'rejected'
  const isStale = Boolean(validation?.is_stale)
  const isValid = Boolean(validation?.validated) && !isStale

  const busy = validating || revoking || rejecting || restoring

  const afterChange = async (msg: string) => {
    setModal(null)
    setError(null)
    setFeedback(msg)
    await refetchStatus()
    onChanged()
  }

  const doValidate = async (
    leadId: string,
    secondaryId: string | null,
    comments: string
  ) => {
    try {
      await validate({
        contentType: 'news_synthesis',
        contentId: synthesisId,
        validatedByLead: leadId,
        validatedBySecondary: secondaryId,
        comments: comments.trim() || null,
      })
      await afterChange('Synthèse validée — elle est désormais visible côté public.')
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la validation')
    }
  }

  const doReject = async (reason: RejectionReason) => {
    try {
      const n = await reject([synthesisId], reason)
      if (n === 0) {
        setError(
          "Rien n'a été rejeté : la synthèse n'est plus au statut « active »."
        )
        return
      }
      await afterChange(`Synthèse rejetée — motif : ${rejectionReasonLabel(reason)}.`)
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du rejet')
    }
  }

  const doRevoke = async (reason: string) => {
    if (!validation?.validation_id) {
      setError('Aucune validation courante à révoquer.')
      return
    }
    try {
      const ok = await revoke(validation.validation_id, reason)
      await afterChange(
        ok
          ? 'Validation révoquée — la synthèse repasse en attente.'
          : 'Aucune validation courante à révoquer.'
      )
    } catch (e: any) {
      setError(e?.message || 'Erreur lors de la révocation')
    }
  }

  const doRestore = async () => {
    try {
      const n = await restore([synthesisId])
      await afterChange(
        n > 0
          ? 'Rejet annulé — la synthèse repasse en attente de validation.'
          : 'Rien à rétablir.'
      )
    } catch (e: any) {
      setError(e?.message || 'Erreur lors du rétablissement')
    }
  }

  return (
    <div className={CARD}>
      <div className="flex items-center gap-2 mb-4">
        <ShieldCheck className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900">Décision éditoriale</h3>
      </div>

      {statusLoading && !validation ? (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : (
        <>
          {/* ── État courant ─────────────────────────────────────────────── */}
          {isRejected ? (
            <div className="rounded-xl bg-red-50 border border-red-200 p-4">
              <div className="flex items-center gap-2">
                <Ban className="w-4 h-4 text-red-600" />
                <span className="text-sm font-semibold text-red-900">Rejetée</span>
              </div>
              <p className="text-xs text-red-800 mt-1.5">
                Motif : <strong>{rejectionReasonLabel(rejectionReason)}</strong>
                {rejectedAt && ` · le ${formatDateFr(rejectedAt)}`}
              </p>
              <p className="text-xs text-red-700 mt-2">
                Invisible dans la rubrique News, le quiz du jour et la file de
                validation. Rien n&apos;est supprimé.
              </p>
            </div>
          ) : isValid ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span className="text-sm font-semibold text-emerald-900">
                  Validée et à jour
                </span>
              </div>
              <p className="text-xs text-emerald-800 mt-1.5">
                {validation?.lead_name ?? '—'}
                {validation?.secondary_name ? ` + ${validation.secondary_name}` : ''}
                {validation?.validated_at && ` · le ${formatDateFr(validation.validated_at)}`}
              </p>
              {validation?.comments && (
                <p className="text-xs text-emerald-700 mt-2 italic">
                  « {validation.comments} »
                </p>
              )}
            </div>
          ) : isStale ? (
            <div className="rounded-xl bg-orange-50 border border-orange-200 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-semibold text-orange-900">
                  Validation périmée
                </span>
              </div>
              <p className="text-xs text-orange-800 mt-1.5">
                La synthèse a été modifiée depuis sa validation du{' '}
                {formatDateFr(validation?.validated_at ?? null)}. Elle doit être
                re-validée.
              </p>
            </div>
          ) : (
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-semibold text-gray-900">Non validée</span>
              </div>
              <p className="text-xs text-gray-600 mt-1.5">
                Tant qu&apos;elle n&apos;est pas validée, cette synthèse
                n&apos;apparaît ni dans la rubrique News, ni dans le quiz du jour.
              </p>
            </div>
          )}

          {/* ── Incohérence à signaler plutôt qu'à masquer ────────────────
              is_editorially_validated est posé par un trigger sur
              editorial_validations. Un écart entre le drapeau et le statut de
              validation signalerait un trigger en panne : on l'affiche au lieu
              de laisser l'éditrice agir sur une information fausse. */}
          {!isRejected && isEditoriallyValidated !== isValid && (
            <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Incohérence détectée : le drapeau de publication dit «{' '}
              {isEditoriallyValidated ? 'validée' : 'non validée'} » alors que la
              validation dit « {isValid ? 'validée' : 'non validée'} ». À signaler.
            </p>
          )}

          {feedback && (
            <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
              {feedback}
            </p>
          )}
          {error && (
            <p className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* ── Actions ──────────────────────────────────────────────────── */}
          <div className="mt-4 flex flex-col gap-2">
            {isRejected ? (
              <button
                type="button"
                disabled={busy}
                onClick={doRestore}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors disabled:opacity-60"
              >
                {restoring ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <RotateCcw size={14} />
                )}
                Rétablir
              </button>
            ) : isValid ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setModal('revoke')}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-700 bg-red-50 hover:bg-red-100 transition-colors disabled:opacity-60"
              >
                <Trash2 size={14} />
                Révoquer la validation
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={busy || leads.length === 0}
                  onClick={() => setModal('validate')}
                  title={
                    leads.length === 0
                      ? 'Aucun membre lead actif au comité scientifique'
                      : undefined
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
                >
                  <ShieldCheck size={14} />
                  {isStale ? 'Re-valider' : 'Valider'}
                </button>
                <button
                  type="button"
                  disabled={busy || status !== 'active'}
                  onClick={() => setModal('reject')}
                  title={
                    status !== 'active'
                      ? `Rejet impossible : statut « ${status} »`
                      : undefined
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-red-700 bg-white border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-60"
                >
                  <Ban size={14} />
                  Rejeter
                </button>
              </>
            )}
          </div>

          {leads.length === 0 && !isRejected && !isValid && (
            <p className="mt-2 text-xs text-gray-500">
              Validation indisponible : aucun membre lead actif au comité
              scientifique.
            </p>
          )}
        </>
      )}

      {modal === 'validate' && (
        <ValidateDialog
          leads={leads}
          secondaries={secondaries}
          submitting={validating}
          isRevalidation={isStale}
          onClose={() => setModal(null)}
          onSubmit={doValidate}
        />
      )}

      {modal === 'reject' && (
        <RejectDialog
          submitting={rejecting}
          onClose={() => setModal(null)}
          onSubmit={doReject}
        />
      )}

      {modal === 'revoke' && (
        <RevokeDialog
          submitting={revoking}
          onClose={() => setModal(null)}
          onSubmit={doRevoke}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Coquille commune aux trois dialogues
// ─────────────────────────────────────────────────────────────────────────────
function Dialog({
  title,
  icon,
  submitting,
  onClose,
  children,
  footer,
}: {
  title: string
  icon: React.ReactNode
  submitting: boolean
  onClose: () => void
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-gray-900/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] flex flex-col bg-white rounded-none sm:rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 flex-shrink-0">
          <h2 className="text-base font-bold text-gray-900 inline-flex items-center gap-2">
            {icon}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
            className="p-1.5 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">{children}</div>
        <div className="px-5 py-4 border-t border-gray-200 flex items-center gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors disabled:opacity-60"
          >
            Annuler
          </button>
          {footer}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Valider / re-valider
// ─────────────────────────────────────────────────────────────────────────────
function ValidateDialog({
  leads,
  secondaries,
  submitting,
  isRevalidation,
  onClose,
  onSubmit,
}: {
  leads: { id: string; display_name: string; title: string | null }[]
  secondaries: { id: string; display_name: string; title: string | null }[]
  submitting: boolean
  isRevalidation: boolean
  onClose: () => void
  onSubmit: (leadId: string, secondaryId: string | null, comments: string) => Promise<void>
}) {
  const [leadId, setLeadId] = useState(leads[0]?.id ?? '')
  const [secondaryId, setSecondaryId] = useState('')
  const [comments, setComments] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = async () => {
    if (!leadId) {
      setLocalError('Choisis le validateur principal.')
      return
    }
    setLocalError(null)
    await onSubmit(leadId, secondaryId || null, comments)
  }

  return (
    <Dialog
      title={isRevalidation ? 'Re-valider la synthèse' : 'Valider la synthèse'}
      icon={<ShieldCheck size={18} className="text-emerald-600" />}
      submitting={submitting}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !leadId}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Validation…
            </>
          ) : (
            <>
              <ShieldCheck size={15} />
              {isRevalidation ? 'Re-valider' : 'Valider'}
            </>
          )}
        </button>
      }
    >
      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Validateur principal
        </label>
        <select
          value={leadId}
          onChange={(e) => {
            setLeadId(e.target.value)
            setLocalError(null)
          }}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white"
        >
          {leads.length === 0 && <option value="">Aucun lead actif</option>}
          {leads.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
              {m.title ? ` — ${m.title}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Second validateur <span className="font-normal text-gray-500">(optionnel)</span>
        </label>
        <select
          value={secondaryId}
          onChange={(e) => setSecondaryId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm bg-white"
        >
          <option value="">Aucun</option>
          {secondaries.map((m) => (
            <option key={m.id} value={m.id}>
              {m.display_name}
              {m.title ? ` — ${m.title}` : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Commentaire <span className="font-normal text-gray-500">(optionnel)</span>
        </label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          rows={3}
          placeholder="Réserve, précision, point de vigilance…"
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm resize-none"
        />
      </div>

      <p className="text-xs text-gray-500">
        La validation est tracée (validateur, date, commentaire) pour la conformité
        Qualiopi. La synthèse devient visible dans la rubrique News et éligible au
        quiz du jour.
      </p>

      {localError && <p className="text-sm text-red-600">{localError}</p>}
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Rejeter
// ─────────────────────────────────────────────────────────────────────────────
function RejectDialog({
  submitting,
  onClose,
  onSubmit,
}: {
  submitting: boolean
  onClose: () => void
  onSubmit: (reason: RejectionReason) => Promise<void>
}) {
  const [reason, setReason] = useState<RejectionReason | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = async () => {
    if (!reason) {
      setLocalError('Choisis un motif avant de rejeter.')
      return
    }
    setLocalError(null)
    await onSubmit(reason)
  }

  return (
    <Dialog
      title="Rejeter la synthèse"
      icon={<Ban size={18} className="text-red-600" />}
      submitting={submitting}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={submitting || !reason}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Rejet…
            </>
          ) : (
            <>
              <Ban size={15} />
              Rejeter
            </>
          )}
        </button>
      }
    >
      <div>
        <p className="text-xs font-semibold text-gray-700 mb-2">MOTIF DU REJET</p>
        <div className="space-y-1.5">
          {REJECTION_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => {
                setReason(r.value)
                setLocalError(null)
              }}
              className={`w-full text-left px-4 py-2.5 rounded-xl border transition-colors ${
                reason === r.value
                  ? 'border-red-500 bg-red-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <span className="text-sm font-semibold text-gray-900">{r.label}</span>
              {r.hint && (
                <span className="block text-xs text-gray-500 mt-0.5">{r.hint}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-500">
        La synthèse quitte la rubrique News, le quiz du jour et la file de
        validation. Rien n&apos;est supprimé : tu peux la rétablir depuis cette page
        ou depuis le filtre « Rejetées ».
      </p>

      {localError && <p className="text-sm text-red-600">{localError}</p>}
    </Dialog>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Révoquer une validation
// ─────────────────────────────────────────────────────────────────────────────
function RevokeDialog({
  submitting,
  onClose,
  onSubmit,
}: {
  submitting: boolean
  onClose: () => void
  onSubmit: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  const submit = async () => {
    if (reason.trim().length < 3) {
      setLocalError('Indique un motif de révocation (3 caractères minimum).')
      return
    }
    setLocalError(null)
    await onSubmit(reason.trim())
  }

  return (
    <Dialog
      title="Révoquer la validation"
      icon={<Trash2 size={18} className="text-red-600" />}
      submitting={submitting}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Révocation…
            </>
          ) : (
            'Révoquer'
          )}
        </button>
      }
    >
      <p className="text-sm text-gray-700">
        La synthèse repassera <strong>non validée</strong> et quittera la rubrique
        News. Ce n&apos;est pas un rejet : elle revient dans la file de validation.
      </p>

      <div>
        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
          Motif de la révocation
        </label>
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value)
            setLocalError(null)
          }}
          rows={3}
          placeholder="Erreur repérée après publication, donnée à corriger…"
          className="w-full px-3 py-2 rounded-xl border border-gray-300 text-sm resize-none"
        />
        <p className="text-xs text-gray-500 mt-1.5">
          Conservé dans l&apos;historique de validation.
        </p>
      </div>

      {localError && <p className="text-sm text-red-600">{localError}</p>}
    </Dialog>
  )
}
