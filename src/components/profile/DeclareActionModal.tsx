'use client'

import { useState } from 'react'
import { X, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { axeHex } from '@/lib/cp/axeColors'

const ACTION_TYPE_LABELS: Record<string, string> = {
  formation_externe: 'Formation externe',
  congres: 'Congrès',
  du_diu: 'DU / DIU',
  epp: 'EPP',
  audit_clinique: 'Audit clinique',
  auto_evaluation: 'Auto-évaluation',
  groupe_pairs: 'Groupe de pairs',
  publication: 'Publication',
  enseignement: 'Enseignement',
  autre: 'Autre',
}

interface Props {
  axeId: number
  axeName: string
  userId: string
  onClose: () => void
  onSuccess: () => void
}

export default function DeclareActionModal({ axeId, axeName, userId, onClose, onSuccess }: Props) {
  const supabase = createClient()
  const [actionType, setActionType] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [proofUrl, setProofUrl] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const axeColor = axeHex(axeId)

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (!actionType || !title || !date) return
    setSubmitting(true)
    setError(null)

    const { error: insertError } = await supabase.from('cp_actions').insert({
      user_id: userId,
      axe_id: axeId,
      action_type: actionType,
      title,
      validation_date: date,
      is_external: true,
      proof_url: proofUrl.trim() || null,
      description: description.trim() || null,
    })

    setSubmitting(false)
    if (insertError) {
      setError('Une erreur est survenue. Veuillez réessayer.')
      return
    }
    onSuccess()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: '#1A1A2E', border: '1px solid rgba(255,255,255,0.12)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="text-white font-bold text-base">Déclarer une action</h2>
            <p className="text-xs mt-0.5" style={{ color: axeColor }}>
              Axe {axeId} — {axeName}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">

          {/* Type d'action */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">Type d'action *</label>
            <select
              value={actionType}
              onChange={e => setActionType(e.target.value)}
              required
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-1 appearance-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', ringColor: axeColor }}
            >
              <option value="" disabled style={{ background: '#1A1A2E' }}>Sélectionner…</option>
              {Object.entries(ACTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value} style={{ background: '#1A1A2E' }}>{label}</option>
              ))}
            </select>
          </div>

          {/* Intitulé */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">Intitulé *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="Ex : Congrès ADF 2025"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-1"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">Date *</label>
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              required
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-1"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', colorScheme: 'dark' }}
            />
          </div>

          {/* Lien justificatif (optionnel) */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">Lien justificatif <span className="text-white/40 font-normal">(optionnel)</span></label>
            <input
              type="url"
              value={proofUrl}
              onChange={e => setProofUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-1"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>

          {/* Précisions (optionnel) */}
          <div>
            <label className="block text-xs font-semibold text-white/70 mb-1.5">Précisions <span className="text-white/40 font-normal">(optionnel)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={2}
              placeholder="Informations complémentaires…"
              className="w-full rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:ring-1 resize-none"
              style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}
            />
          </div>

          {error && (
            <p className="text-sm text-red-400">{error}</p>
          )}

          {/* Boutons */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white/70 hover:text-white transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.15)' }}
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting || !actionType || !title || !date}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              style={{ background: axeColor }}
            >
              {submitting && <Loader2 size={14} className="animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
