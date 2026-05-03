'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

// Liste des 20 derniers journaux hebdo News (T11). Auth gate déjà gérée par
// src/app/admin/layout.tsx (is_super_admin RPC).

interface JournalListItem {
  id: string
  title: string
  week_iso: string | null
  status: 'draft' | 'published' | 'archived' | string
  duration_s: number | null
  audio_url: string | null
  created_at: string
  updated_at: string | null
  syntheses_count: number
}

function formatDuration(s: number | null): string {
  if (!s) return '—'
  const m = Math.round(s / 60)
  return `${m} min`
}

function statusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case 'draft':
      return { label: 'Brouillon', className: 'bg-gray-200 text-gray-700' }
    case 'published':
      return { label: 'Publié', className: 'bg-green-100 text-green-700' }
    case 'archived':
      return { label: 'Archivé', className: 'bg-red-100 text-red-700' }
    default:
      return { label: status, className: 'bg-gray-200 text-gray-700' }
  }
}

export default function AdminJournalListPage() {
  const [items, setItems] = useState<JournalListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/admin/news/journal')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body?.error ?? `HTTP ${res.status}`)
        }
        return res.json() as Promise<{ data: JournalListItem[] }>
      })
      .then((payload) => {
        if (!cancelled) setItems(payload.data ?? [])
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Erreur inconnue')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Journal hebdo</h1>
          <p className="text-sm text-gray-600 mt-1">
            Composer le journal de la semaine dentaire (3 à 6 synthèses).
          </p>
        </div>
        <Link
          href="/admin/news/journal/new"
          className="bg-[#2D1B96] hover:bg-[#231575] text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
        >
          + Créer le journal de la semaine
        </Link>
      </div>

      {loading && (
        <div className="bg-white rounded-2xl shadow-sm p-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2D1B96]" />
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm p-12 text-center">
          <p className="text-gray-500 text-sm">
            Aucun journal pour le moment. Cliquez sur « Créer le journal de la
            semaine » pour démarrer.
          </p>
        </div>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Semaine</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Articles</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Durée</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Statut</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-700">Créé le</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((j) => {
                const badge = statusBadge(j.status)
                return (
                  <tr key={j.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-gray-800">{j.week_iso ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{j.syntheses_count}</td>
                    <td className="px-4 py-3 text-gray-700">{formatDuration(j.duration_s)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(j.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/news/journal/${j.id}`}
                        className="text-[#2D1B96] hover:underline font-medium"
                      >
                        Ouvrir →
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
