'use client'

import { useEffect, useState, useCallback } from 'react'
import { Trash2, Loader2, RefreshCw, Undo2, AlertCircle, CheckCircle } from 'lucide-react'

interface PendingDeletion {
  user_id: string
  email: string
  requested_at: string
  purge_at: string
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })

/**
 * Onglet Utilisateurs — surveillance RGPD des suppressions de compte en attente.
 * Lecture et annulation via /api/admin/deletions (service_role), jamais depuis
 * le navigateur directement.
 */
export default function PendingDeletionsPanel() {
  const [deletions, setDeletions] = useState<PendingDeletion[]>([])
  const [loading, setLoading] = useState(true)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/deletions')
      if (!res.ok) throw new Error()
      const data = await res.json()
      setDeletions(data.deletions || [])
    } catch {
      setMessage({ type: 'error', text: 'Impossible de charger les suppressions en attente' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleCancel = async (userId: string) => {
    setCancelling(userId)
    setMessage(null)
    try {
      const res = await fetch('/api/admin/deletions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId }),
      })
      if (!res.ok) throw new Error()
      setDeletions((prev) => prev.filter((d) => d.user_id !== userId))
      setMessage({ type: 'success', text: 'Suppression annulée' })
    } catch {
      setMessage({ type: 'error', text: "Erreur lors de l'annulation" })
    } finally {
      setCancelling(null)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  return (
    <section className="mb-8">
      <div className="mb-4 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-50 rounded-xl">
            <Trash2 className="w-6 h-6 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Suppressions de compte en attente</h2>
            <p className="text-sm text-gray-600">Demandes RGPD, purge automatique à J+30</p>
          </div>
        </div>
        <button
          onClick={load}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </button>
      </div>

      {message && (
        <div
          className={`mb-4 p-4 rounded-xl flex items-center gap-3 ${
            message.type === 'success'
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message.type === 'success' ? (
            <CheckCircle className="w-5 h-5 text-green-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-red-600" />
          )}
          {message.text}
        </div>
      )}

      {/* Compteur */}
      <div className="mb-4 bg-white rounded-xl shadow-md p-5 inline-flex items-center gap-3">
        <div className="p-2 bg-red-100 rounded-lg">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <p className="text-sm text-gray-600">Suppressions en attente</p>
          <p className="text-2xl font-bold text-red-600">{loading ? '—' : deletions.length}</p>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date de demande
                </th>
                <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date de purge prévue
                </th>
                <th className="px-6 py-4 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <Loader2 className="w-5 h-5 animate-spin inline" />
                  </td>
                </tr>
              ) : deletions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    Aucune suppression en attente
                  </td>
                </tr>
              ) : (
                deletions.map((d) => (
                  <tr key={d.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <span className="font-medium text-gray-900">
                        {d.email || `ID: ${d.user_id.substring(0, 8)}...`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-600">{formatDate(d.requested_at)}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                        {formatDate(d.purge_at)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => handleCancel(d.user_id)}
                        disabled={cancelling === d.user_id}
                        className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors bg-gray-700 text-white hover:bg-gray-800 ${
                          cancelling === d.user_id ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {cancelling === d.user_id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Undo2 className="w-4 h-4" />
                        )}
                        Annuler la suppression
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
