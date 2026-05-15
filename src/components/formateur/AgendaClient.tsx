'use client'

import { useCallback, useEffect, useState } from 'react'
import { Calendar, MapPin, ExternalLink, Plus, Pencil, Trash2, X, AlertTriangle } from 'lucide-react'
import { LiveEventSchema, type LiveEventPayload } from '@/lib/schemas/live-event'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import type { FormateurFormation } from '@/lib/auth/rbac'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LiveEvent {
  id: string
  title: string
  description: string | null
  location_city: string
  location_venue: string | null
  starts_at: string
  ends_at: string | null
  external_registration_url: string | null
  capacity: number | null
  is_published: boolean
  formation_id: string | null
  created_at: string
  updated_at: string
}

interface FormField {
  title: string
  description: string
  location_city: string
  location_venue: string
  starts_at: string
  ends_at: string
  external_registration_url: string
  capacity: string
  formation_id: string
  is_published: boolean
}

const EMPTY_FORM: FormField = {
  title: '',
  description: '',
  location_city: '',
  location_venue: '',
  starts_at: '',
  ends_at: '',
  external_registration_url: '',
  capacity: '',
  formation_id: '',
  is_published: false,
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEventDate(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function formatEventTime(isoDate: string): string {
  return new Date(isoDate).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

// Convertit une date ISO en valeur pour datetime-local input (YYYY-MM-DDTHH:MM)
function toDatetimeLocal(isoDate: string): string {
  const d = new Date(isoDate)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Convertit datetime-local en ISO avec timezone locale
function fromDatetimeLocal(val: string): string {
  return new Date(val).toISOString()
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function EventCard({
  event,
  formations,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  event: LiveEvent
  formations: FormateurFormation[]
  onEdit: (event: LiveEvent) => void
  onDelete: (event: LiveEvent) => void
  onTogglePublish: (event: LiveEvent) => void
}) {
  const formation = formations.find((f) => f.id === event.formation_id)

  return (
    <Card variant="flat" className="p-5 flex flex-col gap-3 shadow-sm">
      {/* Date + ville */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[#2D1B96] text-sm font-semibold mb-0.5">
            <Calendar size={14} />
            <span className="capitalize">{formatEventDate(event.starts_at)}</span>
            <span className="font-normal text-gray-500">
              {formatEventTime(event.starts_at)}
              {event.ends_at && ` – ${formatEventTime(event.ends_at)}`}
            </span>
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-xs">
            <MapPin size={12} />
            <span>
              {event.location_city}
              {event.location_venue && ` · ${event.location_venue}`}
            </span>
          </div>
        </div>

        {/* Badge statut */}
        <Badge variant={event.is_published ? 'success' : 'neutral'}>
          {event.is_published ? 'Publié' : 'Brouillon'}
        </Badge>
      </div>

      {/* Titre */}
      <h3 className="text-base font-bold text-gray-900 leading-snug">{event.title}</h3>

      {/* Badge formation */}
      {formation && (
        <span className="self-start text-xs bg-[#EDE9FF] text-[#2D1B96] font-medium px-2.5 py-1 rounded-full">
          {formation.title}
        </span>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-gray-100">
        <Button variant="ghost" size="sm" onClick={() => onEdit(event)} className="flex items-center gap-1.5">
          <Pencil size={14} />
          Éditer
        </Button>
        <button
          onClick={() => onTogglePublish(event)}
          className={`flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg transition-colors ${
            event.is_published
              ? 'text-orange-600 hover:bg-orange-50'
              : 'text-[#2D1B96] hover:bg-[#EDE9FF]'
          }`}
        >
          {event.is_published ? 'Dépublier' : 'Publier'}
        </button>
        <button
          onClick={() => onDelete(event)}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors ml-auto"
        >
          <Trash2 size={14} />
          Supprimer
        </button>
      </div>
    </Card>
  )
}

function EmptyState({ tab }: { tab: 'upcoming' | 'past' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-[#EDE9FF] flex items-center justify-center mb-4">
        <Calendar size={28} className="text-[#2D1B96]" />
      </div>
      <p className="text-gray-900 font-semibold mb-1">
        {tab === 'upcoming' ? 'Aucun événement à venir' : 'Aucun événement passé'}
      </p>
      <p className="text-gray-500 text-sm">
        {tab === 'upcoming'
          ? 'Créez votre première date !'
          : 'Vos événements passés apparaîtront ici.'}
      </p>
    </div>
  )
}

// ─── Modale formulaire ────────────────────────────────────────────────────────

function EventModal({
  editing,
  formations,
  onClose,
  onSave,
}: {
  editing: LiveEvent | null
  formations: FormateurFormation[]
  onClose: () => void
  onSave: (payload: LiveEventPayload) => Promise<void>
}) {
  const [form, setForm] = useState<FormField>(() => {
    if (!editing) return EMPTY_FORM
    return {
      title: editing.title,
      description: editing.description ?? '',
      location_city: editing.location_city,
      location_venue: editing.location_venue ?? '',
      starts_at: editing.starts_at ? toDatetimeLocal(editing.starts_at) : '',
      ends_at: editing.ends_at ? toDatetimeLocal(editing.ends_at) : '',
      external_registration_url: editing.external_registration_url ?? '',
      capacity: editing.capacity != null ? String(editing.capacity) : '',
      formation_id: editing.formation_id ?? '',
      is_published: editing.is_published,
    }
  })

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const isPastDate = form.starts_at && new Date(form.starts_at) < new Date()

  function setField<K extends keyof FormField>(key: K, value: FormField[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setFieldErrors((prev) => ({ ...prev, [key]: '' }))
  }

  async function handleSubmit(publishOverride: boolean) {
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || null,
      location_city: form.location_city,
      location_venue: form.location_venue || null,
      starts_at: form.starts_at ? fromDatetimeLocal(form.starts_at) : '',
      ends_at: form.ends_at ? fromDatetimeLocal(form.ends_at) : null,
      external_registration_url: form.external_registration_url || null,
      capacity: form.capacity ? parseInt(form.capacity, 10) : null,
      formation_id: form.formation_id || null,
      is_published: publishOverride,
    }

    const parsed = LiveEventSchema.safeParse(payload)
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
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-900">
            {editing ? "Modifier l’événement" : 'Nouvelle date présentielle'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Bandeau warning date passée */}
        {isPastDate && (
          <div className="mx-5 mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-sm">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              Cette date est passée — l'événement sera masqué du calendrier public.
            </span>
          </div>
        )}

        {/* Formulaire */}
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
              placeholder="Ex : Formation parodontologie avancée"
              className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 ${
                fieldErrors.title ? 'border-red-400' : 'border-gray-300'
              }`}
            />
            {fieldErrors.title && (
              <p className="text-red-500 text-xs mt-1">{fieldErrors.title}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={3}
              placeholder="Programme, objectifs pédagogiques…"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 resize-none"
            />
          </div>

          {/* Ville + Lieu */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Ville <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.location_city}
                onChange={(e) => setField('location_city', e.target.value)}
                maxLength={120}
                placeholder="Paris"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 ${
                  fieldErrors.location_city ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {fieldErrors.location_city && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors.location_city}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Lieu / Salle
              </label>
              <input
                type="text"
                value={form.location_venue}
                onChange={(e) => setField('location_venue', e.target.value)}
                maxLength={200}
                placeholder="Hôtel Marriott, salle A"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
              />
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Début <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setField('starts_at', e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 ${
                  fieldErrors.starts_at ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {fieldErrors.starts_at && (
                <p className="text-red-500 text-xs mt-1">{fieldErrors.starts_at}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Fin (facultatif)
              </label>
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setField('ends_at', e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
              />
            </div>
          </div>

          {/* Formation liée */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Formation Dentalschool liée
            </label>
            <select
              value={form.formation_id}
              onChange={(e) => setField('formation_id', e.target.value)}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 bg-white"
            >
              <option value="">Aucune formation liée</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>

          {/* URL d'inscription + Capacité */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                URL d'inscription externe
              </label>
              <input
                type="url"
                value={form.external_registration_url}
                onChange={(e) => setField('external_registration_url', e.target.value)}
                placeholder="https://..."
                className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 ${
                  fieldErrors.external_registration_url ? 'border-red-400' : 'border-gray-300'
                }`}
              />
              {fieldErrors.external_registration_url && (
                <p className="text-red-500 text-xs mt-1">
                  {fieldErrors.external_registration_url}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Capacité max
              </label>
              <input
                type="number"
                value={form.capacity}
                onChange={(e) => setField('capacity', e.target.value)}
                min={1}
                placeholder="Ex : 20"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
              />
            </div>
          </div>

          {/* Erreur globale */}
          {submitError && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {submitError}
            </p>
          )}
        </div>

        {/* Footer boutons */}
        <div className="p-5 border-t border-gray-200 flex flex-col sm:flex-row gap-2 sticky bottom-0 bg-white">
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting} className="flex-1">
            Annuler
          </Button>
          <button
            onClick={() => handleSubmit(false)}
            disabled={submitting}
            className="flex-1 py-2.5 rounded-xl border border-[#2D1B96] text-sm font-semibold text-[#2D1B96] hover:bg-[#EDE9FF] transition-colors disabled:opacity-50"
          >
            {submitting ? 'Enregistrement…' : 'Enregistrer en brouillon'}
          </button>
          <Button variant="primary" size="md" onClick={() => handleSubmit(true)} disabled={submitting} className="flex-1">
            {submitting ? 'Publication…' : 'Publier'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function AgendaClient() {
  const [upcoming, setUpcoming] = useState<LiveEvent[]>([])
  const [past, setPast] = useState<LiveEvent[]>([])
  const [formations, setFormations] = useState<FormateurFormation[]>([])
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [modal, setModal] = useState<{ open: boolean; editing: LiveEvent | null }>({
    open: false,
    editing: null,
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [toastError, setToastError] = useState<string | null>(null)

  // Chargement initial
  useEffect(() => {
    async function load() {
      try {
        const [evRes, fRes] = await Promise.all([
          fetch('/api/formateur/events'),
          fetch('/api/formateur/formations'),
        ])

        if (evRes.ok) {
          const data = await evRes.json()
          setUpcoming(data.upcoming ?? [])
          setPast(data.past ?? [])
        } else {
          setError('Impossible de charger les événements.')
        }

        if (fRes.ok) {
          const data = await fRes.json()
          setFormations(data ?? [])
        }
      } catch {
        setError('Erreur de connexion.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Rechargement après sauvegarde
  const reloadEvents = useCallback(async () => {
    const res = await fetch('/api/formateur/events')
    if (res.ok) {
      const data = await res.json()
      setUpcoming(data.upcoming ?? [])
      setPast(data.past ?? [])
    }
  }, [])

  function showToastError(msg: string) {
    setToastError(msg)
    setTimeout(() => setToastError(null), 5000)
  }

  async function handleSave(payload: LiveEventPayload) {
    const editing = modal.editing
    const url = editing ? `/api/formateur/events/${editing.id}` : '/api/formateur/events'
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
    await reloadEvents()
  }

  async function handleDelete(event: LiveEvent) {
    if (!confirm(`Supprimer "${event.title}" ?`)) return

    const res = await fetch(`/api/formateur/events/${event.id}`, { method: 'DELETE' })

    if (res.status === 409) {
      showToastError('Dépubliez cet événement avant de le supprimer.')
      return
    }
    if (!res.ok) {
      showToastError('Erreur lors de la suppression.')
      return
    }

    await reloadEvents()
  }

  async function handleTogglePublish(event: LiveEvent) {
    const res = await fetch(`/api/formateur/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_published: !event.is_published }),
    })

    if (!res.ok) {
      showToastError('Impossible de modifier le statut.')
      return
    }

    await reloadEvents()
  }

  const displayed = tab === 'upcoming' ? upcoming : past

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Agenda des formations</h1>
          <p className="text-gray-600 mt-1">
            Gérez vos dates de formations présentielles
          </p>
        </div>
        <Button variant="primary" size="md" onClick={() => setModal({ open: true, editing: null })} className="flex items-center gap-2 shrink-0">
          <Plus size={16} />
          Nouvelle date
        </Button>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-3 px-1 mr-5 text-sm font-semibold border-b-2 transition-colors ${
              tab === t
                ? 'border-[#2D1B96] text-[#2D1B96]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'upcoming'
              ? `À venir${upcoming.length > 0 ? ` (${upcoming.length})` : ''}`
              : `Passés${past.length > 0 ? ` (${past.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* Contenu */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-3 border-[#2D1B96] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <p className="text-red-500 text-sm text-center py-8">{error}</p>
      ) : displayed.length === 0 ? (
        <EmptyState tab={tab} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {displayed.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              formations={formations}
              onEdit={(e) => setModal({ open: true, editing: e })}
              onDelete={handleDelete}
              onTogglePublish={handleTogglePublish}
            />
          ))}
        </div>
      )}

      {/* Toast erreur */}
      {toastError && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg flex items-center gap-2">
          <AlertTriangle size={16} />
          {toastError}
        </div>
      )}

      {/* Modale */}
      {modal.open && (
        <EventModal
          editing={modal.editing}
          formations={formations}
          onClose={() => setModal({ open: false, editing: null })}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
