'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Star, Filter, Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { createClient } from '@/lib/supabase/client'
import { downloadCsv } from '@/lib/utils/csvExport'
import {
  SatisfactionAggregatesTable,
  type Aggregate,
} from '@/components/admin/satisfaction/SatisfactionAggregatesTable'
import {
  VerbatimCard,
  type Verbatim,
} from '@/components/admin/satisfaction/VerbatimCard'

interface FormationOption {
  id: string
  title: string
}

function dateFromInput(value: string, endOfDay = false): string | null {
  if (!value) return null
  const suffix = endOfDay ? 'T23:59:59' : 'T00:00:00'
  const d = new Date(value + suffix)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString()
}

export default function AdminSatisfactionPage() {
  const [formations, setFormations] = useState<FormationOption[]>([])
  const [aggregates, setAggregates] = useState<Aggregate[]>([])
  const [verbatims, setVerbatims] = useState<Verbatim[]>([])

  const [filterFormationId, setFilterFormationId] = useState<string | null>(null)
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [onlyWithText, setOnlyWithText] = useState(false)
  const [onlyLowScore, setOnlyLowScore] = useState(false)

  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dateRange = useMemo(
    () => ({
      from: dateFromInput(filterDateFrom, false),
      to: dateFromInput(filterDateTo, true),
    }),
    [filterDateFrom, filterDateTo]
  )

  // Load formations once for the filter dropdown
  useEffect(() => {
    const loadFormations = async () => {
      const supabase = createClient()
      const { data, error: err } = await supabase
        .from('formations')
        .select('id, title')
        .eq('axe_cp', 1)
        .order('title')
      if (err) {
        console.error('Erreur chargement formations:', err)
        return
      }
      setFormations((data || []) as FormationOption[])
    }
    loadFormations()
  }, [])

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const [aggRes, verbRes] = await Promise.all([
        supabase.rpc('get_admin_satisfaction_aggregates', {
          p_formation_id: filterFormationId,
          p_date_from: dateRange.from,
          p_date_to: dateRange.to,
        }),
        supabase.rpc('get_admin_satisfaction_verbatims', {
          p_formation_id: filterFormationId,
          p_date_from: dateRange.from,
          p_date_to: dateRange.to,
          p_only_with_text: onlyWithText,
          p_only_low_score: onlyLowScore,
        }),
      ])

      if (aggRes.error) throw aggRes.error
      if (verbRes.error) throw verbRes.error

      setAggregates((aggRes.data || []) as Aggregate[])
      setVerbatims((verbRes.data || []) as Verbatim[])
    } catch (err: any) {
      console.error('Erreur chargement satisfaction:', err)
      setError(err.message || 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [filterFormationId, dateRange.from, dateRange.to, onlyWithText, onlyLowScore])

  // Debounced refetch on filter changes
  useEffect(() => {
    const t = setTimeout(reload, 250)
    return () => clearTimeout(t)
  }, [reload])

  const handleExportCsv = async () => {
    setExporting(true)
    try {
      const supabase = createClient()
      const { data, error: err } = await supabase.rpc('get_admin_satisfaction_export', {
        p_formation_id: filterFormationId,
        p_date_from: dateRange.from,
        p_date_to: dateRange.to,
      })

      if (err) {
        alert('Erreur export : ' + err.message)
        return
      }

      const today = new Date().toISOString().split('T')[0]
      downloadCsv(`satisfaction_dentalschool_${today}.csv`, (data || []) as Record<string, any>[], [
        { key: 'response_date', label: 'Date' },
        { key: 'formation_title', label: 'Formation' },
        { key: 'rating_overall', label: 'Note globale' },
        { key: 'rating_content', label: 'Note contenu' },
        { key: 'rating_pedagogy', label: 'Note pédagogie' },
        { key: 'rating_ergonomics', label: 'Note ergonomie' },
        { key: 'rating_avg', label: 'Moyenne' },
        { key: 'would_recommend', label: 'Recommande' },
        { key: 'strong_points', label: 'Points forts' },
        { key: 'improvement_points', label: 'Points à améliorer' },
        { key: 'free_comment', label: 'Commentaire libre' },
      ])
    } finally {
      setExporting(false)
    }
  }

  const resetFilters = () => {
    setFilterFormationId(null)
    setFilterDateFrom('')
    setFilterDateTo('')
    setOnlyWithText(false)
    setOnlyLowScore(false)
  }

  const hasActiveFilters =
    filterFormationId !== null ||
    filterDateFrom !== '' ||
    filterDateTo !== '' ||
    onlyWithText ||
    onlyLowScore

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Star className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Satisfaction</h1>
            <p className="text-sm text-gray-500">
              Indicateur Qualiopi #30 — Recueil et exploitation des appréciations stagiaires
            </p>
          </div>
        </div>
      </header>

      {/* Filters */}
      <section className="bg-white rounded-2xl shadow-xl p-5">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-gray-500 font-semibold mb-3">
          <Filter className="w-3.5 h-3.5" />
          Filtres
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Formation</label>
            <select
              value={filterFormationId ?? ''}
              onChange={(e) => setFilterFormationId(e.target.value || null)}
              className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">Toutes les formations</option>
              {formations.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Du</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Au</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="md"
              onClick={handleExportCsv}
              loading={exporting}
              className="flex-1"
            >
              <Download size={14} />
              Export CSV
            </Button>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="px-3 py-2 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>
      </section>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Section A — Aggregates */}
      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Récapitulatif par formation</h2>
            <p className="text-xs text-gray-500">Moyennes des notes, taux de recommandation et retours à froid.</p>
          </div>
        </div>
        <SatisfactionAggregatesTable rows={aggregates} loading={loading} />
      </section>

      {/* Section B — Verbatims */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Verbatims des répondants</h2>
            <p className="text-xs text-gray-500">
              Réponses pseudonymisées. L'identification d'un répondant est tracée RGPD.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-full cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyWithText}
                onChange={(e) => setOnlyWithText(e.target.checked)}
                className="accent-primary"
              />
              Avec verbatim seulement
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-gray-700 bg-white border border-gray-200 px-3 py-1.5 rounded-full cursor-pointer select-none">
              <input
                type="checkbox"
                checked={onlyLowScore}
                onChange={(e) => setOnlyLowScore(e.target.checked)}
                className="accent-primary"
              />
              Score bas / non recommandé
            </label>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : verbatims.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-xl p-12 text-center text-gray-500">
            Aucune réponse pour cette période.
          </div>
        ) : (
          <div className="space-y-4">
            {verbatims.map((v) => (
              <VerbatimCard key={v.survey_id} verbatim={v} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
