'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { NewsDetailResponse } from '@/types/news'
import { NewsRecapCard } from '@/components/news/NewsRecapCard'
import WavePlayButton from '@/components/WavePlayButton'

interface Props {
  newsId: string | null
  onClose: () => void
}

export default function NewsModal({ newsId, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<NewsDetailResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Lecture audio locale au modal (élément <audio> caché, aucun contrôle
  // natif exposé). Volontairement PAS branché sur AudioContext (réservé aux
  // formations / logs DPC) ni sur AudioPlayerContext (queue playlist).
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progressPercent, setProgressPercent] = useState(0)

  const handleTogglePlay = () => {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      void el.play()
    } else {
      el.pause()
    }
  }

  // Coupe la lecture à la fermeture du modal (le retrait du <audio> du DOM
  // ne suffit pas dans tous les navigateurs) et au démontage.
  useEffect(() => {
    if (!newsId) {
      audioRef.current?.pause()
      setIsPlaying(false)
      setProgressPercent(0)
    }
  }, [newsId])

  useEffect(() => {
    const ref = audioRef
    return () => {
      ref.current?.pause()
    }
  }, [])

  useEffect(() => {
    if (!newsId) return

    let cancelled = false
    setLoading(true)
    setError(null)
    setData(null)
    setIsPlaying(false)
    setProgressPercent(0)

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

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="glass-panel w-full md:w-full md:max-w-2xl rounded-t-2xl md:rounded-2xl
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
            <p className="text-sm text-white/55">Aucune donnee.</p>
          ) : (
            <>
              <h2 className="text-xl font-bold text-white pr-10">
                {synthesis.display_title}
              </h2>

              {/* Source (nom du journal) sous le titre : texte discret, pas de
                  badge. Rien affiché si le champ est vide (fallback propre). */}
              {source?.journal_name ? (
                <p className="mt-1 text-sm text-white/90">
                  {source.journal_name}
                </p>
              ) : null}

              {/* Player épuré juste sous le titre : bouton vague seul, glow
                  teal sur le bouton (token glow-accent), sans conteneur
                  carte, sans libellé ni durée. */}
              {episode ? (
                <div className="mt-4">
                  <WavePlayButton
                    isPlaying={isPlaying}
                    progressPercent={progressPercent}
                    onToggle={handleTogglePlay}
                    ariaLabel={
                      isPlaying
                        ? 'Mettre la synthèse audio en pause'
                        : 'Écouter la synthèse audio'
                    }
                    className="glow-accent"
                  />
                  {/* Élément audio caché : ni contrôles natifs, ni vitesse,
                      ni menu — le WavePlayButton est la seule surface. */}
                  <audio
                    ref={audioRef}
                    src={episode.audio_url}
                    preload="metadata"
                    className="hidden"
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    onTimeUpdate={(e) => {
                      const el = e.currentTarget
                      setProgressPercent(
                        el.duration > 0
                          ? (el.currentTime / el.duration) * 100
                          : 0,
                      )
                    }}
                  />
                </div>
              ) : null}

              {/* T8 — carte récap statique si la synthèse appartient à un
                  épisode T8-ready (timeline_url présent). Pas de défilement,
                  pas de couplage audio (Q-T8-1=a bonus). Sinon : statu quo. */}
              {episode?.timeline_url ? (
                <div className="mt-4">
                  <NewsRecapCard synthesis={synthesis} />
                </div>
              ) : null}

              <p className="text-base leading-relaxed text-white/70 mt-4 whitespace-pre-line">
                {synthesis.summary_fr}
              </p>

              {/* Impact clinique et Limites : déjà portés par la carte récap
                  quand elle est affichée (timeline_url présent) — on ne les
                  rend en sections détail QUE si la carte récap est absente,
                  pour éviter le doublon sans perdre l'info sur les news
                  sans épisode audio. */}
              {!episode?.timeline_url && synthesis.clinical_impact ? (
                <section className="mt-5">
                  <h3 className="text-xs uppercase tracking-wide text-violet-400 font-semibold">
                    Impact clinique
                  </h3>
                  <p className="text-base leading-relaxed text-white/70 mt-1 whitespace-pre-line">
                    {synthesis.clinical_impact}
                  </p>
                </section>
              ) : null}

              {synthesis.key_figures && synthesis.key_figures.length > 0 ? (
                <section className="mt-5">
                  <h3 className="text-xs uppercase tracking-wide text-white/55 font-semibold">
                    Chiffres cles
                  </h3>
                  <ul className="list-disc list-inside text-base leading-relaxed text-white/70 mt-1 space-y-1">
                    {synthesis.key_figures.map((figure, i) => (
                      <li key={i}>{figure}</li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {synthesis.evidence_level ? (
                <section className="mt-5">
                  <h3 className="text-xs uppercase tracking-wide text-white/55 font-semibold">
                    Niveau de preuve
                  </h3>
                  <div className="mt-1 flex items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded-full text-[11px] font-medium
                                 bg-gray-700 text-white/80"
                    >
                      {synthesis.evidence_level}
                    </span>
                  </div>
                </section>
              ) : null}

              {!episode?.timeline_url && synthesis.caveats ? (
                <section className="mt-5">
                  <h3 className="text-xs uppercase tracking-wide text-amber-400 font-semibold">
                    Limites
                  </h3>
                  <p className="text-base leading-relaxed text-white/70 mt-1 whitespace-pre-line">
                    {synthesis.caveats}
                  </p>
                </section>
              ) : null}

              {sourceHref ? (
                <a
                  href={sourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block mt-5 text-sm font-medium text-blue-300 underline underline-offset-2 hover:text-blue-200"
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
