'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
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

export default function NewsPage() {
  const [items, setItems] = useState<NewsCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalNewsId, setModalNewsId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [playlistLoading, setPlaylistLoading] = useState(false)

  const { addToQueue } = useAudioPlayer()

  const filterScrollRef = useRef<HTMLDivElement>(null)
  const scrollFilters = (dir: 'left' | 'right') => {
    filterScrollRef.current?.scrollBy({
      left: dir === 'left' ? -200 : 200,
      behavior: 'smooth',
    })
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetch(`/api/news/syntheses?limit=${FETCH_LIMIT}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<{ data: NewsCard[] }>
      })
      .then((payload) => {
        if (cancelled) return
        setItems(payload.data ?? [])
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const presentSpecialites = useMemo(() => {
    const slugs = new Set<string>()
    for (const item of items) {
      if (item.specialite) slugs.add(item.specialite)
    }
    return NEWS_SPECIALITES
      .filter((s) => slugs.has(s.value))
      .map((s) => ({ slug: s.value, label: NEWS_SPECIALITE_LABELS[s.value] ?? s.label }))
  }, [items])

  const filteredNews = useMemo(() => {
    if (activeFilter === 'all') return items
    return items.filter((item) => item.specialite === activeFilter)
  }, [items, activeFilter])

  return (
    <div className="min-h-screen bg-[#0F0F0F]">
      <header className="sticky top-0 z-20 bg-[#0F0F0F]/95 backdrop-blur border-b border-gray-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-full text-gray-300 hover:bg-gray-800"
            aria-label="Retour à l'accueil"
          >
            <ChevronLeft size={22} />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-white truncate">
              Actualités scientifiques
            </h1>
            <p className="text-xs text-gray-400 truncate">
              Toutes les dernières publications dentaires
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
        ) : items.length === 0 ? (
          <p className="px-4 text-sm text-gray-400">
            Aucune actualité disponible pour le moment.
          </p>
        ) : (
          <section>
            {filteredNews.length > 0 && (
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
                      filteredNews.map(async (n): Promise<AudioTrack | null> => {
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
                  : `▶ Écouter la playlist (${filteredNews.length} articles)`}
              </button>
            )}

            <div className="relative mb-4">
              <button
                type="button"
                onClick={() => scrollFilters('left')}
                aria-label="Faire défiler vers la gauche"
                className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10
                           w-9 h-9 rounded-full bg-[#242424] shadow-md items-center
                           justify-center text-gray-300 hover:bg-gray-50"
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
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  Toutes
                </button>
                {presentSpecialites.map((s) => (
                  <button
                    key={s.slug}
                    type="button"
                    onClick={() => setActiveFilter(s.slug)}
                    className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                      activeFilter === s.slug
                        ? 'bg-violet-500 text-white'
                        : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => scrollFilters('right')}
                aria-label="Faire défiler vers la droite"
                className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10
                           w-9 h-9 rounded-full bg-[#242424] shadow-md items-center
                           justify-center text-gray-300 hover:bg-gray-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>

            {filteredNews.length === 0 ? (
              <p className="px-4 text-sm text-gray-400">
                Aucune actualité pour cette spécialité.
              </p>
            ) : (
              <div className="flex flex-col gap-3 px-4">
                {filteredNews.map((item) => (
                  <NewsCardItem
                    key={item.id}
                    news={item}
                    variant="grid"
                    onClick={(n) => setModalNewsId(n.id)}
                  />
                ))}
              </div>
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
