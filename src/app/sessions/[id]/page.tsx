'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Video, Users, Clock, ExternalLink, AlertTriangle } from 'lucide-react'
import {
  computeSessionStatus,
  computeSessionStatusLabel,
  computeCanJoin,
  type SessionStatus,
} from '@/lib/utils/session-status'
import AddToCalendarButton from '@/components/AddToCalendarButton'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  formateur_user_id: string
  registration_count: number
}

interface PageState {
  session: LiveSession | null
  userRegistrationId: string | null
  loading: boolean
  error: string | null
}

// ─── Helpers UI ───────────────────────────────────────────────────────────────

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

const STATUS_CLASSES: Record<SessionStatus, string> = {
  scheduled: 'bg-gray-100 text-gray-600',
  live: 'bg-red-100 text-red-700 animate-pulse',
  ended: 'bg-green-100 text-green-700',
  cancelled: 'bg-orange-100 text-orange-700',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [state, setState] = useState<PageState>({
    session: null,
    userRegistrationId: null,
    loading: true,
    error: null,
  })
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  function showToast(text: string, type: 'success' | 'error' = 'success') {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/sessions/${id}`)
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setState((s) => ({ ...s, loading: false, error: body.error ?? 'Session introuvable' }))
        return
      }
      const data = await res.json()
      setState({
        session: data.session,
        userRegistrationId: data.user_registration_id ?? null,
        loading: false,
        error: null,
      })
    } catch {
      setState((s) => ({ ...s, loading: false, error: 'Erreur de connexion.' }))
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Rafraîchissement du statut calculé toutes les 30s (live / canJoin peuvent changer)
  useEffect(() => {
    const timer = setInterval(() => {
      setState((s) => ({ ...s })) // force re-render pour recalculer statut
    }, 30_000)
    return () => clearInterval(timer)
  }, [])

  async function handleRegister() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/sessions/${id}/register`, { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error ?? "Erreur lors de l'inscription", 'error')
        return
      }
      showToast('Inscription confirmée !')
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnregister() {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/sessions/${id}/register`, { method: 'DELETE' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        showToast(body.error ?? 'Erreur lors de la désinscription', 'error')
        return
      }
      showToast('Désinscription effectuée.', 'error')
      await load()
    } finally {
      setActionLoading(false)
    }
  }

  const { session, userRegistrationId, loading, error } = state

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertTriangle size={40} className="mx-auto mb-4 text-red-400" />
          <p className="text-gray-700 font-semibold">{error ?? 'Session introuvable'}</p>
        </div>
      </div>
    )
  }

  const computedStatus = computeSessionStatus(session)
  const statusLabel = computeSessionStatusLabel(session)
  const isRegistered = userRegistrationId !== null
  const canJoin = computeCanJoin(session, isRegistered)
  const isFull = session.capacity != null && session.registration_count >= session.capacity
  const endsAt = new Date(new Date(session.starts_at).getTime() + session.duration_min * 60_000).toISOString()

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 text-primary">
              <Video size={20} />
              <span className="text-sm font-semibold">Masterclass live</span>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_CLASSES[computedStatus]}`}>
              {statusLabel}
            </span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-4">{session.title}</h1>

          <div className="space-y-2 text-sm text-gray-600">
            <div className="capitalize font-medium text-gray-800">
              {formatSessionDate(session.starts_at)} à {formatSessionTime(session.starts_at)}
            </div>
            <div className="flex items-center gap-1.5">
              <Clock size={14} />
              <span>Durée : {session.duration_min} min</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users size={14} />
              <span>
                {session.registration_count} inscrit{session.registration_count !== 1 ? 's' : ''}
                {session.capacity != null && ` · ${session.capacity} places max`}
              </span>
            </div>
          </div>

          {session.description && (
            <p className="mt-4 text-sm text-gray-700 leading-relaxed">{session.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
          {computedStatus === 'cancelled' && (
            <div className="flex items-center gap-2 text-orange-700 bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm font-medium">
              <AlertTriangle size={16} />
              Cette session a été annulée.
            </div>
          )}

          {computedStatus === 'ended' && (
            <div className="text-center py-4">
              <p className="text-gray-500 text-sm font-medium">Cette session est terminée.</p>
            </div>
          )}

          {(computedStatus === 'scheduled' || computedStatus === 'live') && (
            <>
              {/* Bouton Rejoindre — visible si computeCanJoin */}
              {canJoin && session.zoom_url && (
                <a
                  href={session.zoom_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
                >
                  <ExternalLink size={16} />
                  Rejoindre la session →
                  {session.zoom_password && (
                    <span className="text-red-200 text-xs ml-1">(mdp : {session.zoom_password})</span>
                  )}
                </a>
              )}

              {/* Bouton inscription / désinscription */}
              {isRegistered ? (
                computedStatus === 'scheduled' ? (
                  <button
                    onClick={handleUnregister}
                    disabled={actionLoading}
                    className="w-full py-3 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? 'Traitement…' : 'Se désinscrire'}
                  </button>
                ) : (
                  <p className="text-center text-sm text-gray-500">Vous êtes inscrit à cette session.</p>
                )
              ) : isFull ? (
                <button
                  disabled
                  className="w-full py-3 rounded-xl bg-gray-200 text-sm font-semibold text-gray-500 cursor-not-allowed"
                >
                  Session complète
                </button>
              ) : (
                <button
                  onClick={handleRegister}
                  disabled={actionLoading}
                  className="w-full py-3 rounded-xl bg-primary text-sm font-semibold text-white hover:bg-[#1e1268] transition-colors disabled:opacity-50"
                >
                  {actionLoading ? 'Traitement…' : "S'inscrire"}
                </button>
              )}
            </>
          )}

          {/* AddToCalendarButton — placeholder V1 */}
          {computedStatus !== 'cancelled' && computedStatus !== 'ended' && (
            <div className="flex justify-center pt-1">
              <AddToCalendarButton
                title={session.title}
                starts_at={session.starts_at}
                ends_at={endsAt}
                description={session.description ?? undefined}
              />
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-50 text-white text-sm font-semibold px-5 py-3 rounded-2xl shadow-lg ${
            toast.type === 'success' ? 'bg-green-600' : 'bg-red-600'
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  )
}
