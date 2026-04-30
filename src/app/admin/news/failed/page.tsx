'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowLeft,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Loader2,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
} from 'lucide-react'
import { formatDate } from '@/lib/news-display'
import { RetryButton } from '@/components/admin/news/RetryButton'

const STATUSES = [
  { value: 'failed', label: 'En échec', chip: 'bg-amber-100 text-amber-700' },
  {
    value: 'failed_permanent',
    label: 'Échec permanent',
    chip: 'bg-red-100 text-red-700',
  },
] as const

const SORTS = [
  { value: 'created_at_desc', label: 'Plus récents' },
  { value: 'created_at_asc', label: 'Plus anciens' },
] as const

interface FailedSynthesis {
  id: string
  display_title: string | null
  specialite: string | null
  status: string
  failed_attempts: number
  created_at: string
  published_at: string | null
  validation_errors: unknown
  validation_warnings: unknown
}

interface ListResponse {
  syntheses: FailedSynthesis[]
  total: number
  page: number
  limit: number
  total_pages: number
}

export default function FailedPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <FailedListInner />
    </Suspense>
  )
}

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
    </div>
  )
}

function FailedListInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const status = searchParams.get('status') ?? 'failed'
  const sort = searchParams.get('sort') ?? 'created_at_desc'
  const qFromUrl = searchParams.get('q') ?? ''
  const pageRaw = parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const [searchInput, setSearchInput] = useState(qFromUrl)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `?${qs}` : '?')
    },
    [router, searchParams]
  )

  useEffect(() => {
    setSearchInput(qFromUrl)
  }, [qFromUrl])

  useEffect(() => {
    if (searchInput === qFromUrl) return
    const timer = setTimeout(() => {
      updateParams({ q: searchInput || null, page: '1' })
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput, qFromUrl, updateParams])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('status', status)
        params.set('sort', sort)
        params.set('page', String(page))
        params.set('limit', '20')
        if (qFromUrl) params.set('q', qFromUrl)
        const res = await fetch(`/api/admin/news/syntheses?${params.toString()}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
        if (!cancelled) setData(json as ListResponse)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [status, sort, page, qFromUrl])

  const hasActiveFilters = useMemo(
    () => !!qFromUrl || sort !== 'created_at_desc',
    [qFromUrl, sort]
  )

  const resetFilters = () => {
    setSearchInput('')
    router.replace('?status=' + status)
  }

  // Mise à jour optimiste après retry : retire la synthèse de la liste car
  // son status reste 'failed' mais on l'a déjà traitée. On garde en haut de
  // liste si on est sur l'onglet failed (status = 'failed' déjà), pour donner
  // un feedback visuel cohérent avec le badge "Reset effectué" qui prend la
  // place du bouton. → On laisse la card en place mais on décrémente pas
  // total tant que l'admin n'a pas refresh. Reco simple : ne rien retirer,
  // juste indiquer le succès via le RetryButton.
  const handleRetrySuccess = () => {
    // no-op : le RetryButton affiche son propre feedback "Reset effectué"
    // et la synthèse reste dans la liste jusqu'au prochain refresh.
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <Link
        href="/admin/news"
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour à la liste News
      </Link>

      <header className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <AlertTriangle className="w-6 h-6 text-amber-600" />
          <h1 className="text-3xl font-bold text-gray-900">Articles en échec</h1>
        </div>
        <p className="text-sm text-gray-500 mb-3">
          Articles dont la synthèse a échoué et qui attendent un retraitement
          (cron lundi 20h / 22h UTC).
        </p>
        <p className="text-sm text-gray-700 font-medium">
          {data ? data.total : '…'} article{data && data.total > 1 ? 's' : ''}{' '}
          {status === 'failed_permanent' ? 'en échec permanent' : 'en échec'}
        </p>
      </header>

      {/* Chips status + recherche + tri */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-4 mb-6 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          {STATUSES.map((s) => {
            const active = status === s.value
            return (
              <button
                key={s.value}
                onClick={() => updateParams({ status: s.value, page: '1' })}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? `${s.chip} border-transparent ring-2 ring-[#2D1B96]/30`
                    : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Rechercher dans le titre…"
              className="w-full pl-10 pr-3 py-2 text-sm bg-white text-gray-900 placeholder-gray-400 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30 focus:border-[#2D1B96]"
            />
          </div>
          <select
            value={sort}
            onChange={(e) => updateParams({ sort: e.target.value, page: '1' })}
            className="text-sm bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value} className="bg-white text-gray-900">
                Tri : {s.label}
              </option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Réinitialiser
            </button>
          )}
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">Erreur de chargement</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-[#2D1B96]" />
        </div>
      ) : !data || data.total === 0 ? (
        <EmptyHealthy />
      ) : (
        <>
          <div className="space-y-4">
            {data.syntheses.map((s) => (
              <FailedCard key={s.id} synthesis={s} onRetrySuccess={handleRetrySuccess} />
            ))}
          </div>
          <Pagination
            page={data.page}
            totalPages={data.total_pages}
            total={data.total}
            onChange={(p) => updateParams({ page: String(p) })}
          />
        </>
      )}
    </div>
  )
}

function FailedCard({
  synthesis,
  onRetrySuccess,
}: {
  synthesis: FailedSynthesis
  onRetrySuccess: () => void
}) {
  const statusBadge =
    synthesis.status === 'failed_permanent'
      ? 'bg-red-100 text-red-700'
      : 'bg-amber-100 text-amber-700'
  const statusLabel =
    synthesis.status === 'failed_permanent' ? 'Échec permanent' : 'En échec'

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-base text-gray-900 mb-1.5">
            {synthesis.display_title || (
              <span className="text-gray-500 italic">Sans titre</span>
            )}
          </h3>
          <div className="flex flex-wrap gap-2 text-xs">
            <span
              className={`font-medium px-2 py-0.5 rounded-full ${statusBadge}`}
            >
              {statusLabel}
            </span>
            <span className="font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
              {synthesis.failed_attempts} / 2 tentatives
            </span>
            {synthesis.specialite && (
              <span className="font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                {synthesis.specialite}
              </span>
            )}
            <span className="text-gray-500 self-center">
              Créée le {formatDate(synthesis.created_at)}
            </span>
          </div>
        </div>
      </div>

      {hasContent(synthesis.validation_errors) && (
        <ValidationBlock
          label="Erreurs de validation"
          payload={synthesis.validation_errors}
          tone="error"
        />
      )}
      {hasContent(synthesis.validation_warnings) && (
        <ValidationBlock
          label="Avertissements"
          payload={synthesis.validation_warnings}
          tone="warning"
        />
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap pt-3 border-t border-gray-100">
        <Link
          href={`/admin/news/${synthesis.id}`}
          className="inline-flex items-center gap-1 text-sm text-[#2D1B96] hover:underline"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Voir le détail
        </Link>
        <RetryButton synthesisId={synthesis.id} onSuccess={onRetrySuccess} />
      </div>
    </div>
  )
}

function ValidationBlock({
  label,
  payload,
  tone,
}: {
  label: string
  payload: unknown
  tone: 'error' | 'warning'
}) {
  const toneCls =
    tone === 'error'
      ? 'bg-red-50 border-red-200 text-red-900'
      : 'bg-amber-50 border-amber-200 text-amber-900'
  return (
    <div className={`border rounded-lg p-3 mb-3 ${toneCls}`}>
      <div className="flex items-center gap-2 mb-2">
        <AlertTriangle className="w-4 h-4" />
        <span className="text-xs font-semibold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <pre className="text-xs font-mono whitespace-pre-wrap break-all max-h-60 overflow-auto">
        {JSON.stringify(payload, null, 2)}
      </pre>
    </div>
  )
}

function hasContent(value: unknown): boolean {
  if (value == null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'object') return Object.keys(value as object).length > 0
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

function EmptyHealthy() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
      <CheckCircle className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
      <p className="text-gray-700 font-medium mb-1">Aucun article en échec</p>
      <p className="text-sm text-gray-500">
        Le pipeline est en bonne santé. Les futurs échecs apparaîtront ici.
      </p>
    </div>
  )
}

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (p: number) => void
}) {
  if (totalPages <= 1) {
    return (
      <div className="mt-6 text-sm text-gray-500 text-center">
        Page 1 sur 1 • {total} résultat{total > 1 ? 's' : ''}
      </div>
    )
  }
  const pages = buildPageWindow(page, totalPages)
  return (
    <div className="mt-8 flex items-center justify-between gap-4 flex-wrap">
      <div className="text-sm text-gray-600">
        Page <span className="font-semibold">{page}</span> sur{' '}
        <span className="font-semibold">{totalPages}</span> • {total} résultats
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" />
          Précédent
        </button>
        {pages.map((p, idx) =>
          p === '…' ? (
            <span key={`gap-${idx}`} className="px-2 text-gray-500 text-sm">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onChange(p)}
              className={`min-w-[36px] px-2 py-1.5 rounded-lg text-sm border transition-colors ${
                p === page
                  ? 'bg-[#2D1B96] text-white border-[#2D1B96]'
                  : 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {p}
            </button>
          )
        )}
        <button
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Suivant
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function buildPageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const result: (number | '…')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) result.push('…')
  for (let i = left; i <= right; i++) result.push(i)
  if (right < total - 1) result.push('…')
  result.push(total)
  return result
}
