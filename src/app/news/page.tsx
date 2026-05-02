'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import {
  NEWS_SPECIALITES,
  NEWS_SPECIALITE_LABELS,
} from '@/lib/constants/news'
import type { NewsCard } from '@/types/news'
import NewsCardItem from '@/components/news/NewsCardItem'
import NewsModal from '@/components/news/NewsModal'

const FETCH_LIMIT = 50

export default function NewsPage() {
  const [items, setItems] = useState<NewsCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalNewsId, setModalNewsId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')

  const [audioQueue, setAudioQueue] = useState<string[]>([])
  const [audioQueueIndex, setAudioQueueIndex] = useState(0)

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
    <div className="min-h-screen bg-[#0F0F0F] pb-24">
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
            <button
              type="button"
              onClick={() => {
                setAudioQueue(filteredNews.map((n) => n.id))
                setAudioQueueIndex(0)
                // TODO T9-audio : brancher AudioQueuePlayer ici
              }}
              className="mx-4 mb-4 px-4 py-2 bg-violet-600 hover:bg-violet-500
                         rounded-full text-white text-sm transition"
            >
              ▶ Écouter la playlist
            </button>

            <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2 mb-4 px-4">
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
    </div>
  )
}
