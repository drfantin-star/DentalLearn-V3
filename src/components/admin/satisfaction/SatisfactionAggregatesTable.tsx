'use client'

import { Loader2 } from 'lucide-react'

export interface Aggregate {
  formation_id: string
  formation_title: string
  total_responses: number
  rating_overall_avg: number | null
  rating_content_avg: number | null
  rating_pedagogy_avg: number | null
  rating_ergonomics_avg: number | null
  satisfaction_avg: number | null
  recommendation_pct: number | null
  cold_responses: number
  cold_applied_avg: number | null
  cold_still_recommend_pct: number | null
  last_updated: string | null
}

interface Props {
  rows: Aggregate[]
  loading: boolean
}

function formatNumber(n: number | null, digits = 2): string {
  if (n === null || n === undefined) return '—'
  return Number(n).toFixed(digits)
}

function formatPct(n: number | null): string {
  if (n === null || n === undefined) return '—'
  return `${Math.round(Number(n))}%`
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

function recommendationClass(pct: number | null): string {
  if (pct === null || pct === undefined) return 'text-gray-400'
  if (pct < 60) return 'text-red-600 font-bold'
  if (pct < 80) return 'text-orange-600 font-semibold'
  return 'text-green-700 font-semibold'
}

function MiniBar({ value }: { value: number | null }) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, (Number(value) / 5) * 100))
  return (
    <div className="w-20 h-2 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: '#2D1B96' }}
      />
    </div>
  )
}

export function SatisfactionAggregatesTable({ rows, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-[#2D1B96]" />
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">
        Aucune donnée pour les filtres actuels.
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Formation</th>
              <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Réponses</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Note moy. /5</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Détail (G / C / P / E)</th>
              <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Recommande</th>
              <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Réponses froid</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Application moy.</th>
              <th className="px-4 py-3 font-semibold text-right whitespace-nowrap">Toujours reco</th>
              <th className="px-4 py-3 font-semibold whitespace-nowrap">Dernière réponse</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((r) => {
              const empty = r.total_responses === 0
              return (
                <tr key={r.formation_id} className={empty ? 'text-gray-400' : 'text-gray-800'}>
                  <td className="px-4 py-3 font-medium max-w-xs">
                    <div className="truncate" title={r.formation_title}>
                      {r.formation_title}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.total_responses}</td>
                  <td className="px-4 py-3">
                    {empty ? (
                      <span className="text-xs italic">Pas de données</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <MiniBar value={r.satisfaction_avg} />
                        <span className="tabular-nums text-xs font-semibold text-gray-700">
                          {formatNumber(r.satisfaction_avg)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 tabular-nums text-xs"
                    title="Globale / Contenu / Pédagogie / Ergonomie"
                  >
                    {empty
                      ? '—'
                      : `${formatNumber(r.rating_overall_avg, 1)} / ${formatNumber(r.rating_content_avg, 1)} / ${formatNumber(r.rating_pedagogy_avg, 1)} / ${formatNumber(r.rating_ergonomics_avg, 1)}`}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${empty ? '' : recommendationClass(r.recommendation_pct)}`}
                  >
                    {empty ? '—' : formatPct(r.recommendation_pct)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.cold_responses}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.cold_responses === 0 ? (
                      <span className="text-xs text-gray-400">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <MiniBar value={r.cold_applied_avg} />
                        <span className="tabular-nums text-xs font-semibold text-gray-700">
                          {formatNumber(r.cold_applied_avg)}
                        </span>
                      </div>
                    )}
                  </td>
                  <td
                    className={`px-4 py-3 text-right tabular-nums ${
                      r.cold_responses === 0 ? 'text-gray-400' : recommendationClass(r.cold_still_recommend_pct)
                    }`}
                  >
                    {r.cold_responses === 0 ? '—' : formatPct(r.cold_still_recommend_pct)}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDate(r.last_updated)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SatisfactionAggregatesTable
