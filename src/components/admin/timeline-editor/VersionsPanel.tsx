'use client'

import { useState } from 'react'

/**
 * Panneau « Versions précédentes » (POC-T6.5.c).
 *
 * Affiche la liste des fichiers Storage du dossier
 * `audio-timelines/{type}/{source_id}/...`. La version courante (celle
 * qui correspond à `timeline_url` actuel en BDD) est marquée d'un badge
 * `[ACTUELLE]`.
 *
 * V1 : « Voir cette version » ouvre l'URL publique dans un nouvel onglet
 * (consultation JSON brute, copy/paste manuel possible). PAS de rollback
 * automatique — décision arbitrée BLOC 2.
 */

interface Props {
  type: 'formation' | 'news'
  sourceId: string
  /** Liste de versions = noms de fichier sans `.json`, triés date desc. */
  versions: string[]
  /** Storage URL publique de la version actuellement persistée en BDD. */
  currentTimelineUrl: string | null
  /** Bucket public storage URL (extrait depuis `currentTimelineUrl`). */
  storagePublicBaseUrl?: string
}

function isCurrentVersion(
  versionName: string,
  currentTimelineUrl: string | null
): boolean {
  if (!currentTimelineUrl) return false
  return currentTimelineUrl.includes(`/${versionName}.json`)
}

/**
 * Heuristique pour reconstruire l'URL publique d'une version donnée à
 * partir du `currentTimelineUrl` : on remplace simplement le segment
 * `<isoStamp>.json` par le nouveau timestamp. Si `currentTimelineUrl` est
 * null, on fallback à un message « URL indisponible ».
 */
function buildVersionUrl(
  versionName: string,
  currentTimelineUrl: string | null
): string | null {
  if (!currentTimelineUrl) return null
  const lastSlash = currentTimelineUrl.lastIndexOf('/')
  if (lastSlash < 0) return null
  return `${currentTimelineUrl.slice(0, lastSlash + 1)}${versionName}.json`
}

export function VersionsPanel({
  versions,
  currentTimelineUrl,
}: Omit<Props, 'storagePublicBaseUrl'>) {
  const [expanded, setExpanded] = useState(false)

  return (
    <section className="rounded-xl border border-white/5 bg-[color:var(--color-bg-card)]/30">
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
          Versions précédentes ({versions.length})
        </span>
        <span
          className={`text-[color:var(--color-text-muted)] transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </span>
      </button>

      {expanded && (
        <div className="border-t border-white/5 px-4 py-3">
          {versions.length === 0 ? (
            <p className="text-xs italic text-[color:var(--color-text-muted)]">
              Aucune version archivée pour cette source.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {versions.map((version) => {
                const isCurrent = isCurrentVersion(version, currentTimelineUrl)
                const url = buildVersionUrl(version, currentTimelineUrl)
                return (
                  <li
                    key={version}
                    className="flex items-center justify-between gap-2 rounded-md border border-white/5 bg-[color:var(--color-bg-card)]/40 px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="truncate font-mono text-[11px] text-[color:var(--color-text-secondary)]">
                        {version}
                      </span>
                      {isCurrent && (
                        <span className="rounded bg-ds-turquoise/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ds-turquoise">
                          ACTUELLE
                        </span>
                      )}
                    </div>
                    {url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] text-[color:var(--color-text-secondary)] hover:border-ds-turquoise/40 hover:text-white"
                      >
                        Voir cette version
                      </a>
                    ) : (
                      <span
                        className="text-[10px] italic text-[color:var(--color-text-muted)]"
                        title="URL indisponible (timeline_url BDD non renseigné)."
                      >
                        URL indisponible
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
          <p className="mt-3 text-[10px] italic text-[color:var(--color-text-muted)]">
            Astuce : « Voir cette version » ouvre le JSON brut dans un nouvel
            onglet. Pas de rollback automatique — copie/colle si besoin.
          </p>
        </div>
      )}
    </section>
  )
}
