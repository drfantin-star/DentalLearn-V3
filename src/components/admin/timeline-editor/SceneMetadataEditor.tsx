'use client'

import type { Scene } from '@/lib/timeline/schema'

/**
 * Édition des métadonnées scène — POC-T6.2.
 *
 * Champs :
 *  - title (string optionnel, mais on l'affiche toujours en édition)
 *  - start_sec / end_sec (number ≥ 0)
 *  - pedagogical_intent (string optionnel — non persisté en V1, le schéma
 *    Zod ne le contient pas. On l'expose tout de même via l'UI pour
 *    discussion ; le state local le stocke seulement le temps de l'édition.
 *    NOTE T6.2 : à confirmer par Dr Fantin si ce champ doit être ajouté
 *    au schéma — voir dette dans RECAP_TECHNIQUE_T6_BLOC1.md.)
 *
 * Validation :
 *  - Bordure rouge si start_sec >= end_sec — refusé côté schéma Zod
 *    depuis T6-D1 (résolu). La sauvegarde retourne 400.
 *  - Banner orange si overlap avec une scène voisine.
 *  - Banner orange si durée < 5s ou > 60s.
 *
 * Tous les changements remontent immédiatement via `onChange` — la dirty
 * flag est gérée par le parent.
 */

interface Props {
  scene: Scene
  onChange: (next: Scene) => void
  audioDurationSec: number
  siblingScenes: Scene[] // toutes scènes sauf celle en cours
}

function formatSec(sec: number): string {
  const total = Math.max(0, Math.round(sec))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function clampNonNegative(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, n)
}

export function SceneMetadataEditor({
  scene,
  onChange,
  audioDurationSec,
  siblingScenes,
}: Props) {
  const startInvalid = scene.start_sec >= scene.end_sec
  const duration = Math.max(0, scene.end_sec - scene.start_sec)

  // Détection overlap : on cherche au moins une scène voisine dont
  // [start, end] croise [scene.start, scene.end].
  const overlapWith = siblingScenes.find((s) => {
    return scene.start_sec < s.end_sec && scene.end_sec > s.start_sec
  })

  const tooShort = duration < 5
  const tooLong = duration > 60

  return (
    <section className="space-y-4">
      <h3 className="text-xs uppercase tracking-wider text-[color:var(--color-text-muted)]">
        Métadonnées
      </h3>

      {/* Title */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[color:var(--color-text-secondary)]">
          Titre de la scène
        </label>
        <input
          type="text"
          value={scene.title ?? ''}
          onChange={(e) => onChange({ ...scene, title: e.target.value })}
          placeholder="(optionnel)"
          className="w-full rounded-lg border border-white/10 bg-[color:var(--color-bg-input)] px-3 py-2 text-sm text-white focus:border-ds-turquoise focus:outline-none"
        />
      </div>

      {/* Times */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[color:var(--color-text-secondary)]">
            Début (sec)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={scene.start_sec}
            onChange={(e) =>
              onChange({
                ...scene,
                start_sec: clampNonNegative(Number(e.target.value)),
              })
            }
            className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
              startInvalid
                ? 'border-red-500 bg-red-500/10'
                : 'border-white/10 bg-[color:var(--color-bg-input)] focus:border-ds-turquoise'
            }`}
          />
          <p className="mt-1 font-mono text-[10px] text-[color:var(--color-text-muted)]">
            {formatSec(scene.start_sec)}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-[color:var(--color-text-secondary)]">
            Fin (sec)
          </label>
          <input
            type="number"
            min="0"
            step="0.1"
            value={scene.end_sec}
            onChange={(e) =>
              onChange({
                ...scene,
                end_sec: clampNonNegative(Number(e.target.value)),
              })
            }
            className={`w-full rounded-lg border px-3 py-2 text-sm text-white focus:outline-none ${
              startInvalid
                ? 'border-red-500 bg-red-500/10'
                : 'border-white/10 bg-[color:var(--color-bg-input)] focus:border-ds-turquoise'
            }`}
          />
          <p className="mt-1 font-mono text-[10px] text-[color:var(--color-text-muted)]">
            {formatSec(scene.end_sec)}
            {audioDurationSec > 0 && scene.end_sec > audioDurationSec && (
              <span className="ml-2 text-red-300">
                (dépasse {formatSec(audioDurationSec)})
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Banners — non bloquants */}
      <div className="space-y-2">
        {startInvalid && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            Le début doit être strictement avant la fin.
          </p>
        )}
        {overlapWith && (
          <p className="rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
            Cette scène chevauche la scène «{' '}
            {overlapWith.title?.trim() || '(sans titre)'} ».
          </p>
        )}
        {tooShort && !startInvalid && (
          <p className="rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
            Durée très courte ({duration.toFixed(1)}s &lt; 5s).
          </p>
        )}
        {tooLong && (
          <p className="rounded-md border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
            Durée très longue ({duration.toFixed(1)}s &gt; 60s).
          </p>
        )}
      </div>

      {/* Pedagogical intent — persisté dans scene.pedagogical_intent (T6-D2 résolu) */}
      <div>
        <label className="mb-1 block text-[11px] font-medium text-[color:var(--color-text-secondary)]">
          Intention pédagogique
          <span className="ml-2 text-[9px] font-normal italic text-[color:var(--color-text-muted)]">
            (optionnel · max 500 caractères)
          </span>
        </label>
        <textarea
          value={scene.pedagogical_intent ?? ''}
          onChange={(e) => {
            const v = e.target.value
            const next = { ...scene }
            if (v.length === 0) {
              delete next.pedagogical_intent
            } else {
              next.pedagogical_intent = v
            }
            onChange(next)
          }}
          rows={2}
          maxLength={500}
          placeholder="Ex : Faire mémoriser les 3 facteurs aggravants…"
          className="w-full resize-none rounded-lg border border-white/10 bg-[color:var(--color-bg-input)] px-3 py-2 text-sm text-white focus:border-ds-turquoise focus:outline-none"
        />
        <div className="mt-0.5 flex justify-end">
          <span className="font-mono text-[10px] text-[color:var(--color-text-muted)]">
            {(scene.pedagogical_intent ?? '').length}/500
          </span>
        </div>
      </div>
    </section>
  )
}
