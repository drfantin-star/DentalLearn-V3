'use client'

import React, { useEffect, useState } from 'react'
import type { NewsDetailResponse } from '@/types/news'
import { formatDate } from '@/lib/news-display'
import { NEWS_SPECIALITE_LABELS } from '@/lib/constants/news'

interface Props {
  newsId: string | null
  onClose: () => void
}

const CATEGORY_BADGE_CLASSES: Record<string, string> = {
  scientifique: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
  pratique: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
}
const CATEGORY_BADGE_FALLBACK = 'bg-gray-500/20 text-gray-300 border-gray-400/30'

export default function NewsModal({ newsId, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<NewsDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!newsId) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)

    fetch(`/api/news/syntheses/${newsId}`)
      .then(async (res) => {
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`)
        }
        return res.json() as Promise<NewsDetailResponse>
      })
      .then((payload) => {
        if (cancelled) return
        setData(payload)
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
  }, [newsId])

  if (!newsId) return null

  const synthesis = data?.synthesis
  const episode = data?.episode ?? null
  const source = data?.source ?? null

  const sourceHref = source
    ? source.doi
      ? `https://doi.org/${source.doi}`
      : source.source_url ?? null
    : null

  const categoryClass =
    (synthesis?.category_editorial &&
      CATEGORY_BADGE_CLASSES[synthesis.category_editorial]) ||
    CATEGORY_BADGE_FALLBACK

  const specialiteLabel = synthesis?.specialite
    ? NEWS_SPECIALITE_LABELS[synthesis.specialite] ?? synthesis.specialite
    : null

  const durationMin =
    episode && typeof episode.duration_s === 'number'
      ? Math.floor(episode.duration_s / 60)
      : null

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-gray-900 w-full md:w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl
                   max-h-[85vh] overflow-y-auto relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-gray-800/80
                     text-gray-200 hover:bg-gray-700 flex items-center justify-center"
        >
          ✕
        </button>

        <div className="p-5 md:p-6">
          {loading ? (
            <div className="flex flex-col gap-4">
              <div className="h-6 w-3/4 rounded bg-gray-700 animate-pulse" />
              <div className="h-20 w-full rounded bg-gray-700 animate-pulse" />
              <div className="h-32 w-full rounded bg-gray-700 animate-pulse" />
            </div>
          ) : error ? (
            <p className="text-sm text-red-400">
              Impossible de charger l’actualité ({error}).
            </p>
          ) : !synthesis ? (
            <p className="text-sm text-gray-400">Aucune donnée.</p>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white pr-10">
                {synthesis.display_title}
              </h2>

              <div className="flex flex-wrap gap-2 mt-3">
                {specialiteLabel ? (
                  <span
                    className="px-2 py-0.5 rounded-full border text-[11px] font-medium
                               bg-violet-500/20 text-violet-300 border-violet-400/30"
                  >
                    {specialiteLabel}
                  </span>
                ) : null}
                {synthesis.category_editorial ? (
                  <span
                    className={`px-2 py-0.5 rounded-full border text-[11px] font-medium ${categoryClass}`}
                  >
                    {synthesis.category_editorial}
                  </span>
                ) : null}
              </div>

              {synthesis.published_at ? (
                <p className="text-xs text-gray-400 mt-2">
                  {formatDate(synthesis.published_at)}
                </p>
              ) : null}

              {episode ? (
                <div className="mt-3">
                  <audio controls src={episode.audio_url} className="w-full">
                    Votre navigateur ne supporte pas l’audio.
                  </audio>
                  {durationMin !== null ? (
                    <p className="text-xs text-gray-400 mt-1">{durationMin} min</p>
                  ) : null}
                </div>
              ) : null}

              <p className="text-sm text-gray-300 mt-4 whitespace-pre-line">
                {synthesis.summary_fr}
              </p>

              {synthesis.clinical_impact ? (
                <section className="mt-5">
                  <h3 className="text-xs uppercase tracking-wide text-violet-400 font-semibold">
                    Impact clinique
                  </h3>
                  <p className="text-sm text-gray-300 mt-1 whitespace-pre-line">
                    {synthesis.clinical_impact}
                  </p>
                </section>
              ) : null}

              {synthesis.key_figures && synthesis.key_figures.length > 0 ? (
                <section className="mt-5">
                  <h3 className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                    Chiffres clés
                  </h3>
                  <ul className="list-disc list-inside text-sm text-gray-300 mt-1 space-y-1">
                    {synthesis.key_figures.map((figure, i) => (
                      <li key={i}>{figure}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {synthesis.evidence_level ? (
                <section className="mt-5">
                  <h3 className="text-xs uppercase tracking-wide text-gray-400 font-semibold">
                    Niveau de preuve
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium
                                 bg-gray-700 text-gray-200"
                    >
                      {synthesis.evidence_level}
                    </span>
                  </div>
                </section>
              ) : null}

              {synthesis.caveats ? (
                <section className="mt-5">
                  <h3 className="text-xs uppercase tracking-wide text-amber-400 font-semibold">
                    Limites
                  </h3>
                  <p className="text-sm text-gray-300 mt-1 whitespace-pre-line">
                    {synthesis.caveats}
                  </p>
                </section>
              ) : null}

              {sourceHref ? (
                <a
                  href={sourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-5 text-xs text-blue-400 hover:underline"
                >
                  Accéder à l’article →
                </a>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
