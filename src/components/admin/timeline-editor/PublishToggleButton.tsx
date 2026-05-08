'use client'

import { useState } from 'react'

/**
 * Bouton publier/dépublier — POC-T6.1.c.
 *
 * Affiche une pastille (Publié vert / Brouillon gris). Au clic :
 *  - Si on bascule en publié, demande confirmation native via window.confirm.
 *  - Appelle `onPublish(next)` qui doit POST vers /publish.
 */
interface Props {
  published: boolean
  onPublish: (next: boolean) => Promise<void>
  disabled?: boolean
}

export function PublishToggleButton({ published, onPublish, disabled }: Props) {
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (busy || disabled) return
    const next = !published
    if (next) {
      const confirmed = window.confirm(
        'Publier cette timeline ? Elle sera visible par les utilisateurs côté formation.'
      )
      if (!confirmed) return
    }
    setBusy(true)
    try {
      await onPublish(next)
    } finally {
      setBusy(false)
    }
  }

  const baseClass =
    'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50'

  if (published) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || disabled}
        className={`${baseClass} bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25`}
        aria-label="Dépublier la timeline"
      >
        <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
        Publié
        <span className="ml-1 text-[10px] uppercase tracking-wider opacity-70">
          {busy ? '…' : 'cliquer pour dépublier'}
        </span>
      </button>
    )
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || disabled}
      className={`${baseClass} bg-white/5 text-[color:var(--color-text-secondary)] hover:bg-white/10`}
      aria-label="Publier la timeline"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-[color:var(--color-text-muted)]" />
      Brouillon
      <span className="ml-1 text-[10px] uppercase tracking-wider opacity-70">
        {busy ? '…' : 'cliquer pour publier'}
      </span>
    </button>
  )
}
