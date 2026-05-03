'use client'

import { useEffect, useState } from 'react'
import {
  Users,
  CheckCircle2,
  Headphones,
  Trophy,
  BarChart3,
} from 'lucide-react'

interface Analytics {
  active_members: number
  avg_completion_percent: number
  total_audio_sessions: number
  total_points: number
}

export default function TenantDashboardPage() {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/tenant/analytics')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
        if (!cancelled) setData(json as Analytics)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Erreur de chargement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Tableau de bord</h1>
      <p className="text-gray-600 mb-8">
        Vue agrégée de l'activité — aucune donnée nominative.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 mb-6">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--tenant-primary)]" />
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              icon={Users}
              label="Membres actifs"
              value={data.active_members.toLocaleString('fr-FR')}
            />
            <MetricCard
              icon={CheckCircle2}
              label="Taux de complétion moyen"
              value={`${data.avg_completion_percent}%`}
            />
            <MetricCard
              icon={Headphones}
              label="Sessions audio totales"
              value={data.total_audio_sessions.toLocaleString('fr-FR')}
            />
            <MetricCard
              icon={Trophy}
              label="Points distribués"
              value={data.total_points.toLocaleString('fr-FR')}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Graphique disponible en V2</p>
          </div>
        </>
      ) : null}
    </div>
  )
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
}) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-3 mb-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ backgroundColor: 'var(--tenant-primary)' }}
        >
          <Icon className="w-5 h-5" />
        </div>
        <p className="text-sm font-medium text-gray-600">{label}</p>
      </div>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
