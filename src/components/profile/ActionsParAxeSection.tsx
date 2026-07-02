'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, ExternalLink, Pencil, Trash2, Loader2, X, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { axeHex } from '@/lib/cp/axeColors'
import DeclareActionModal from './DeclareActionModal'

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
  formation_interne: 'Formation interne',
}

interface CpProgress {
  axe_id: number
  axe_name: string
  axe_short_name: string
  actions_completed: number
  required_actions: number
}

interface CpAction {
  id: string
  axe_id: number
  action_type: string
  title: string
  validation_date: string
  proof_url: string | null
  description: string | null
}

interface Props {
  userId: string
  cpProgress: CpProgress[]
  onProgressRefresh: () => void
}

interface EditState {
  actionId: string
  title: string
  proofUrl: string
  description: string
  saving: boolean
}

export default function ActionsParAxeSection({ userId, cpProgress, onProgressRefresh }: Props) {
  const supabase = createClient()
  const [actionsByAxe, setActionsByAxe] = useState<Record<number, CpAction[]>>({})
  const [loadingAxes, setLoadingAxes] = useState<Record<number, boolean>>({})
  const [modalAxeId, setModalAxeId] = useState<number | null>(null)
  const [editState, setEditState] = useState<EditState | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchActionsForAxe = useCallback(async (axeId: number) => {
    setLoadingAxes((prev: Record<number, boolean>) => ({ ...prev, [axeId]: true }))
    const { data } = await supabase
      .from('cp_actions')
      .select('id, axe_id, action_type, title, validation_date, proof_url, description')
      .eq('user_id', userId)
      .eq('axe_id', axeId)
      .eq('is_external', true)
      .order('validation_date', { ascending: false })
    setActionsByAxe((prev: Record<number, CpAction[]>) => ({ ...prev, [axeId]: data ?? [] }))
    setLoadingAxes((prev: Record<number, boolean>) => ({ ...prev, [axeId]: false }))
  }, [supabase, userId])

  useEffect(() => {
    for (const axe of cpProgress) {
      fetchActionsForAxe(axe.axe_id)
    }
  }, [cpProgress, fetchActionsForAxe])

  function handleDeclareSuccess(axeId: number) {
    setModalAxeId(null)
    fetchActionsForAxe(axeId)
    onProgressRefresh()
  }

  async function handleDelete(action: CpAction) {
    setDeletingId(action.id)
    await supabase.from('cp_actions').delete().eq('id', action.id)
    setDeletingId(null)
    fetchActionsForAxe(action.axe_id)
    onProgressRefresh()
  }

  function startEdit(action: CpAction) {
    setEditState({
      actionId: action.id,
      title: action.title,
      proofUrl: action.proof_url ?? '',
      description: action.description ?? '',
      saving: false,
    })
  }

  async function saveEdit(action: CpAction) {
    if (!editState) return
    setEditState((prev: EditState | null) => prev ? { ...prev, saving: true } : null)
    await supabase.from('cp_actions').update({
      title: editState.title,
      proof_url: editState.proofUrl.trim() || null,
      description: editState.description.trim() || null,
    }).eq('id', action.id)
    setEditState(null)
    fetchActionsForAxe(action.axe_id)
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  const axes = cpProgress.filter(p => p.axe_id >= 1 && p.axe_id <= 4).sort((a, b) => a.axe_id - b.axe_id)

  return (
    <section>
      <div className="space-y-3">
        {axes.map(axe => {
          const color = axeHex(axe.axe_id)
          const actions = actionsByAxe[axe.axe_id] ?? []
          const loading = loadingAxes[axe.axe_id]

          return (
            <div key={axe.axe_id} className="glass-card rounded-2xl overflow-hidden">
              {/* Carte header */}
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                  <span className="text-sm font-semibold text-white">{axe.axe_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold" style={{ color }}>
                    {axe.actions_completed}/{axe.required_actions}
                  </span>
                  <button
                    onClick={() => setModalAxeId(axe.axe_id)}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                    style={{ background: `${color}28`, border: `1px solid ${color}55` }}
                  >
                    <Plus size={12} />
                    Déclarer
                  </button>
                </div>
              </div>

              {/* Liste des actions */}
              <div className="px-4 py-3">
                {loading ? (
                  <div className="flex justify-center py-3">
                    <Loader2 size={16} className="animate-spin text-white/40" />
                  </div>
                ) : actions.length === 0 ? (
                  <p className="text-sm text-white/40 text-center py-2">Aucune action déclarée</p>
                ) : (
                  <ul className="space-y-2">
                    {actions.map(action => {
                      const isEditing = editState?.actionId === action.id
                      return (
                        <li key={action.id} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          {isEditing && editState ? (
                            /* Mode édition */
                            <div className="space-y-2">
                              <input
                                type="text"
                                value={editState.title}
                                onChange={e => { const v = e.target.value; setEditState((prev: EditState | null) => prev ? { ...prev, title: v } : null) }}
                                className="w-full rounded-lg px-2.5 py-1.5 text-sm text-white outline-none"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                              />
                              <input
                                type="url"
                                value={editState.proofUrl}
                                onChange={e => { const v = e.target.value; setEditState((prev: EditState | null) => prev ? { ...prev, proofUrl: v } : null) }}
                                placeholder="Lien justificatif (optionnel)"
                                className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 outline-none"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                              />
                              <input
                                type="text"
                                value={editState.description}
                                onChange={e => { const v = e.target.value; setEditState((prev: EditState | null) => prev ? { ...prev, description: v } : null) }}
                                placeholder="Précisions (optionnel)"
                                className="w-full rounded-lg px-2.5 py-1.5 text-xs text-white placeholder:text-white/30 outline-none"
                                style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)' }}
                              />
                              <div className="flex gap-2 justify-end">
                                <button onClick={() => setEditState(null)} className="p-1.5 rounded-lg text-white/50 hover:text-white transition-colors">
                                  <X size={14} />
                                </button>
                                <button
                                  onClick={() => saveEdit(action)}
                                  disabled={editState.saving}
                                  className="p-1.5 rounded-lg transition-colors"
                                  style={{ color }}
                                >
                                  {editState.saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                                </button>
                              </div>
                            </div>
                          ) : (
                            /* Mode lecture */
                            <div className="flex items-start gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-medium text-white truncate">{action.title}</span>
                                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0 text-white/80" style={{ background: `${color}25` }}>
                                    Déclaré
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1 flex-wrap">
                                  <span className="text-xs text-white/50">{ACTION_TYPE_LABELS[action.action_type] ?? action.action_type}</span>
                                  <span className="text-white/25 text-xs">·</span>
                                  <span className="text-xs text-white/50">{formatDate(action.validation_date)}</span>
                                  {action.proof_url && (
                                    <a href={action.proof_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs hover:opacity-80 transition-opacity" style={{ color }}>
                                      <ExternalLink size={10} />
                                      Justificatif
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <button onClick={() => startEdit(action)} className="p-1.5 rounded-lg text-white/40 hover:text-white/70 transition-colors">
                                  <Pencil size={13} />
                                </button>
                                <button
                                  onClick={() => handleDelete(action)}
                                  disabled={deletingId === action.id}
                                  className="p-1.5 rounded-lg text-white/40 hover:text-red-400 transition-colors"
                                >
                                  {deletingId === action.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                </button>
                              </div>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Modal de déclaration */}
      {modalAxeId !== null && (
        <DeclareActionModal
          axeId={modalAxeId}
          axeName={axes.find(a => a.axe_id === modalAxeId)?.axe_name ?? ''}
          userId={userId}
          onClose={() => setModalAxeId(null)}
          onSuccess={() => handleDeclareSuccess(modalAxeId)}
        />
      )}
    </section>
  )
}
