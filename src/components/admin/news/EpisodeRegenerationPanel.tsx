'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

// ============================================================================
// <EpisodeRegenerationPanel> — POC-T12-D-3 + T12-D-bis-3-B
//
// Panneau autonome consommé dans SynthesisEditForm. Cycle :
//   1. Fetch /api/admin/news/syntheses/[id]/linked-episodes au mount.
//   2. Si réponse vide (insight=[] ET journals=[]) → return null
//      (SECTION ENTIÈREMENT CACHÉE, pas de message "Aucun episode" —
//      cohérent §6.1 maquette M1 finale point f).
//   3. Sinon : picker checkboxes + bouton "Régénérer script + audio + timeline (N)"
//      + warning ⚠.
//   4. Au clic Régénérer : boucle CLIENT séquentielle (1 episode à la fois).
//      Branchement par type d'episode :
//        - journal : 2 appels client séquentiels —
//            (a) journal/[id]/generate-script?regenerate=true (toast "script en cours")
//            (b) journal/[id]/generate-audio?regenerate=true (toast "audio + timeline")
//          → propage les corrections de synthèses au podcast (T12-D-bis-3).
//        - insight/digest : 1 appel à regenerate-linked-episodes
//          (audio + timeline seulement, script reste manuel via AudioPodcastBlock).
//   5. Échec sur un episode = push résultat (error / partial_success) + continue.
//      partial_success = phase script OK mais phase audio KO sur journal :
//      état BDD incohérent à resync (cf. D-T12-D-bis-3-CLIENT-ORCHESTRATION).
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
  status: 'success' | 'error' | 'partial_success'
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
          Régénération script + audio + timeline
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

    // Map episode_id → type (recouvert depuis data déjà fetché).
    // Pour les journaux : chaîne script→audio orchestrée côté client (toast
    // multi-phases). Pour insights/digests : path inchangé via
    // regenerate-linked-episodes (audio seulement, workflow manuel script
    // documenté D-T12-INSIGHT-MANUAL-WORKFLOW).
    const typeByEpisodeId = new Map<string, 'journal' | 'insight' | 'digest'>()
    for (const it of data.insight) typeByEpisodeId.set(it.episode_id, it.type)
    for (const it of data.journals) typeByEpisodeId.set(it.episode_id, it.type)

    const ids = Array.from(selected)
    const collected: ResultItem[] = []

    for (let i = 0; i < ids.length; i++) {
      const episodeId = ids[i]
      const type = typeByEpisodeId.get(episodeId)

      if (type === 'journal') {
        // ---- Phase 1 : régénération script Sonnet ----
        setProgress(
          `${i + 1}/${ids.length} — journal: script en cours…`,
        )
        let scriptOk = false
        let scriptErr: string | null = null
        try {
          const res = await fetch(
            `/api/admin/news/journal/${episodeId}/generate-script?regenerate=true`,
            {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            },
          )
          if (res.ok) {
            scriptOk = true
          } else {
            const body = await res.json().catch(() => ({}))
            scriptErr =
              (body as { error?: string }).error || `HTTP ${res.status}`
          }
        } catch (err) {
          scriptErr = err instanceof Error ? err.message : 'Erreur réseau'
        }

        if (!scriptOk) {
          collected.push({
            episode_id: episodeId,
            status: 'error',
            error_message: `Script: ${scriptErr ?? 'erreur inconnue'}`,
          })
          setResults([...collected])
          continue
        }

        // ---- Phase 2 : régénération audio + timeline ElevenLabs ----
        // D-T12-D-bis-3-CLIENT-ORCHESTRATION : si l'admin ferme l'onglet
        // entre phase 1 et phase 2, état incohérent possible (script nouveau
        // + audio ancien). Mitigation : statut 'partial_success' explicite
        // si phase 2 échoue après succès phase 1.
        setProgress(
          `${i + 1}/${ids.length} — journal: audio + timeline en cours…`,
        )
        try {
          const res = await fetch(
            `/api/admin/news/journal/${episodeId}/generate-audio?regenerate=true`,
            {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({}),
            },
          )
          if (res.ok) {
            collected.push({ episode_id: episodeId, status: 'success' })
          } else {
            const body = await res.json().catch(() => ({}))
            const audioErr =
              (body as { error?: string }).error || `HTTP ${res.status}`
            collected.push({
              episode_id: episodeId,
              status: 'partial_success',
              error_message: `Script OK, audio en échec — ${audioErr}. Recliquer 'Régénérer' pour resynchroniser l'audio.`,
            })
          }
        } catch (err) {
          collected.push({
            episode_id: episodeId,
            status: 'partial_success',
            error_message: `Script OK, audio en échec — ${err instanceof Error ? err.message : 'Erreur réseau'}. Recliquer 'Régénérer' pour resynchroniser l'audio.`,
          })
        }
      } else {
        // ---- insight/digest : path inchangé (audio + timeline uniquement) ----
        setProgress(
          `${i + 1}/${ids.length} — insight: audio + timeline en cours…`,
        )
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
            error_message:
              err instanceof Error ? err.message : 'Erreur réseau',
          })
        }
      }

      setResults([...collected])
    }

    const successCount = collected.filter((r) => r.status === 'success').length
    const partialCount = collected.filter(
      (r) => r.status === 'partial_success',
    ).length
    if (partialCount > 0) {
      setProgress(
        `Terminé : ${successCount}/${ids.length} succès, ${partialCount} partiel(s)`,
      )
    } else {
      setProgress(`Terminé : ${successCount}/${ids.length} succès`)
    }
    setRunning(false)
  }

  return (
    <section className="bg-white border border-gray-200 rounded p-5 space-y-3">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-700">
        Régénération script + audio + timeline
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
          Régénère le script (Sonnet) depuis les synthèses corrigées, puis
          l&apos;audio (ElevenLabs), puis la timeline. Status et date de
          publication préservés. L&apos;ancien audio est archivé en Storage.
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
            : `Régénérer script + audio + timeline (${selected.size})`}
        </button>
        {progress && (
          <span className="text-sm text-gray-700" aria-live="polite">
            {progress}
          </span>
        )}
      </div>

      {results.length > 0 && (
        <ul className="text-xs space-y-1 mt-1">
          {results.map((r) => {
            const colorClass =
              r.status === 'success'
                ? 'text-green-700'
                : r.status === 'partial_success'
                  ? 'text-amber-700'
                  : 'text-red-700'
            const icon =
              r.status === 'success'
                ? '✓'
                : r.status === 'partial_success'
                  ? '⚠️'
                  : '✗'
            return (
              <li key={r.episode_id} className={colorClass}>
                {icon} {r.episode_id.slice(0, 8)}
                {r.error_message ? ` — ${r.error_message}` : ''}
              </li>
            )
          })}
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
