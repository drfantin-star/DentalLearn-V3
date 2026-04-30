'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  Filter,
  Newspaper,
  Link2,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  AlertCircle,
  Loader2,
  Calendar,
  Sparkles,
} from 'lucide-react'
import { ALLOWED_FORMATION_CATEGORIES } from '@/lib/constants/news'
import { describeCardDate } from '@/lib/news-display'

// ---------- Constantes ----------

const SPECIALITES = [
  { value: 'actu-pro', label: 'Actualité professionnelle' },
  { value: 'chir-orale', label: 'Chirurgie orale' },
  { value: 'dent-resto', label: 'Dentisterie restauratrice' },
  { value: 'endo', label: 'Endodontie' },
  { value: 'gero', label: 'Gérodontologie' },
  { value: 'implanto', label: 'Implantologie' },
  { value: 'occluso', label: 'Occlusodontie' },
  { value: 'odf', label: 'Orthodontie' },
  { value: 'paro', label: 'Parodontologie' },
  { value: 'pedo', label: 'Pédodontie' },
  { value: 'proth', label: 'Prothèse' },
  { value: 'sante-pub', label: 'Santé publique' },
] as const

const NIVEAUX_PREUVE = [
  { value: 'meta-analyse', label: 'Méta-analyse' },
  { value: 'revue-systematique', label: 'Revue systématique' },
  { value: 'rct', label: 'Essai randomisé contrôlé' },
  { value: 'cohorte', label: 'Étude de cohorte' },
  { value: 'cas-temoin', label: 'Étude cas-témoin' },
  { value: 'transversal', label: 'Étude transversale' },
  { value: 'cas-clinique', label: 'Cas clinique' },
  { value: 'opinion-expert', label: 'Opinion d\'expert' },
  { value: 'consensus', label: 'Consensus' },
  { value: 'reco-officielle', label: 'Recommandation officielle' },
] as const

const CATEGORIES_EDITORIALES = [
  { value: 'scientifique', label: 'Scientifique' },
  { value: 'pratique', label: 'Pratique' },
  { value: 'reglementaire', label: 'Réglementaire' },
  { value: 'humour', label: 'Humour' },
] as const

const STATUSES = [
  { value: 'active', label: 'Actives', chip: 'bg-emerald-100 text-emerald-700' },
  { value: 'failed', label: 'En échec', chip: 'bg-amber-100 text-amber-700' },
  { value: 'failed_permanent', label: 'Échec permanent', chip: 'bg-red-100 text-red-700' },
  { value: 'retracted', label: 'Rétractées', chip: 'bg-gray-200 text-gray-700' },
  { value: 'deleted', label: 'Supprimées', chip: 'bg-gray-300 text-gray-600' },
] as const

const SORTS = [
  { value: 'published_at_desc', label: 'Publication la plus récente' },
  { value: 'published_at_asc', label: 'Publication la plus ancienne' },
  { value: 'created_at_desc', label: 'Plus récentes' },
  { value: 'created_at_asc', label: 'Plus anciennes' },
  { value: 'specialite_asc', label: 'Spécialité (A-Z)' },
] as const

const CATEGORY_EDITORIAL_BADGE: Record<string, string> = {
  scientifique: 'bg-blue-50 text-blue-700',
  pratique: 'bg-green-50 text-green-700',
  reglementaire: 'bg-orange-50 text-orange-700',
  humour: 'bg-pink-50 text-pink-700',
}

const DEFAULT_STATUS = 'active'
const DEFAULT_SORT = 'created_at_desc'

// Sentinel non utilisé côté API tant que le filtre NULL n'existe pas.
// Conservé visuellement mais désactivé (option grisée + tooltip "À venir").
const FORMATION_MATCH_NONE_SENTINEL = '__none__'

interface Synthesis {
  id: string
  display_title: string | null
  summary_fr: string | null
  specialite: string | null
  themes: string[] | null
  niveau_preuve: string | null
  category_editorial: string | null
  formation_category_match: string | null
  status: string
  failed_attempts: number | null
  manual_added: boolean
  created_at: string
  published_at: string | null
}

interface ListResponse {
  syntheses: Synthesis[]
  total: number
  page: number
  limit: number
  total_pages: number
}

// ---------- Composant racine ----------

export default function AdminNewsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <NewsListPage />
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

// ---------- Page ----------

function NewsListPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // URL = source de vérité pour les filtres
  const status = searchParams.get('status') ?? DEFAULT_STATUS
  const specialite = searchParams.get('specialite') ?? ''
  const niveauPreuve = searchParams.get('niveau_preuve') ?? ''
  const categoryEditorial = searchParams.get('category_editorial') ?? ''
  const formationCategoryMatch = searchParams.get('formation_category_match') ?? ''
  const sort = searchParams.get('sort') ?? DEFAULT_SORT
  const qFromUrl = searchParams.get('q') ?? ''
  const pageRaw = parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  // Local state seulement pour : input recherche (debounce) et données fetch.
  const [searchInput, setSearchInput] = useState(qFromUrl)
  const [data, setData] = useState<ListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [poolCounts, setPoolCounts] = useState<{ pending: number; approved: number } | null>(null)

  // Compteurs globaux du pool quotidien (un seul fetch au mount).
  useEffect(() => {
    let cancelled = false
    fetch('/api/admin/news/questions?limit=1')
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        if (json?.counts) {
          setPoolCounts({
            pending: json.counts.pending ?? 0,
            approved: json.counts.approved ?? 0,
          })
        }
      })
      .catch(() => {
        /* compteurs optionnels — silencieux en cas d'erreur réseau */
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Helper pour pousser des changements de params dans l'URL.
  // value === '' ou null => suppression du param.
  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === '') params.delete(key)
        else params.set(key, value)
      }
      const qs = params.toString()
      router.replace(qs ? `/admin/news?${qs}` : '/admin/news')
    },
    [router, searchParams]
  )

  // Synchro input ← URL si q changé hors du champ (ex : reset filtres).
  useEffect(() => {
    setSearchInput(qFromUrl)
  }, [qFromUrl])

  // Debounce 400ms avant push de l'input dans l'URL.
  // Reset page=1 dès qu'on relance une recherche.
  useEffect(() => {
    if (searchInput === qFromUrl) return
    const timer = setTimeout(() => {
      updateParams({ q: searchInput || null, page: '1' })
    }, 400)
    return () => clearTimeout(timer)
  }, [searchInput, qFromUrl, updateParams])

  // Fetch quand un filtre / la pagination change.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('page', String(page))
        params.set('status', status)
        params.set('sort', sort)
        if (specialite) params.set('specialite', specialite)
        if (niveauPreuve) params.set('niveau_preuve', niveauPreuve)
        if (categoryEditorial) params.set('category_editorial', categoryEditorial)
        if (formationCategoryMatch) params.set('formation_category_match', formationCategoryMatch)
        if (qFromUrl) params.set('q', qFromUrl)

        const res = await fetch(`/api/admin/news/syntheses?${params.toString()}`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erreur de chargement')
        if (!cancelled) setData(json as ListResponse)
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Erreur de chargement')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [
    page,
    status,
    specialite,
    niveauPreuve,
    categoryEditorial,
    formationCategoryMatch,
    sort,
    qFromUrl,
  ])

  const hasActiveFilters = useMemo(() => {
    return (
      status !== DEFAULT_STATUS ||
      sort !== DEFAULT_SORT ||
      !!specialite ||
      !!niveauPreuve ||
      !!categoryEditorial ||
      !!formationCategoryMatch ||
      !!qFromUrl
    )
  }, [status, sort, specialite, niveauPreuve, categoryEditorial, formationCategoryMatch, qFromUrl])

  const resetFilters = () => {
    setSearchInput('')
    router.replace('/admin/news')
  }

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Header */}
      <header className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#2D1B96]/10 flex items-center justify-center">
            <Newspaper className="w-5 h-5 text-[#2D1B96]" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">News</h1>
            <p className="text-sm text-gray-500">
              Synthèses scientifiques générées par le pipeline éditorial
            </p>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          {data ? <span className="font-semibold text-gray-900">{data.total}</span> : '…'}{' '}
          synthèse{data && data.total > 1 ? 's' : ''}
        </div>
      </header>

      {/* Pool Quiz du jour */}
      <div className="bg-gradient-to-r from-[#2D1B96] to-[#5D4FE0] rounded-2xl p-6 mb-6 text-white">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold mb-1">Pool Quiz du jour</h2>
            <p className="text-sm text-white/80">
              Validation des questions news pour le quiz quotidien
            </p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/admin/news/pending"
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 transition-colors text-center min-w-[100px]"
            >
              <p className="text-2xl font-bold">
                {poolCounts ? poolCounts.pending : '…'}
              </p>
              <p className="text-xs text-white/80">En attente</p>
            </Link>
            <Link
              href="/admin/news/approved"
              className="bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 transition-colors text-center min-w-[100px]"
            >
              <p className="text-2xl font-bold text-emerald-300">
                {poolCounts ? poolCounts.approved : '…'}
              </p>
              <p className="text-xs text-white/80">Approuvées</p>
            </Link>
          </div>
        </div>
      </div>

      {/* Barre filtres (sticky) */}
      <div className="sticky top-0 z-10 bg-gray-100 -mx-8 px-8 py-3 border-b border-gray-200 mb-6">
        <div className="space-y-3">
          {/* Recherche + tri */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Rechercher dans le titre ou la synthèse…"
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
                className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 px-3 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Réinitialiser
              </button>
            )}
          </div>

          {/* Status chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-gray-400" />
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

          {/* 4 dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            <select
              value={specialite}
              onChange={(e) => updateParams({ specialite: e.target.value || null, page: '1' })}
              className="text-sm bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
            >
              <option value="" className="bg-white text-gray-900">Spécialité — Toutes</option>
              {SPECIALITES.map((s) => (
                <option key={s.value} value={s.value} className="bg-white text-gray-900">
                  {s.label}
                </option>
              ))}
            </select>

            <select
              value={niveauPreuve}
              onChange={(e) => updateParams({ niveau_preuve: e.target.value || null, page: '1' })}
              className="text-sm bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
            >
              <option value="" className="bg-white text-gray-900">Niveau de preuve — Tous</option>
              {NIVEAUX_PREUVE.map((n) => (
                <option key={n.value} value={n.value} className="bg-white text-gray-900">
                  {n.label}
                </option>
              ))}
            </select>

            <select
              value={categoryEditorial}
              onChange={(e) =>
                updateParams({ category_editorial: e.target.value || null, page: '1' })
              }
              className="text-sm bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
            >
              <option value="" className="bg-white text-gray-900">Catégorie éditoriale — Toutes</option>
              {CATEGORIES_EDITORIALES.map((c) => (
                <option key={c.value} value={c.value} className="bg-white text-gray-900">
                  {c.label}
                </option>
              ))}
            </select>

            <select
              value={formationCategoryMatch}
              onChange={(e) =>
                updateParams({ formation_category_match: e.target.value || null, page: '1' })
              }
              className="text-sm bg-white text-gray-900 border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#2D1B96]/30"
            >
              <option value="" className="bg-white text-gray-900">Match formation — Toutes</option>
              <option value={FORMATION_MATCH_NONE_SENTINEL} className="bg-white text-gray-900">
                — Aucune correspondance —
              </option>
              {ALLOWED_FORMATION_CATEGORIES.map((slug) => (
                <option key={slug} value={slug} className="bg-white text-gray-900">
                  {slug}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contenu */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold text-red-800">Erreur de chargement</p>
            <p className="text-sm text-red-700 mt-1">{error}</p>
          </div>
          <button
            onClick={() => router.refresh()}
            className="text-sm font-medium text-red-700 hover:text-red-900 px-3 py-1.5 rounded-lg border border-red-300 bg-white"
          >
            Réessayer
          </button>
        </div>
      ) : loading ? (
        <SkeletonGrid />
      ) : !data || data.total === 0 ? (
        <EmptyState onReset={resetFilters} />
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.syntheses.map((s) => (
              <SynthesisCard key={s.id} synthesis={s} />
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

// ---------- Card ----------

function SynthesisCard({ synthesis }: { synthesis: Synthesis }) {
  const dateInfo = describeCardDate(synthesis.published_at, synthesis.created_at)
  const editorialBadge = synthesis.category_editorial
    ? CATEGORY_EDITORIAL_BADGE[synthesis.category_editorial] ?? 'bg-gray-100 text-gray-700'
    : null

  return (
    <Link
      href={`/admin/news/${synthesis.id}`}
      className="block bg-white rounded-2xl shadow-lg p-5 hover:shadow-xl hover:-translate-y-0.5 transition-all"
    >
      <h3 className="font-semibold text-base text-gray-900 line-clamp-2 mb-3">
        {synthesis.display_title || 'Sans titre'}
      </h3>

      <div className="flex flex-wrap gap-1.5 mb-3">
        {synthesis.specialite && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
            {synthesis.specialite}
          </span>
        )}
        {synthesis.niveau_preuve && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
            {synthesis.niveau_preuve}
          </span>
        )}
        {synthesis.category_editorial && editorialBadge && (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${editorialBadge}`}>
            {synthesis.category_editorial}
          </span>
        )}
        {synthesis.formation_category_match && (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-800 inline-flex items-center gap-1">
            <Link2 className="w-3 h-3" />
            {synthesis.formation_category_match}
          </span>
        )}
      </div>

      {synthesis.summary_fr && (
        <p className="text-sm text-gray-600 line-clamp-3 mb-4">{synthesis.summary_fr}</p>
      )}

      <div className="text-xs text-gray-500 flex items-center justify-between gap-2 flex-wrap">
        <span
          className="inline-flex items-center gap-1"
          title={dateInfo.fromPublication ? 'Date de publication scientifique' : 'Date de génération de la synthèse'}
        >
          {dateInfo.fromPublication ? (
            <Calendar className="w-3 h-3" />
          ) : (
            <Sparkles className="w-3 h-3" />
          )}
          {dateInfo.label}
        </span>
        <div className="flex items-center gap-1.5">
          {synthesis.manual_added && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              Ajout manuel
            </span>
          )}
          {synthesis.failed_attempts != null && synthesis.failed_attempts > 0 && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              {synthesis.failed_attempts} tentative{synthesis.failed_attempts > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ---------- Skeleton / Empty ----------

function SkeletonGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white rounded-2xl shadow-lg p-5 animate-pulse">
          <div className="h-5 bg-gray-200 rounded w-4/5 mb-3" />
          <div className="h-5 bg-gray-200 rounded w-2/5 mb-4" />
          <div className="flex gap-2 mb-4">
            <div className="h-5 bg-gray-100 rounded-full w-16" />
            <div className="h-5 bg-gray-100 rounded-full w-20" />
            <div className="h-5 bg-gray-100 rounded-full w-14" />
          </div>
          <div className="h-3 bg-gray-100 rounded w-full mb-2" />
          <div className="h-3 bg-gray-100 rounded w-11/12 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-3/5 mb-4" />
          <div className="h-3 bg-gray-100 rounded w-1/3" />
        </div>
      ))}
    </div>
  )
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
      <Newspaper className="w-16 h-16 text-gray-300 mx-auto mb-4" />
      <p className="text-gray-700 font-medium mb-1">
        Aucune synthèse ne correspond à ces filtres
      </p>
      <p className="text-sm text-gray-500 mb-6">
        Essayez d'élargir la recherche ou de changer le statut.
      </p>
      <button
        onClick={onReset}
        className="inline-flex items-center gap-2 bg-[#2D1B96] hover:bg-[#231575] text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Réinitialiser les filtres
      </button>
    </div>
  )
}

// ---------- Pagination ----------

function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number
  totalPages: number
  total: number
  onChange: (page: number) => void
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

// Fenêtre de pagination max 7 entrées : 1 … current-1 current current+1 … last
function buildPageWindow(current: number, total: number): (number | '…')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }
  const result: (number | '…')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) result.push('…')
  for (let i = left; i <= right; i++) result.push(i)
  if (right < total - 1) result.push('…')
  result.push(total)
  return result
}

