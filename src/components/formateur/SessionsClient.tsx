'use client'

import { useCallback, useEffect, useState } from 'react'
import { Video, Plus, Pencil, Trash2, X, AlertTriangle, Users, Send, Check, Ban } from 'lucide-react'
import { LiveSessionSchema, type LiveSessionPayload } from '@/lib/schemas/live-session'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import { computeSessionStatus, computeSessionStatusLabel, type SessionStatus } from '@/lib/utils/session-status'
import type { FormateurFormation } from '@/lib/auth/rbac'
import ReviewDecisionModal from '@/components/masterclass/ReviewDecisionModal'
import DateTimePicker from '@/components/masterclass/DateTimePicker'

// ─── Types ────────────────────────────────────────────────────────────────────

type ReviewStatus = 'draft' | 'pending_review' | 'approved' | 'rejected'

interface LiveSession {
  id: string
  title: string
  description: string | null
  starts_at: string
  duration_min: number
  zoom_url: string | null
  zoom_password: string | null
  capacity: number | null
  status: string
  is_published: boolean
  formation_id: string | null
  registration_count: number
  computed_status: SessionStatus
  created_at: string
  updated_at: string
  review_status: ReviewStatus
  created_by_role: 'formateur' | 'admin'
  awaiting: 'admin' | 'formateur' | null
  review_comment: string | null
}

interface FormField {
  title: string
  description: string
  starts_at: string
  duration_min: string
  zoom_url: string
  zoom_password: string
  capacity: string
  formation_id: string
}

const EMPTY_FORM: FormField = {
  title: '',
  description: '',
  starts_at: '',
  duration_min: '60',
  zoom_url: '',
  zoom_password: '',
  capacity: '',
  formation_id: '',
  is_published: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatSessionDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatSessionTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function toDatetimeLocal(isoDate: string): string {
  const d = new Date(isoDate)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocal(val: string): string {
  return new Date(val).toISOString()
}

// ─── Badge statut ─────────────────────────────────────────────────────────────

function StatusBadge({ session }: { session: LiveSession }) {
  const status = computeSessionStatus(session)
  const label = computeSessionStatusLabel(session)

  const classes: Record<SessionStatus, string> = {
    scheduled: 'bg-gray-100 text-gray-600',
    live: 'bg-red-100 text-red-700 animate-pulse',
    ended: 'bg-green-100 text-green-700',
    cancelled: 'bg-orange-100 text-orange-700',
  }

  return (
    <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full ${classes[status]}`}>
      {label}
    </span>
  )
}

// ─── Badge validation croisée ─────────────────────────────────────────────────

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

function ReviewStatusBadge({ session }: { session: LiveSession }) {
  return (
    <Badge variant={REVIEW_STATUS_VARIANT[session.review_status]}>
      {REVIEW_STATUS_LABEL[session.review_status]}
    </Badge>
  )
}

// ─── SessionCard ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  formations,
  onEdit,
  onCancel,
  onDelete,
  onTogglePublish,
  onSubmitForReview,
  onOpenReview,
}: {
  session: LiveSession
  formations: FormateurFormation[]
  onEdit: (s: LiveSession) => void
  onCancel: (s: LiveSession) => void
  onDelete: (s: LiveSession) => void
  onTogglePublish: (s: LiveSession) => void
  onSubmitForReview: (s: LiveSession) => void
  onOpenReview: (s: LiveSession) => void
}) {
  const formation = formations.find((f) => f.id === session.formation_id)
  const isCancelled = computeSessionStatus(session) === 'cancelled'
  const isEditable = session.created_by_role === 'formateur' && ['draft', 'rejected'].includes(session.review_status)
  const canSubmit = session.created_by_role === 'formateur' && ['draft', 'rejected'].includes(session.review_status)
  const canDelete = ['draft', 'rejected'].includes(session.review_status)
  const awaitingMyDecision = session.created_by_role === 'admin' && session.review_status === 'pending_review' && session.awaiting === 'formateur'

  return (
    <Card variant="flat" className="p-5 flex flex-col gap-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-primary text-sm font-semibold mb-0.5">
            <Video size={14} />
            <span className="capitalize">{formatSessionDate(session.starts_at)}</span>
            <span className="font-normal text-gray-500">{formatSessionTime(session.starts_at)}</span>
          </div>
          <div className="text-gray-500 text-xs">
            Durée : {session.duration_min} min
          </div>
        </div>
        <StatusBadge session={session} />
      </div>

      <h3 className="text-base font-bold text-gray-900 leading-snug">{session.title}</h3>

      <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users size={12} />
          {session.registration_count}
          {session.capacity != null ? ` / ${session.capacity} places` : ' inscrits'}
        </span>
        <ReviewStatusBadge session={session} />
        {session.is_published && <Badge variant="success">Publiée</Badge>}
        {session.created_by_role === 'admin' && <Badge variant="info">Proposée par l'administration</Badge>}
      </div>

      {session.review_status === 'rejected' && session.review_comment && (
        <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          Motif du refus : {session.review_comment}
        </p>
      )}

      {formation && (
        <span className="self-start text-xs bg-[#EDE9FF] text-primary font-medium px-2.5 py-1 rounded-full">
          {formation.title}
        </span>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100">
        {awaitingMyDecision && (
          <Button variant="primary" size="sm" onClick={() => onOpenReview(session)} className="flex items-center gap-1.5">
            <Check size={14} />
            Accepter / Refuser
          </Button>
        )}
        {!isCancelled && canSubmit && (
          <Button variant="primary" size="sm" onClick={() => onSubmitForReview(session)} className="flex items-center gap-1.5">
            <Send size={14} />
            Soumettre pour validation
          </Button>
        )}
        {!isCancelled && isEditable && (
          <Button variant="ghost" size="sm" onClick={() => onEdit(session)} className="flex items-center gap-1.5">
            <Pencil size={14} />
            Éditer
          </Button>
        )}
        {!isCancelled && session.review_status === 'approved' && (
          session.created_by_role === 'formateur' ? (
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
          ) : session.is_published ? (
            <button
              onClick={() => onTogglePublish(session)}
              className="flex items-center gap-1.5 text-sm text-orange-600 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              Dépublier
            </button>
          ) : (
            <Badge variant="warning">Approuvée — en attente de publication par l&apos;administration</Badge>
          )
        )}
        {!isCancelled && (
          <button
            onClick={() => onCancel(session)}
            className="flex items-center gap-1.5 text-sm text-orange-500 hover:text-orange-700 px-3 py-1.5 rounded-lg hover:bg-orange-50 transition-colors"
          >
            <Ban size={14} />
            Annuler
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(session)}
            className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors ml-auto"
          >
            <Trash2 size={14} />
            Supprimer
          </button>
        )}
      </div>
    </Card>
  )
}

function EmptyState({ tab }: { tab: 'upcoming' | 'past' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-[#EDE9FF] flex items-center justify-center mb-4">
        <Video size={28} className="text-primary" />
      </div>
      <p className="text-gray-900 font-semibold mb-1">
        {tab === 'upcoming' ? 'Aucune masterclass à venir' : 'Aucune masterclass passée'}
      </p>
      <p className="text-gray-500 text-sm">
        {tab === 'upcoming'
          ? 'Créez votre première masterclass live !'
          : 'Vos masterclass passées apparaîtront ici.'}
      </p>
    </div>
  )
}

// ─── Modale formulaire ────────────────────────────────────────────────────────

function SessionModal({
  editing,
  formations,
  onClose,
  onSave,
}: {
  editing: LiveSession | null
  formations: FormateurFormation[]
  onClose: () => void
  onSave: (payload: LiveSessionPayload) => Promise<void>
}) {
  const [form, setForm] = useState<FormField>(() => {
    if (!editing) return EMPTY_FORM
    return {
      title: editing.title,
      description: editing.description ?? '',
      starts_at: editing.starts_at ? toDatetimeLocal(editing.starts_at) : '',
      duration_min: String(editing.duration_min),
      zoom_url: editing.zoom_url ?? '',
      zoom_password: editing.zoom_password ?? '',
      capacity: editing.capacity != null ? String(editing.capacity) : '',
      formation_id: editing.formation_id ?? '',
    }
  })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  function setField<K extends keyof FormField>(key: K, value: FormField[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: '' }))
  }

  async function handleSubmit() {
    // La publication passe désormais par le workflow de validation (bouton
    // "Soumettre pour validation" puis "Publier" une fois approuvée) : la
    // sauvegarde du formulaire reste toujours en brouillon.
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      starts_at: form.starts_at ? fromDatetimeLocal(form.starts_at) : '',
      duration_min: form.duration_min ? parseInt(form.duration_min, 10) : 60,
      zoom_url: form.zoom_url || null,
      zoom_password: form.zoom_password || null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      formation_id: form.formation_id || null,
      is_published: false,
    }

    const parsed = LiveSessionSchema.safeParse(payload)
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
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? 'Modifier la masterclass' : 'Nouvelle masterclass'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Titre */}
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

          {/* Description */}
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

          {/* Date + Durée */}
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

          {/* Zoom URL + Password */}
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

          {/* Capacité + Formation */}
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
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                <option value="">Aucune formation liée</option>
                {formations.map((f) => (
                  <option key={f.id} value={f.id}>{f.title}</option>
                ))}
              </select>
            </div>
          </div>

          {submitError && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {submitError}
            </p>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex flex-col sm:flex-row gap-2 sticky bottom-0 bg-white">
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting} className="flex-1">
            Annuler
          </Button>
          <Button variant="primary" size="md" onClick={() => handleSubmit()} disabled={submitting} className="flex-1">
            {submitting ? 'Enregistrement…' : 'Enregistrer en brouillon'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function SessionsClient() {
  const [upcoming, setUpcoming] = useState<LiveSession[]>([])
  const [past, setPast] = useState<LiveSession[]>([])
  const [formations, setFormations] = useState<FormateurFormation[]>([])
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [modal, setModal] = useState<{ open: boolean; editing: LiveSession | null }>({
    open: false,
    editing: null,
  })
  const [reviewTarget, setReviewTarget] = useState<LiveSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'error' | 'success' } | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const [sessRes, fRes] = await Promise.all([
          fetch('/api/formateur/sessions'),
          fetch('/api/formateur/formations'),
        ])
        if (sessRes.ok) {
          const data = await sessRes.json()
          setUpcoming(data.upcoming ?? [])
          setPast(data.past ?? [])
        } else {
          setError('Impossible de charger les sessions.')
        }
        if (fRes.ok) {
          setFormations(await fRes.json())
        }
      } catch {
        setError('Erreur de connexion.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const reloadSessions = useCallback(async () => {
    const res = await fetch('/api/formateur/sessions')
    if (res.ok) {
      const data = await res.json()
      setUpcoming(data.upcoming ?? [])
      setPast(data.past ?? [])
    }
  }, [])

  function showToast(text: string, type: 'error' | 'success' = 'error') {
    setToastMsg({ text, type })
    setTimeout(() => setToastMsg(null), 5000)
  }

  async function handleSave(payload: LiveSessionPayload) {
    const editing = modal.editing
    const url = editing ? `/api/formateur/sessions/${editing.id}` : '/api/formateur/sessions'
    const method = editing ? 'PATCH' : 'POST'

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Erreur serveur')
    }

    setModal({ open: false, editing: null })
    await reloadSessions()
  }

  async function handleCancel(session: LiveSession) {
    if (!confirm(`Annuler "${session.title}" ?`)) return

    const res = await fetch(`/api/formateur/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })

    if (res.status === 409) {
      const body = await res.json().catch(() => ({}))
      const count = body.registration_count ?? '?'
      if (
        confirm(`${count} participant(s) sont inscrits. Confirmer l'annulation ?`)
      ) {
        const res2 = await fetch(`/api/formateur/sessions/${session.id}?force=true`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'cancelled' }),
        })
        if (!res2.ok) {
          showToast("Erreur lors de l'annulation.")
          return
        }
      } else {
        return
      }
    } else if (!res.ok) {
      showToast("Erreur lors de l'annulation.")
      return
    }

    await reloadSessions()
  }

  async function handleDelete(session: LiveSession) {
    if (!confirm(`Supprimer "${session.title}" ?`)) return

    const res = await fetch(`/api/formateur/sessions/${session.id}`, { method: 'DELETE' })

    if (res.status === 409) {
      const body = await res.json().catch(() => ({}))
      showToast(body.error ?? 'Impossible de supprimer cette session.')
      return
    }
    if (!res.ok) {
      showToast('Erreur lors de la suppression.')
      return
    }

    await reloadSessions()
  }

  async function handleTogglePublish(session: LiveSession) {
    const res = await fetch(`/api/formateur/sessions/${session.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !session.is_published }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      showToast(body.error ?? 'Impossible de modifier le statut.')
      return
    }

    await reloadSessions()
  }

  async function handleSubmitForReview(session: LiveSession) {
    const res = await fetch(`/api/formateur/sessions/${session.id}/submit`, { method: 'POST' })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      showToast(body.error ?? 'Impossible de soumettre cette masterclass.')
      return
    }
    showToast('Masterclass soumise pour validation.', 'success')
    await reloadSessions()
  }

  async function handleReviewDecision(decision: 'approved' | 'rejected', comment: string | null) {
    if (!reviewTarget) return
    const res = await fetch(`/api/formateur/sessions/${reviewTarget.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, comment }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? 'Erreur serveur')
    }
    setReviewTarget(null)
    showToast(decision === 'approved' ? 'Proposition acceptée.' : 'Proposition refusée.', 'success')
    await reloadSessions()
  }

  const displayed = tab === 'upcoming' ? upcoming : past

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Mes masterclass</h1>
          <p className="text-gray-600 mt-1">Gérez vos sessions live et vos inscriptions</p>
        </div>
        <Button variant="primary" size="md" onClick={() => setModal({ open: true, editing: null })} className="flex items-center gap-2 shrink-0">
          <Plus size={16} />
          Nouvelle masterclass
        </Button>
      </header>

      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-1 mr-5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'upcoming'
              ? `À venir${upcoming.length > 0 ? ` (${upcoming.length})` : ''}`
              : `Passées${past.length > 0 ? ` (${past.length})` : ''}`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-sm text-center py-8">{error}</p>
      ) : displayed.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayed.map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              formations={formations}
              onEdit={(s) => setModal({ open: true, editing: s })}
              onCancel={handleCancel}
              onDelete={handleDelete}
              onTogglePublish={handleTogglePublish}
              onSubmitForReview={handleSubmitForReview}
              onOpenReview={setReviewTarget}
            />
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

      {modal.open && (
        <SessionModal
          editing={modal.editing}
          formations={formations}
          onClose={() => setModal({ open: false, editing: null })}
          onSave={handleSave}
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
