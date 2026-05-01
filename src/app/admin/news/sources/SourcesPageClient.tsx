'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Database,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Power,
  PowerOff,
  PlayCircle,
} from 'lucide-react'

export interface SourceRow {
  id: string
  name: string
  type: string
  url: string | null
  active: boolean
  notes: string | null
  last_fetched_at: string | null
  error_count: number
  query: Record<string, unknown> | null
  spe_tags: string[]
  articles_ingeres_30j: number
  articles_eligibles_30j: number
  articles_synthetises_30j: number
}

type StatusKind = 'inactive' | 'error' | 'no_data' | 'active'

interface StatusBadgeInfo {
  kind: StatusKind
  label: string
  cls: string
  rank: number
}

function computeStatus(row: SourceRow): StatusBadgeInfo {
  if (!row.active) {
    return { kind: 'inactive', label: '🔴 Inactif', cls: 'bg-gray-200 text-gray-700', rank: 0 }
  }
  if (row.error_count >= 3) {
    return { kind: 'error', label: '🟠 En erreur', cls: 'bg-orange-100 text-orange-800', rank: 1 }
  }
  if (!row.last_fetched_at) {
    return {
      kind: 'no_data',
      label: '🟡 Sans données',
      cls: 'bg-yellow-100 text-yellow-800',
      rank: 2,
    }
  }
  return { kind: 'active', label: '🟢 Actif', cls: 'bg-emerald-100 text-emerald-700', rank: 3 }
}

interface TestResultState {
  ok: boolean
  articles_found: number
  error?: string
}

export function SourcesPageClient({ initialSources }: { initialSources: SourceRow[] }) {
  const router = useRouter()

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, TestResultState>>({})
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const sortedSources = useMemo(() => {
    // ORDER BY active DESC, last_fetched_at IS NULL DESC, error_count DESC, name ASC.
    // Actifs d'abord ; au sein de chaque groupe, les sources jamais fetchées
    // remontent (NULL = priorité d'attention), puis celles avec le plus
    // d'erreurs consécutives, enfin l'ordre alphabétique.
    return [...initialSources].sort((a, b) => {
      // active DESC : true (1) avant false (0)
      if (a.active !== b.active) return a.active ? -1 : 1
      // last_fetched_at IS NULL DESC : NULL (true) avant non-NULL (false)
      const aNull = a.last_fetched_at == null
      const bNull = b.last_fetched_at == null
      if (aNull !== bNull) return aNull ? -1 : 1
      // error_count DESC
      if (a.error_count !== b.error_count) return b.error_count - a.error_count
      // name ASC
      return a.name.localeCompare(b.name, 'fr')
    })
  }, [initialSources])

  const counts = useMemo(() => {
    let active = 0
    let inactive = 0
    let error = 0
    for (const s of initialSources) {
      const st = computeStatus(s)
      if (st.kind === 'inactive') inactive++
      else if (st.kind === 'error') error++
      else active++
    }
    return { total: initialSources.length, active, inactive, error }
  }, [initialSources])

  const handleTest = async (source: SourceRow) => {
    setTestingId(source.id)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/news/sources/${source.id}/test`, {
        method: 'POST',
      })
      const json = await res.json()
      setTestResults((prev) => ({
        ...prev,
        [source.id]: {
          ok: !!json.ok,
          articles_found: json.articles_found ?? 0,
          error: json.error,
        },
      }))
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [source.id]: { ok: false, articles_found: 0, error: err?.message || 'Erreur réseau' },
      }))
    } finally {
      setTestingId(null)
    }
  }

  const handleToggleActive = async (source: SourceRow) => {
    setTogglingId(source.id)
    setActionError(null)
    try {
      const res = await fetch(`/api/admin/news/sources/${source.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !source.active }),
      })
      const json = await res.json()
      if (!res.ok) {
        setActionError(json.error || 'Erreur lors de la mise à jour')
      } else {
        router.refresh()
      }
    } catch (err: any) {
      setActionError(err?.message || 'Erreur réseau')
    } finally {
      setTogglingId(null)
    }
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-6">
        <Link
          href="/admin/news"
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-[#2D1B96] mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour aux synthèses
        </Link>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2D1B96]/10 flex items-center justify-center">
              <Database className="w-5 h-5 text-[#2D1B96]" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sources d'ingestion</h1>
              <p className="text-sm text-gray-500">
                Catalogue des sources PubMed / RSS / manuelles utilisées par le pipeline news
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D1B96] hover:bg-[#231575] text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Ajouter une source
          </button>
        </div>
      </header>

      {/* Compteurs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Total" value={counts.total} cls="bg-white text-gray-900" />
        <SummaryCard label="Actives" value={counts.active} cls="bg-emerald-50 text-emerald-700" />
        <SummaryCard label="En erreur" value={counts.error} cls="bg-orange-50 text-orange-700" />
        <SummaryCard label="Inactives" value={counts.inactive} cls="bg-gray-100 text-gray-700" />
      </div>

      {actionError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" />
          {actionError}
        </div>
      )}

      {/* Tableau */}
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                <th className="px-4 py-3">Statut</th>
                <th className="px-4 py-3">Nom</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Dernier fetch</th>
                <th className="px-4 py-3 text-center" title="Échecs consécutifs">
                  Erreurs
                </th>
                <th className="px-4 py-3 text-center" title="Articles ingérés sur 30 jours">
                  Ingérés 30j
                </th>
                <th className="px-4 py-3 text-center" title="Score de pertinence ≥ 0.70 sur 30 jours">
                  Éligibles 30j
                </th>
                <th className="px-4 py-3 text-center" title="Synthèses actives sur 30 jours">
                  Synthèses 30j
                </th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedSources.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                    Aucune source configurée.
                  </td>
                </tr>
              ) : (
                sortedSources.map((s) => {
                  const status = computeStatus(s)
                  const result = testResults[s.id]
                  const isTesting = testingId === s.id
                  const isToggling = togglingId === s.id
                  return (
                    <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${status.cls}`}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{s.name}</div>
                        {s.url && (
                          <div className="text-xs text-gray-500 truncate max-w-[260px]" title={s.url}>
                            {s.url}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs font-medium px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 uppercase">
                          {s.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                        {s.last_fetched_at
                          ? new Date(s.last_fetched_at).toLocaleString('fr-FR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-xs font-semibold ${
                            s.error_count >= 3 ? 'text-red-600' : 'text-gray-700'
                          }`}
                        >
                          {s.error_count}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {s.articles_ingeres_30j}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {s.articles_eligibles_30j}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700">
                        {s.articles_synthetises_30j}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2 flex-wrap">
                          {result && (
                            <span
                              className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                                result.ok
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                              title={result.error || ''}
                            >
                              {result.ok ? (
                                <CheckCircle2 className="w-3 h-3" />
                              ) : (
                                <XCircle className="w-3 h-3" />
                              )}
                              {result.ok ? `${result.articles_found} trouvé(s)` : 'Échec'}
                            </span>
                          )}
                          <button
                            onClick={() => handleTest(s)}
                            disabled={isTesting || s.type === 'manual'}
                            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={
                              s.type === 'manual'
                                ? 'Source manuelle : pas de fetch automatique'
                                : 'Tester la source'
                            }
                          >
                            {isTesting ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <PlayCircle className="w-3 h-3" />
                            )}
                            Tester
                          </button>
                          <button
                            onClick={() => handleToggleActive(s)}
                            disabled={isToggling}
                            className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors disabled:opacity-40 ${
                              s.active
                                ? 'border-orange-200 bg-white text-orange-700 hover:bg-orange-50'
                                : 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {isToggling ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : s.active ? (
                              <PowerOff className="w-3 h-3" />
                            ) : (
                              <Power className="w-3 h-3" />
                            )}
                            {s.active ? 'Désactiver' : 'Réactiver'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <CreateSourceModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function SummaryCard({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className={`rounded-2xl shadow-sm p-4 ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  )
}

// ---------- Modal de création ----------

interface CreateFormState {
  name: string
  type: 'rss' | 'pubmed'
  url: string
  term: string
  reldate: string
  notes: string
}

const INITIAL_CREATE: CreateFormState = {
  name: '',
  type: 'rss',
  url: '',
  term: '',
  reldate: '14',
  notes: '',
}

function CreateSourceModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState<CreateFormState>(INITIAL_CREATE)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [forceCreate, setForceCreate] = useState(false)

  const update = <K extends keyof CreateFormState>(key: K, value: CreateFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setWarning(null)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setWarning(null)

    const name = form.name.trim()
    if (!name) {
      setError('Le nom est requis')
      return
    }
    if (form.type === 'rss' && !form.url.trim()) {
      setError('L\'URL du flux RSS est requise')
      return
    }
    if (form.type === 'pubmed' && !form.term.trim()) {
      setError('La requête MeSH est requise')
      return
    }

    const reldateNum = parseInt(form.reldate, 10)
    if (form.type === 'pubmed' && (!Number.isFinite(reldateNum) || reldateNum <= 0)) {
      setError('reldate doit être un entier positif')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/news/sources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          type: form.type,
          url: form.type === 'rss' ? form.url.trim() : null,
          term: form.type === 'pubmed' ? form.term.trim() : null,
          reldate: form.type === 'pubmed' ? reldateNum : null,
          notes: form.notes.trim() || null,
          force: forceCreate,
        }),
      })
      const json = await res.json()

      if (res.status === 422 && json.warning) {
        // L'API a renvoyé un warning bloquant tant que force=false n'est pas envoyé.
        setWarning(json.warning)
        setForceCreate(true)
        return
      }
      if (!res.ok) {
        setError(json.error || 'Erreur lors de la création')
        return
      }

      onCreated()
    } catch (err: any) {
      setError(err?.message || 'Erreur réseau')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Ajouter une source</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Fermer"
          >
            ×
          </button>
        </div>

        <form onSubmit={submit} className="px-6 py-4 space-y-4">
          {/* name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nom <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]"
              placeholder="Ex : PubMed — Implantologie"
            />
          </div>

          {/* type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Type <span className="text-red-500">*</span>
            </label>
            <select
              value={form.type}
              onChange={(e) => {
                update('type', e.target.value as 'rss' | 'pubmed')
                setForceCreate(false)
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
            >
              <option value="rss">RSS</option>
              <option value="pubmed">PubMed</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Le type <span className="font-mono">manual</span> est créé en dur par migration et
              ne se gère pas ici.
            </p>
          </div>

          {/* champs conditionnels */}
          {form.type === 'rss' ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                URL du flux <span className="text-red-500">*</span>
              </label>
              <input
                type="url"
                value={form.url}
                onChange={(e) => update('url', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]"
                placeholder="https://example.com/feed.xml"
              />
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Requête MeSH (term) <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={form.term}
                  onChange={(e) => update('term', e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96] font-mono"
                  placeholder='("dental implants"[MeSH] OR "implantology"[Title])'
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">reldate (jours)</label>
                <input
                  type="number"
                  min={1}
                  value={form.reldate}
                  onChange={(e) => update('reldate', e.target.value)}
                  className="w-32 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Fenêtre temporelle envoyée à NCBI à chaque fetch (défaut : 14).
                </p>
              </div>
            </>
          )}

          {/* notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]"
              placeholder="Optionnel : provenance, dépendance tierce, etc."
            />
          </div>

          {warning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">{warning}</div>
                <div className="text-xs mt-1">
                  Cliquez à nouveau sur « Créer » pour forcer la création malgré l'avertissement.
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D1B96] hover:bg-[#231575] disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {forceCreate && warning ? 'Créer quand même' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
