'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, Newspaper } from 'lucide-react'
import {
  NEWS_SPECIALITES,
  NEWS_SPECIALITE_LABELS,
} from '@/lib/constants/news'
import type { NewsCard } from '@/types/news'
import NewsCardItem from '@/components/news/NewsCardItem'
import NewsModal from '@/components/news/NewsModal'
import QuizActuModal from '@/components/news/QuizActuModal'

const PLAYLIST_ORDER: string[] = [
  'dent-resto',
  'paro',
  'implanto',
  'chir-orale',
  'odf',
  'endo',
  'occluso',
  'proth',
  'sante-pub',
]

const PLAYLIST_MIN_ITEMS = 3
const FETCH_LIMIT = 50

export default function NewsPage() {
  const [items, setItems] = useState<NewsCard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [modalNewsId, setModalNewsId] = useState<string | null>(null)
  const [quizSpecialite, setQuizSpecialite] = useState<{
    slug: string
    label: string
  } | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')

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

  const itemsBySpecialite = useMemo(() => {
    const map = new Map<string, NewsCard[]>()
    for (const item of items) {
      const key = item.specialite ?? '__none__'
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
    return map
  }, [items])

  const playlists = useMemo(() => {
    return PLAYLIST_ORDER.map((slug) => ({
      slug,
      label: NEWS_SPECIALITE_LABELS[slug] ?? slug,
      items: itemsBySpecialite.get(slug) ?? [],
    })).filter((p) => p.items.length >= PLAYLIST_MIN_ITEMS)
  }, [itemsBySpecialite])

  const presentSpecialites = useMemo(() => {
    const slugs = new Set<string>()
    for (const item of items) {
      if (item.specialite) slugs.add(item.specialite)
    }
    return NEWS_SPECIALITES
      .filter((s) => slugs.has(s.value))
      .map((s) => ({ slug: s.value, label: NEWS_SPECIALITE_LABELS[s.value] ?? s.label }))
  }, [items])

  const filteredItems = useMemo(() => {
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
          <Newspaper size={20} className="text-violet-400 flex-shrink-0" />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-8">
        {loading ? (
          <div className="space-y-4">
            <div className="h-5 w-1/3 rounded bg-gray-800 animate-pulse" />
            <div className="flex gap-3 overflow-hidden">
              <div className="w-[200px] h-[180px] rounded-xl bg-gray-800 animate-pulse" />
              <div className="w-[200px] h-[180px] rounded-xl bg-gray-800 animate-pulse" />
              <div className="w-[200px] h-[180px] rounded-xl bg-gray-800 animate-pulse" />
            </div>
          </div>
        ) : error ? (
          <p className="text-sm text-red-400">
            Impossible de charger les actualités ({error}).
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-gray-400">
            Aucune actualité disponible pour le moment.
          </p>
        ) : (
          <>
            {playlists.length > 0 ? (
              <section className="space-y-6">
                {playlists.map((playlist) => (
                  <div key={playlist.slug}>
                    <div className="flex items-center justify-between mb-3 gap-3">
                      <h2 className="text-base font-bold text-white truncate">
                        {playlist.label}
                        <span className="text-xs font-medium text-gray-400 ml-2">
                          {playlist.items.length} article
                          {playlist.items.length > 1 ? 's' : ''}
                        </span>
                      </h2>
                      <button
                        type="button"
                        onClick={() =>
                          setQuizSpecialite({
                            slug: playlist.slug,
                            label: playlist.label,
                          })
                        }
                        className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold
                                   bg-gradient-to-r from-[#2D1B96] to-[#00D1C1]
                                   text-white hover:opacity-90 transition"
                      >
                        Quiz Actu →
                      </button>
                    </div>
                    <div
                      className="flex gap-3 overflow-x-auto scroll-smooth snap-x
                                 snap-mandatory scrollbar-hide -mx-4 px-4 pb-2"
                    >
                      {playlist.items.map((item) => (
                        <div key={item.id} className="snap-start">
                          <NewsCardItem
                            news={item}
                            variant="carousel"
                            onClick={(n) => setModalNewsId(n.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </section>
            ) : null}

            <section>
              <h2 className="text-base font-bold text-white mb-3">
                Toutes les actualités
              </h2>

              <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4 mb-4">
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

              {filteredItems.length === 0 ? (
                <p className="text-sm text-gray-400">
                  Aucune actualité pour cette spécialité.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {filteredItems.map((item) => (
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
          </>
        )}
      </main>

      <NewsModal
        newsId={modalNewsId}
        onClose={() => setModalNewsId(null)}
      />

      {quizSpecialite ? (
        <QuizActuModal
          specialite={quizSpecialite.slug}
          specialiteLabel={quizSpecialite.label}
          onClose={() => setQuizSpecialite(null)}
        />
      ) : null}
    </div>
  )
}
