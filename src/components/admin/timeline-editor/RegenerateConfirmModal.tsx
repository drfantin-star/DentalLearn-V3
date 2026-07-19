'use client'

import { Modal } from '@/components/ui/Modal'

interface Props {
  onCancel: () => void
  onConfirm: () => void
}

export function RegenerateConfirmModal({ onCancel, onConfirm }: Props) {
  return (
    <Modal
      open
      onClose={onCancel}
      variant="dark"
      size="md"
      ariaLabel="Confirmer la régénération via LLM"
      className="space-y-4 rounded-xl border border-white/10 bg-[color:var(--color-bg-card)] p-5 shadow-xl"
    >
      <h3 className="text-base font-semibold text-white">
        Régénérer la timeline via LLM ?
      </h3>
      <p className="text-sm text-[color:var(--color-text-secondary)]">
        Cette action va remplacer la timeline actuelle par une nouvelle
        génération via Claude Sonnet 4.6.
      </p>
      <ul className="space-y-1 text-xs text-[color:var(--color-text-secondary)]">
        <li>
          <span className="text-[color:var(--color-text-muted)]">
            Coût estimé :
          </span>{' '}
          ~0,07 €
        </li>
        <li>
          <span className="text-[color:var(--color-text-muted)]">
            Durée :
          </span>{' '}
          25 – 35 secondes
        </li>
        <li>
          <span className="text-[color:var(--color-text-muted)]">
            Historique :
          </span>{' '}
          l&apos;ancienne version reste accessible via le panneau « Versions
          précédentes ».
        </li>
      </ul>

      <div className="flex justify-end gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-[color:var(--color-text-secondary)] hover:bg-white/10"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-lg bg-ds-turquoise px-3 py-1.5 text-xs font-semibold text-amber-500 hover:bg-ds-turquoise-dark"
        >
          Confirmer
        </button>
      </div>
    </Modal>
  )
}
