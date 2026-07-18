'use client'

import { useCallback, useEffect, useState } from 'react'
import { Video, Plus, X, Users, Check, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import ReviewDecisionModal from '@/components/masterclass/ReviewDecisionModal'
import DateTimePicker from '@/components/masterclass/DateTimePicker'
import { AdminProposeLiveSessionSchema, type AdminProposeLiveSessionPayload } from '@/lib/schemas/live-session'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected'

interface MasterclassSession {
  id: string
  title: string
  description: string | null
  starts_at: string
  duration_min: number
  capacity: number | null
  is_published: boolean
  formation_id: string | null
  registration_count: number
  review_status: ReviewStatus
  created_by_role: 'formateur' | 'admin'
  awaiting: 'admin' | 'formateur' | null
  review_comment: string | null
  formateur_user_id: string
  formateur_name: string | null
}

interface Formateur {
  user_id: string
  email: string | null
  first_name: string | null
  last_name: string | null
}

interface Formation {
  id: string
  title: string
}

interface ProposeForm {
  formateur_user_id: string
  title: string
  description: string
  starts_at: string
  duration_min: string
  zoom_url: string
  zoom_password: string
  capacity: string
  formation_id: string
}

const EMPTY_PROPOSE_FORM: ProposeForm = {
  formateur_user_id: '',
  title: '',
  description: '',
  starts_at: '',
  duration_min: '60',
  zoom_url: '',
  zoom_password: '',
  capacity: '',
  formation_id: '',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionDateTime(isoDate: string): string {
  return new Date(isoDate).toLocaleString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fromDatetimeLocal(val: string): string {
  return new Date(val).toISOString()
}

function formateurLabel(f: Formateur): string {
  const name = [f.first_name, f.last_name].filter(Boolean).join(' ')
  return name || f.email || f.user_id
}

const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: 'Brouillon',
  pending_review: 'En attente de validation',
  approved: 'Approuvée',
  rejected: 'Refusée',
}

const REVIEW_STATUS_VARIANT: Record<ReviewStatus, 'neutral' | 'warning' | 'success' | 'danger'> = {
  draft: 'neutral',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger',
}

// Tri : en attente de décision admin d'abord, puis les autres en attente,
// puis le reste trié par date.
function sortSessions(sessions: MasterclassSession[]): MasterclassSession[] {
  return [...sessions].sort((a, b) => {
    const rank = (s: MasterclassSession) => (s.awaiting === 'admin' ? 0 : s.review_status === 'pending_review' ? 1 : 2)
    const diff = rank(a) - rank(b)
    if (diff !== 0) return diff
    return new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  })
}

// ─── Modale proposition ───────────────────────────────────────────────────────

function ProposeModal({
  formateurs,
  formations,
  onClose,
  onSave,
}: {
  formateurs: Formateur[]
  formations: Formation[]
  onClose: () => void
  onSave: (payload: AdminProposeLiveSessionPayload) => Promise<void>
}) {
  const [form, setForm] = useState<ProposeForm>(EMPTY_PROPOSE_FORM)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function setField<K extends keyof ProposeForm>(key: K, value: ProposeForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: '' }))
  }

  async function handleSubmit() {
    const payload = {
      formateur_user_id: form.formateur_user_id,
      title: form.title,
      description: form.description || null,
      starts_at: form.starts_at ? fromDatetimeLocal(form.starts_at) : '',
      duration_min: form.duration_min ? parseInt(form.duration_min, 10) : 60,
      zoom_url: form.zoom_url || null,
      zoom_password: form.zoom_password || null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      formation_id: form.formation_id || null,
    }

    const parsed = AdminProposeLiveSessionSchema.safeParse(payload)
    if (!parsed.success) {
      const flat = parsed.error.flatten().fieldErrors
      const errors: Record<string, string> = {}
      for (const [k, msgs] of Object.entries(flat)) {
        if (msgs && msgs.length > 0) errors[k] = msgs[0]
      }
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    setSubmitError(null)
    try {
      await onSave(parsed.data)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">Proposer une masterclass</h2>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors" aria-label="Fermer">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Formateur <span className="text-red-500">*</span>
            </label>
            <select
              value={form.formateur_user_id}
              onChange={(e) => setField('formateur_user_id', e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                fieldErrors.formateur_user_id ? 'border-red-400' : 'border-gray-300'
              }`}
            >
              <option value="">Sélectionner un formateur…</option>
              {formateurs.map((f) => (
                <option key={f.user_id} value={f.user_id}>{formateurLabel(f)}</option>
              ))}
            </select>
            {fieldErrors.formateur_user_id && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.formateur_user_id}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Titre <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              maxLength={200}
              placeholder="Ex : Implantologie avancée — cas complexes"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                fieldErrors.title ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {fieldErrors.title && <p className="text-red-500 text-xs mt-1">{fieldErrors.title}</p>}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
              placeholder="Programme, objectifs pédagogiques…"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Date et heure <span className="text-red-500">*</span>
              </label>
              <DateTimePicker
                value={form.starts_at}
                onChange={(v) => setField('starts_at', v)}
                error={Boolean(fieldErrors.starts_at)}
                disablePast
              />
              {fieldErrors.starts_at && <p className="text-red-500 text-xs mt-1">{fieldErrors.starts_at}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Durée (minutes) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={form.duration_min}
                onChange={(e) => setField('duration_min', e.target.value)}
                min={1}
                placeholder="60"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Lien Zoom</label>
              <input
                type="url"
                value={form.zoom_url}
                onChange={(e) => setField('zoom_url', e.target.value)}
                placeholder="https://zoom.us/j/..."
                className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                  fieldErrors.zoom_url ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {fieldErrors.zoom_url && <p className="text-red-500 text-xs mt-1">{fieldErrors.zoom_url}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Mot de passe Zoom</label>
              <input
                type="text"
                value={form.zoom_password}
                onChange={(e) => setField('zoom_password', e.target.value)}
                maxLength={100}
                placeholder="Optionnel"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Capacité max</label>
              <input
                type="number"
                value={form.capacity}
                onChange={(e) => setField('capacity', e.target.value)}
                min={1}
                placeholder="Ex : 30"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Formation liée</label>
              <select
                value={form.formation_id}
                onChange={(e) => setField('formation_id', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">Aucune formation liée</option>
                {formations.map((f) => (
                  <option key={f.id} value={f.id}>{f.title}</option>
                ))}
              </select>
            </div>
          </div>

          {submitError && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{submitError}</p>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex gap-2 sticky bottom-0 bg-white">
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting} className="flex-1">
            Annuler
          </Button>
          <Button variant="primary" size="md" onClick={handleSubmit} disabled={submitting} className="flex-1">
            {submitting ? 'Envoi…' : 'Proposer au formateur'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Carte session ────────────────────────────────────────────────────────────

function SessionRow({
  session,
  onOpenReview,
  onTogglePublish,
}: {
  session: MasterclassSession
  onOpenReview: (s: MasterclassSession) => void
  onTogglePublish: (s: MasterclassSession) => void
}) {
  const awaitingMyDecision = session.awaiting === 'admin'

  return (
    <Card variant="flat" className="p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-primary text-sm font-semibold mb-0.5">
            <Video size={14} />
            <span className="capitalize">{formatSessionDateTime(session.starts_at)}</span>
          </div>
          <div className="text-gray-500 text-xs">
            {session.formateur_name ?? 'Formateur inconnu'}
          </div>
        </div>
        <Badge variant={REVIEW_STATUS_VARIANT[session.review_status]}>
          {REVIEW_STATUS_LABEL[session.review_status]}
        </Badge>
      </div>

      <h3 className="text-base font-bold text-gray-900 leading-snug">{session.title}</h3>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users size={12} />
          {session.registration_count}
          {session.capacity != null ? ` / ${session.capacity} places` : ' inscrits'}
        </span>
        {session.is_published && <Badge variant="success">Publiée</Badge>}
        <Badge variant="neutral">
          {session.created_by_role === 'admin' ? 'Créée par l\'administration' : 'Créée par le formateur'}
        </Badge>
      </div>

      {session.review_status === 'rejected' && session.review_comment && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Motif du refus : {session.review_comment}
        </p>
      )}

      {awaitingMyDecision && (
        <div className="pt-1 border-t border-gray-100">
          <Button variant="primary" size="sm" onClick={() => onOpenReview(session)} className="flex items-center gap-1.5">
            <Check size={14} />
            Approuver / Refuser
          </Button>
        </div>
      )}

      {session.review_status === 'approved' && (
        <div className="pt-1 border-t border-gray-100">
          {session.created_by_role === 'admin' ? (
            <button
              onClick={() => onTogglePublish(session)}
              className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                session.is_published
                  ? 'text-orange-600 hover:bg-orange-50'
                  : 'text-primary hover:bg-[#EDE9FF]'
              }`}
            >
              {session.is_published ? 'Dépublier' : 'Publier'}
            </button>
          ) : (
            !session.is_published && (
              <Badge variant="warning">Approuvée — en attente de publication par le formateur</Badge>
            )
          )}
        </div>
      )}
    </Card>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function MasterclassReviewClient() {
  const [sessions, setSessions] = useState<MasterclassSession[]>([])
  const [formateurs, setFormateurs] = useState<Formateur[]>([])
  const [formations, setFormations] = useState<Formation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [proposeOpen, setProposeOpen] = useState(false)
  const [reviewTarget, setReviewTarget] = useState<MasterclassSession | null>(null)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null)

  const load = useCallback(async () => {
    try {
      const [sessRes, fmtRes, formRes] = await Promise.all([
        fetch('/api/admin/masterclass'),
        fetch('/api/admin/formateurs'),
        fetch('/api/admin/formations'),
      ])
      if (sessRes.ok) {
        const data = await sessRes.json()
        setSessions(data.sessions ?? [])
      } else {
        setError('Impossible de charger les masterclass.')
      }
      if (fmtRes.ok) {
        const data = await fmtRes.json()
        setFormateurs(data.formateurs ?? [])
      }
      if (formRes.ok) {
        const data = await formRes.json()
        setFormations(data.formations ?? [])
      }
    } catch {
      setError('Erreur de connexion.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function showToast(text: string, type: 'error' | 'success' = 'error') {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 5000)
  }

  async function handlePropose(payload: AdminProposeLiveSessionPayload) {
    const res = await fetch('/api/admin/masterclass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Erreur serveur')
    }
    setProposeOpen(false)
    showToast('Masterclass proposée au formateur.', 'success')
    await load()
  }

  async function handleReviewDecision(decision: 'approved' | 'rejected', comment: string | null) {
    if (!reviewTarget) return
    const res = await fetch(`/api/admin/masterclass/${reviewTarget.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, comment }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Erreur serveur')
    }
    setReviewTarget(null)
    showToast(decision === 'approved' ? 'Masterclass approuvée.' : 'Masterclass refusée.', 'success')
    await load()
  }

  async function handleTogglePublish(session: MasterclassSession) {
    const res = await fetch(`/api/admin/masterclass/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !session.is_published }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      showToast(body.error ?? 'Impossible de modifier le statut.')
      return
    }
    await load()
  }

  const sorted = sortSessions(sessions)
  const pendingCount = sessions.filter((s) => s.awaiting === 'admin').length

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Masterclass</h1>
          <p className="text-gray-600 mt-1">
            {pendingCount > 0
              ? `${pendingCount} masterclass en attente de votre validation`
              : 'Validation croisée des masterclass formateurs'}
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setProposeOpen(true)} className="flex items-center gap-2 shrink-0">
          <Plus size={16} />
          Proposer une masterclass
        </Button>
      </header>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-sm text-center py-8">{error}</p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-[#EDE9FF] flex items-center justify-center mb-4">
            <Video size={28} className="text-primary" />
          </div>
          <p className="text-gray-900 font-semibold mb-1">Aucune masterclass</p>
          <p className="text-gray-500 text-sm">Les masterclass soumises par les formateurs apparaîtront ici.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {sorted.map((session) => (
            <SessionRow key={session.id} session={session} onOpenReview={setReviewTarget} onTogglePublish={handleTogglePublish} />
          ))}
        </div>
      )}

      {toastMsg && (
        <div
          className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2 ${
            toastMsg.type === 'error' ? 'bg-red-600' : 'bg-green-600'
          }`}
        >
          {toastMsg.type === 'error' && <AlertTriangle size={16} />}
          {toastMsg.text}
        </div>
      )}

      {proposeOpen && (
        <ProposeModal
          formateurs={formateurs}
          formations={formations}
          onClose={() => setProposeOpen(false)}
          onSave={handlePropose}
        />
      )}

      {reviewTarget && (
        <ReviewDecisionModal
          title={`"${reviewTarget.title}"`}
          onClose={() => setReviewTarget(null)}
          onSubmit={handleReviewDecision}
        />
      )}
    </div>
  )
}
