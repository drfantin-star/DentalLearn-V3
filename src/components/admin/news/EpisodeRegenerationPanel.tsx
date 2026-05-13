'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

// ============================================================================
// <EpisodeRegenerationPanel> — POC-T12-D-3
//
// Panneau autonome consommé dans SynthesisEditForm. Cycle :
//   1. Fetch /api/admin/news/syntheses/[id]/linked-episodes au mount.
//   2. Si réponse vide (insight=[] ET journals=[]) → return null
//      (SECTION ENTIÈREMENT CACHÉE, pas de message "Aucun episode" —
//      cohérent §6.1 maquette M1 finale point f).
//   3. Sinon : picker checkboxes + bouton "Régénérer (N)" + warning ⚠.
//   4. Au clic Régénérer : boucle CLIENT séquentielle (1 episode à la fois)
//      qui appelle POST regenerate-linked-episodes avec un seul episode
//      par requête → permet l'affichage de progression "k/N" en temps réel
//      entre chaque episode (un appel batch unique masquerait l'avancement).
//   5. Échec sur un episode = push erreur + continue le batch (pas d'abort).
// ============================================================================

interface InsightItem {
  episode_id: string
  type: 'digest' | 'insight'
  status: 'published' | 'archived'
  audio_url: string | null
  title: string | null
  order_idx: number
  published_at: string | null
  updated_at: string
}

interface JournalItem {
  episode_id: string
  type: 'journal'
  status: 'published' | 'archived'
  audio_url: string | null
  title: string | null
  position: number
  published_at: string | null
  updated_at: string
}

interface LinkedEpisodes {
  insight: InsightItem[]
  journals: JournalItem[]
}

interface ResultItem {
  episode_id: string
  status: 'success' | 'error'
  error_message?: string
}

export function EpisodeRegenerationPanel({
  synthesisId,
}: {
  synthesisId: string
}) {
  const [data, setData] = useState<LinkedEpisodes | null>(null)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<string | null>(null)
  const [results, setResults] = useState<ResultItem[]>([])

  useEffect(() => {
    let cancelled = false
    setData(null)
    setFetchError(null)

    fetch(`/api/admin/news/syntheses/${synthesisId}/linked-episodes`, {
      credentials: 'include',
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(
            (body as { error?: string }).error || `HTTP ${res.status}`,
          )
        }
        return (await res.json()) as LinkedEpisodes
      })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setFetchError(err instanceof Error ? err.message : 'Erreur inconnue')
        }
      })

    return () => {
      cancelled = true
    }
  }, [synthesisId])

  // Loading silencieux : tant que data === null sans erreur, ne rien afficher.
  if (data === null && fetchError === null) return null

  if (fetchError) {
    return (
      <section className="bg-white border border-gray-200 rounded p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700 mb-2">
          Régénération audio + timeline
        </h2>
        <p className="text-sm text-red-600">
          Erreur chargement episodes liés : {fetchError}
        </p>
      </section>
    )
  }

  if (!data) return null

  const totalCount = data.insight.length + data.journals.length
  // SECTION ENTIÈREMENT CACHÉE si 0 episode lié (point f maquette M1 finale)
  if (totalCount === 0) return null

  const toggle = (episodeId: string) => {
    if (running) return
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(episodeId)) next.delete(episodeId)
      else next.add(episodeId)
      return next
    })
  }

  const onRegenerate = async () => {
    if (selected.size === 0 || running) return
    setRunning(true)
    setResults([])
    setProgress(`0/${selected.size} — Démarrage…`)

    const ids = Array.from(selected)
    const collected: ResultItem[] = []

    for (let i = 0; i < ids.length; i++) {
      const episodeId = ids[i]
      setProgress(`${i + 1}/${ids.length} — Episode ${episodeId.slice(0, 8)}…`)

      try {
        const res = await fetch(
          `/api/admin/news/syntheses/${synthesisId}/regenerate-linked-episodes`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ episode_ids: [episodeId] }),
          },
        )
        const json = await res.json().catch(() => ({}))

        if (
          res.ok &&
          Array.isArray((json as { results?: unknown }).results) &&
          (json as { results: ResultItem[] }).results[0]
        ) {
          collected.push((json as { results: ResultItem[] }).results[0])
        } else {
          collected.push({
            episode_id: episodeId,
            status: 'error',
            error_message:
              (json as { error?: string }).error || `HTTP ${res.status}`,
          })
        }
      } catch (err) {
        collected.push({
          episode_id: episodeId,
          status: 'error',
          error_message: err instanceof Error ? err.message : 'Erreur réseau',
        })
      }

      // Update live results entre chaque episode (séquentiel, pas batch)
      setResults([...collected])
    }

    const successCount = collected.filter((r) => r.status === 'success').length
    setProgress(`Terminé : ${successCount}/${ids.length} succès`)
    setRunning(false)
  }

  return (
    <section className="bg-white border border-gray-200 rounded p-5 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
        Régénération audio + timeline
      </h2>

      <p className="text-sm text-gray-700">Cette synthèse est utilisée dans :</p>

      <ul className="space-y-1.5">
        {data.insight.map((it) => (
          <EpisodeRow
            key={it.episode_id}
            label={formatInsightLabel(it)}
            checked={selected.has(it.episode_id)}
            onToggle={() => toggle(it.episode_id)}
            disabled={running}
          />
        ))}
        {data.journals.map((it) => (
          <EpisodeRow
            key={it.episode_id}
            label={formatJournalLabel(it)}
            checked={selected.has(it.episode_id)}
            onToggle={() => toggle(it.episode_id)}
            disabled={running}
          />
        ))}
      </ul>

      <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>
          Régénérer = nouvel appel ElevenLabs (séquentiel, pas parallèle).
          L&apos;audio existant est archivé puis remplacé. Le status et la
          date de publication de l&apos;episode restent inchangés.
        </span>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={onRegenerate}
          disabled={selected.size === 0 || running}
          className="text-sm font-medium rounded px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {running
            ? 'Régénération en cours…'
            : `Régénérer les episodes sélectionnés (${selected.size})`}
        </button>
        {progress && (
          <span className="text-sm text-gray-700" aria-live="polite">
            {progress}
          </span>
        )}
      </div>

      {results.length > 0 && (
        <ul className="text-xs space-y-1 mt-1">
          {results.map((r) => (
            <li
              key={r.episode_id}
              className={
                r.status === 'success' ? 'text-green-700' : 'text-red-700'
              }
            >
              {r.status === 'success' ? '✓' : '✗'} {r.episode_id.slice(0, 8)}
              {r.error_message ? ` — ${r.error_message}` : ''}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function EpisodeRow({
  label,
  checked,
  onToggle,
  disabled,
}: {
  label: string
  checked: boolean
  onToggle: () => void
  disabled: boolean
}) {
  return (
    <li>
      <label className="inline-flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          disabled={disabled}
          className="mt-0.5"
        />
        <span>{label}</span>
      </label>
    </li>
  )
}

function formatInsightLabel(it: InsightItem): string {
  const typeLabel = it.type === 'insight' ? 'Insight' : 'Digest'
  const titlePart = it.title
    ? `« ${it.title} »`
    : `#${it.episode_id.slice(0, 8)}`
  const statusLabel = it.status === 'published' ? 'publié' : 'archivé'
  const dateStr = formatDate(it.published_at ?? it.updated_at)
  return `${typeLabel} ${titlePart} — ${statusLabel}${dateStr ? ` ${dateStr}` : ''}`
}

function formatJournalLabel(it: JournalItem): string {
  const titlePart = it.title
    ? `« ${it.title} »`
    : `#${it.episode_id.slice(0, 8)}`
  const statusLabel = it.status === 'published' ? 'publié' : 'archivé'
  const dateStr = formatDate(it.published_at ?? it.updated_at)
  return `Journal ${titlePart} — ${statusLabel}${dateStr ? ` ${dateStr}` : ''} (position ${it.position})`
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}
