'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  NEWS_SPECIALITES,
  NEWS_SPECIALITE_LABELS,
} from '@/lib/constants/news'
import type { NewsCard } from '@/types/news'
import NewsCardItem from '@/components/news/NewsCardItem'
import NewsModal from '@/components/news/NewsModal'
import { useAudioPlayer, type AudioTrack } from '@/context/AudioPlayerContext'

const FETCH_LIMIT = 50

type SynthesesPayload = { data: NewsCard[]; total: number; page: number }

function buildSyntheseUrl(page: number, filter: string): string {
  const params = new URLSearchParams({
    limit: String(FETCH_LIMIT),
    page: String(page),
  })
  // Filtre serveur : 'all' = aucun param specialite (tout le catalogue).
  if (filter !== 'all') params.set('specialite', filter)
  return `/api/news/syntheses?${params.toString()}`
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsCard[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activeFilter, setActiveFilter] = useState<string>('all')

  const [modalNewsId, setModalNewsId] = useState<string | null>(null)
  const [playlistLoading, setPlaylistLoading] = useState(false)

  const { addToQueue } = useAudioPlayer()

  const hasLoadedOnce = useRef(false)
  const filterScrollRef = useRef<HTMLDivElement>(null)
  const scrollFilters = (dir: 'left' | 'right') => {
    filterScrollRef.current?.scrollBy({
      left: dir === 'left' ? -200 : 200,
      behavior: 'smooth',
    })
  }

  // Chargement initial + refetch page 1 à chaque changement de filtre.
  useEffect(() => {
    let cancelled = false
    const isInitial = !hasLoadedOnce.current
    if (isInitial) setLoading(true)
    else setListLoading(true)
    setError(null)

    fetch(buildSyntheseUrl(1, activeFilter))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<SynthesesPayload>
      })
      .then((payload) => {
        if (cancelled) return
        setItems(payload.data ?? [])
        setTotal(payload.total ?? 0)
        setPage(1)
        hasLoadedOnce.current = true
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setListLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [activeFilter])

  const loadMore = useCallback(async () => {
    if (loadingMore) return
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await fetch(buildSyntheseUrl(nextPage, activeFilter))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const payload = (await res.json()) as SynthesesPayload
      // Anti-doublons par id : protège contre une insertion entre deux fetches
      // qui décalerait la pagination (created_at desc).
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id))
        const next = (payload.data ?? []).filter((i) => !seen.has(i.id))
        return [...prev, ...next]
      })
      setTotal(payload.total ?? total)
      setPage(nextPage)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, page, activeFilter, total])

  const hasMore = items.length < total

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-full text-white/70 hover:bg-gray-800"
            aria-label="Retour a l'accueil"
          >
            <ChevronLeft size={22} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">
              Actualités scientifiques
            </h1>
            <p className="text-xs text-white/55 truncate">
              {loading || total === 0
                ? 'Toutes les dernières publications dentaires'
                : `${items.length} sur ${total} articles`}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto py-5">
        {loading ? (
          <div className="px-4 space-y-4">
            <div className="h-5 w-1/3 rounded bg-gray-800 animate-pulse" />
            <div className="flex flex-col gap-3">
              <div className="w-full h-[110px] rounded-xl bg-gray-800 animate-pulse" />
              <div className="w-full h-[110px] rounded-xl bg-gray-800 animate-pulse" />
              <div className="w-full h-[110px] rounded-xl bg-gray-800 animate-pulse" />
            </div>
          </div>
        ) : error ? (
          <p className="px-4 text-sm text-red-400">
            Impossible de charger les actualités ({error}).
          </p>
        ) : (
          <section>
            {!listLoading && items.length > 0 && (
              <button
                type="button"
                disabled={playlistLoading}
                onClick={async () => {
                  // Préchargement des audio_url côté client : on résout chaque
                  // synthesis_id en track {url, title, ...} avant d'alimenter
                  // l'AudioPlayerContext (URL-based, voir context/AudioPlayerContext.tsx).
                  // Les synthèses sans episode publié sont ignorées (filter Boolean).
                  setPlaylistLoading(true)
                  try {
                    const results = await Promise.all(
                      items.map(async (n): Promise<AudioTrack | null> => {
                        try {
                          const res = await fetch(`/api/news/syntheses/${n.id}`)
                          if (!res.ok) return null
                          const data = await res.json()
                          const audioUrl = data?.episode?.audio_url as string | undefined
                          const durationS = data?.episode?.duration_s as number | undefined
                          if (!audioUrl) return null
                          return {
                            url: audioUrl,
                            title: data?.synthesis?.display_title ?? n.display_title ?? '',
                            duration_s: typeof durationS === 'number' ? durationS : undefined,
                            type: 'news',
                          }
                        } catch {
                          return null
                        }
                      }),
                    )
                    const tracks = results.filter((t): t is AudioTrack => t !== null)
                    if (tracks.length > 0) addToQueue(tracks)
                  } finally {
                    setPlaylistLoading(false)
                  }
                }}
                className="mx-4 mb-4 px-4 py-2 bg-violet-600 hover:bg-violet-500
                           disabled:opacity-50 rounded-full text-white text-sm transition"
              >
                {playlistLoading
                  ? '⏳ Préparation…'
                  : `▶ Écouter la playlist (${items.length} articles)`}
              </button>
            )}

            <div className="relative mb-4">
              <button
                type="button"
                onClick={() => scrollFilters('left')}
                aria-label="Faire défiler vers la gauche"
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10
                           w-9 h-9 rounded-full bg-[#242424] shadow-md items-center
                           justify-center text-white/70 hover:bg-[#2e2e2e]"
              >
                <ChevronLeft size={18} />
              </button>

              <div
                ref={filterScrollRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 px-4"
              >
                <button
                  type="button"
                  onClick={() => setActiveFilter('all')}
                  className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                    activeFilter === 'all'
                      ? 'bg-violet-500 text-white'
                      : 'bg-gray-800 text-white/70 hover:bg-gray-700'
                  }`}
                >
                  Toutes
                </button>
                {NEWS_SPECIALITES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setActiveFilter(s.value)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      activeFilter === s.value
                        ? 'bg-violet-500 text-white'
                        : 'bg-gray-800 text-white/70 hover:bg-gray-700'
                    }`}
                  >
                    {NEWS_SPECIALITE_LABELS[s.value] ?? s.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => scrollFilters('right')}
                aria-label="Faire défiler vers la droite"
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10
                           w-9 h-9 rounded-full bg-[#242424] shadow-md items-center
                           justify-center text-white/70 hover:bg-[#2e2e2e]"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {listLoading ? (
              <div className="flex flex-col gap-3 px-4">
                <div className="w-full h-[110px] rounded-xl bg-gray-800 animate-pulse" />
                <div className="w-full h-[110px] rounded-xl bg-gray-800 animate-pulse" />
                <div className="w-full h-[110px] rounded-xl bg-gray-800 animate-pulse" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-4 text-sm text-white/55">
                {activeFilter === 'all'
                  ? 'Aucune actualité disponible pour le moment.'
                  : 'Aucun article dans cette spécialité pour le moment.'}
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-3 px-4">
                  {items.map((item) => (
                    <NewsCardItem
                      key={item.id}
                      news={item}
                      variant="grid"
                      onClick={(n) => setModalNewsId(n.id)}
                    />
                  ))}
                </div>

                {hasMore && (
                  <div className="flex justify-center mt-6 px-4">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={loadMore}
                      className="px-5 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50
                                 rounded-full text-white/80 text-sm font-medium transition"
                    >
                      {loadingMore ? 'Chargement…' : 'Charger plus'}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}
      </main>

      <NewsModal
        newsId={modalNewsId}
        onClose={() => setModalNewsId(null)}
      />

      {/* AudioQueuePlayer monté globalement dans (app)/layout.tsx — il consomme
          l'AudioPlayerContext et apparaît automatiquement quand la queue est non vide. */}
    </div>
  )
}
