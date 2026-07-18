'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/Button'

interface ReviewDecisionModalProps {
  title: string
  onClose: () => void
  onSubmit: (decision: 'approved' | 'rejected', comment: string | null) => Promise<void>
}

// Modale partagée formateur/superadmin pour trancher une masterclass en
// attente : Approuver ou Refuser (motif obligatoire au refus, imposé aussi
// côté RPC review_live_session — cette validation client est un confort UX,
// pas la barrière réelle).
export default function ReviewDecisionModal({ title, onClose, onSubmit }: ReviewDecisionModalProps) {
  const [decision, setDecision] = useState<'approved' | 'rejected'>('approved')
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (decision === 'rejected' && comment.trim() === '') {
      setError('Un motif de refus est obligatoire.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit(decision, decision === 'rejected' ? comment.trim() : null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inattendue')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
            aria-label="Fermer"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDecision('approved')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                decision === 'approved'
                  ? 'bg-emerald-50 border-emerald-400 text-emerald-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Approuver
            </button>
            <button
              type="button"
              onClick={() => setDecision('rejected')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                decision === 'rejected'
                  ? 'bg-red-50 border-red-400 text-red-700'
                  : 'border-gray-300 text-gray-600 hover:bg-gray-50'
              }`}
            >
              Refuser
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Motif {decision === 'rejected' && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={decision === 'rejected' ? 'Expliquez le refus (obligatoire)…' : 'Optionnel'}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>
          )}
        </div>

        <div className="p-5 border-t border-gray-200 flex gap-2">
          <Button variant="secondary" size="md" onClick={onClose} disabled={submitting} className="flex-1">
            Annuler
          </Button>
          <Button variant="primary" size="md" onClick={handleConfirm} disabled={submitting} className="flex-1">
            {submitting ? 'Envoi…' : 'Confirmer'}
          </Button>
        </div>
      </div>
    </div>
  )
}
