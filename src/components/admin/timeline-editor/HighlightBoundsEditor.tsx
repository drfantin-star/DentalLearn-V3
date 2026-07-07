'use client'

/**
 * Édition des bornes de surbrillance audio d'un item (Lot 3, juillet 2026).
 *
 * Champs numériques en secondes, optionnels et vidables (champ vide =>
 * propriété supprimée de l'item => repli "pas de surbrillance" côté player).
 * Les bornes sont normalement écrites par l'enrichissement déterministe
 * (module `highlight-matching.ts`, bouton "Recalculer les surbrillances" de
 * la scène) — cet éditeur sert à l'ajustement manuel fin.
 *
 * Validation légère, NON bloquante (le schéma Zod n'impose aucun refine
 * croisé sur ces champs, la sauvegarde passe) :
 *  - `at >= end` (les deux présents) : rouge — bornes incohérentes.
 *  - borne hors de la fenêtre [start_sec, end_sec] de la scène : orange —
 *    l'item ne s'allumera pas côté player (le relais 7B s'éteint en fin de
 *    scène et ne démarre qu'à son début).
 */

export interface HighlightBoundsValue {
  highlight_at_sec?: number
  highlight_end_sec?: number
}

interface Props {
  value: HighlightBoundsValue
  onChange: (next: HighlightBoundsValue) => void
  /** Fenêtre de la scène courante, pour le warning hors-fenêtre. */
  sceneStartSec?: number
  sceneEndSec?: number
}

function parseOptionalSec(raw: string): number | undefined {
  if (raw.trim() === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  return n
}

export function HighlightBoundsEditor({
  value,
  onChange,
  sceneStartSec,
  sceneEndSec,
}: Props) {
  const at = value.highlight_at_sec
  const end = value.highlight_end_sec

  const invalidOrder =
    typeof at === 'number' && typeof end === 'number' && at >= end
  const outOfWindow =
    typeof sceneStartSec === 'number' &&
    typeof sceneEndSec === 'number' &&
    ((typeof at === 'number' && (at < sceneStartSec || at > sceneEndSec)) ||
      (typeof end === 'number' && (end < sceneStartSec || end > sceneEndSec)))

  function emit(nextAt: number | undefined, nextEnd: number | undefined) {
    const next: HighlightBoundsValue = {}
    if (typeof nextAt === 'number') next.highlight_at_sec = nextAt
    if (typeof nextEnd === 'number') next.highlight_end_sec = nextEnd
    onChange(next)
  }

  const inputClass = (invalid: boolean) =>
    `w-full rounded-md border px-2 py-1 font-mono text-xs text-white focus:outline-none ${
      invalid
        ? 'border-red-500 bg-red-500/10'
        : 'border-white/10 bg-[color:var(--color-bg-input)] focus:border-ds-turquoise'
    }`

  return (
    <div>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-[color:var(--color-text-muted)]">
        Surbrillance audio (sec)
      </p>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          min="0"
          step="0.1"
          value={at ?? ''}
          onChange={(e) => emit(parseOptionalSec(e.target.value), end)}
          placeholder="Début (vide = off)"
          aria-label="Debut de surbrillance (secondes)"
          className={inputClass(invalidOrder)}
        />
        <input
          type="number"
          min="0"
          step="0.1"
          value={end ?? ''}
          onChange={(e) => emit(at, parseOptionalSec(e.target.value))}
          placeholder="Fin"
          aria-label="Fin de surbrillance (secondes)"
          className={inputClass(invalidOrder)}
        />
      </div>
      {invalidOrder && (
        <p className="mt-1 text-[10px] text-red-300">
          Le début de surbrillance doit être avant la fin.
        </p>
      )}
      {!invalidOrder && outOfWindow && (
        <p className="mt-1 text-[10px] text-orange-300">
          Borne hors de la fenêtre de la scène — l&apos;item ne s&apos;allumera
          pas côté player.
        </p>
      )}
    </div>
  )
}
