'use client'

import { useEffect, useState } from 'react'
import { X, Download, Loader2, Users } from 'lucide-react'
import Badge from '@/components/ui/Badge'

interface Registration {
  id: string
  name: string | null
  email: string | null
  registered_at: string
  cancelled_at: string | null
}

interface RegistrationsData {
  session: { id: string; title: string; capacity: number | null }
  registrations: Registration[]
  registration_count: number
}

interface RegistrationsPanelProps {
  sessionId: string
  sessionTitle: string
  onClose: () => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function csvEscape(value: string): string {
  if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function exportCsv(data: RegistrationsData) {
  const header = ['Nom', 'Email', "Date d'inscription", 'Statut']
  const rows = data.registrations.map((r) => [
    r.name ?? '',
    r.email ?? '',
    formatDate(r.registered_at),
    r.cancelled_at ? 'Annulée' : 'Active',
  ])
  const csv = [header, ...rows].map((row) => row.map(csvEscape).join(';')).join('\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `inscrits-${data.session.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// Panneau détail (lecture seule) des inscrits à une masterclass — pas de
// gestion manuelle des inscriptions dans ce ticket. Émargement/présence
// (attended, attended_duration_sec) hors scope, non affiché.
export default function RegistrationsPanel({ sessionId, sessionTitle, onClose }: RegistrationsPanelProps) {
  const [data, setData] = useState<RegistrationsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(`/api/admin/masterclass/${sessionId}/registrations`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error ?? 'Erreur serveur')
        }
        return res.json()
      })
      .then((json: RegistrationsData) => { if (!cancelled) setData(json) })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Erreur inattendue') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [sessionId])

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full md:max-w-xl rounded-t-2xl md:rounded-2xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Inscrits</h2>
            <p className="text-sm text-gray-500 truncate max-w-xs">{sessionTitle}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-gray-100 transition-colors" aria-label="Fermer">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={28} />
            </div>
          ) : error ? (
            <p className="text-red-500 text-sm text-center py-8">{error}</p>
          ) : data ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                  <Users size={16} />
                  {data.registration_count}
                  {data.session.capacity != null ? ` / ${data.session.capacity} places` : ' inscrits'}
                </span>
                <button
                  onClick={() => exportCsv(data)}
                  disabled={data.registrations.length === 0}
                  className="flex items-center gap-1.5 text-sm font-semibold text-primary border border-primary rounded-lg px-3 py-1.5 hover:bg-[#EDE9FF] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download size={14} />
                  Exporter CSV
                </button>
              </div>

              {data.registrations.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-8">Aucun inscrit pour le moment.</p>
              ) : (
                <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                  {data.registrations.map((r) => (
                    <div key={r.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{r.name ?? 'Nom inconnu'}</p>
                        <p className="text-xs text-gray-500 truncate">{r.email ?? '—'}</p>
                        <p className="text-xs text-gray-400">{formatDate(r.registered_at)}</p>
                      </div>
                      <Badge variant={r.cancelled_at ? 'danger' : 'success'} size="sm">
                        {r.cancelled_at ? 'Annulée' : 'Active'}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
