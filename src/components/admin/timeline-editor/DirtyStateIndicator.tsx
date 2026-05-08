'use client'

/**
 * Pastille indicateur d'état dirty/saving (POC-T6.1.c).
 */
interface Props {
  isDirty: boolean
  isSaving: boolean
}

export function DirtyStateIndicator({ isDirty, isSaving }: Props) {
  if (isSaving) {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-sky-300">
        <span
          className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-sky-300/30 border-t-sky-300"
          aria-hidden
        />
        Sauvegarde…
      </span>
    )
  }
  if (isDirty) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-amber-300">
        <span className="inline-block h-2 w-2 rounded-full bg-amber-400" />
        Modifications non enregistrées
      </span>
    )
  }
  return null
}
