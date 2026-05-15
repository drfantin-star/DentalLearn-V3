'use client'

import { useEffect, useState } from 'react'
import {
  Star,
  CheckCircle2,
  XCircle,
  Eye,
  Loader2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export interface Verbatim {
  survey_id: string
  formation_id: string
  formation_title: string
  rating_overall: number
  rating_content: number
  rating_pedagogy: number
  rating_ergonomics: number
  rating_avg: number
  would_recommend: boolean
  strong_points: string | null
  improvement_points: string | null
  free_comment: string | null
  has_been_revealed: boolean
  created_at: string
}

interface RevealedIdentity {
  first_name: string | null
  last_name: string | null
  email: string | null
  rpps: string | null
}

interface Props {
  verbatim: Verbatim
}

function formatDateLong(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function StarsInline({ value }: { value: number }) {
  const rounded = Math.round(value)
  return (
    <span className="inline-flex items-center" aria-label={`${value.toFixed(2)} sur 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={14}
          className={n <= rounded ? 'text-amber-500' : 'text-gray-300'}
          fill={n <= rounded ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  )
}

function VerbatimSection({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
        <span className="text-gray-400 mr-1">▸</span>
        “{text}”
      </p>
    </div>
  )
}

export function VerbatimCard({ verbatim: v }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [reason, setReason] = useState('')
  const [revealing, setRevealing] = useState(false)
  const [revealError, setRevealError] = useState<string | null>(null)
  const [identity, setIdentity] = useState<RevealedIdentity | null>(null)

  useEffect(() => {
    if (!showConfirm) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !revealing) setShowConfirm(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [showConfirm, revealing])

  const hasAnyText =
    !!(v.strong_points && v.strong_points.trim()) ||
    !!(v.improvement_points && v.improvement_points.trim()) ||
    !!(v.free_comment && v.free_comment.trim())

  const handleConfirmReveal = async () => {
    setRevealing(true)
    setRevealError(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .rpc('reveal_satisfaction_respondent', {
          p_survey_id: v.survey_id,
          p_reason: reason.trim() || null,
        })
        .single()

      if (error) throw error
      const row = data as {
        user_id: string | null
        first_name: string | null
        last_name: string | null
        email: string | null
        rpps: string | null
      } | null
      if (!row) throw new Error('Aucune donnée retournée')

      setIdentity({
        first_name: row.first_name,
        last_name: row.last_name,
        email: row.email,
        rpps: row.rpps,
      })
      setShowConfirm(false)
      setReason('')
    } catch (err: any) {
      console.error('reveal_satisfaction_respondent error:', err)
      setRevealError(err.message || 'Erreur lors de la révélation')
    } finally {
      setRevealing(false)
    }
  }

  const fullName =
    identity && (identity.first_name || identity.last_name)
      ? `Dr ${(identity.last_name || '').toUpperCase()} ${identity.first_name || ''}`.trim()
      : null

  return (
    <div className="bg-white rounded-2xl shadow-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs text-gray-500 mb-1">
            {formatDateLong(v.created_at)} · {v.formation_title}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <StarsInline value={v.rating_avg} />
            <span className="text-sm font-semibold text-gray-900">
              {Number(v.rating_avg).toFixed(2)}/5
            </span>
            {v.would_recommend ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
                <CheckCircle2 size={12} />
                Recommande
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                <XCircle size={12} />
                Ne recommande pas
              </span>
            )}
          </div>
          {fullName && (
            <p className="mt-2 text-sm text-gray-800">
              <span className="font-semibold">{fullName}</span>
              {identity?.email && <span className="text-gray-500"> · {identity.email}</span>}
              {identity?.rpps && <span className="text-gray-500"> · RPPS {identity.rpps}</span>}
            </p>
          )}
          {v.has_been_revealed && !identity && (
            <p className="mt-2 inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">
              <ShieldAlert size={12} />
              Identité déjà révélée précédemment
            </p>
          )}
        </div>

        {!identity && (
          <button
            type="button"
            onClick={() => setShowConfirm(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors flex-shrink-0"
          >
            <Eye size={14} />
            Identifier ce répondant
          </button>
        )}
      </div>

      {/* Verbatims */}
      {hasAnyText ? (
        <div className="space-y-3">
          {v.strong_points && v.strong_points.trim() && (
            <VerbatimSection label="Points forts" text={v.strong_points.trim()} />
          )}
          {v.improvement_points && v.improvement_points.trim() && (
            <VerbatimSection label="Points à améliorer" text={v.improvement_points.trim()} />
          )}
          {v.free_comment && v.free_comment.trim() && (
            <VerbatimSection label="Commentaire libre" text={v.free_comment.trim()} />
          )}
        </div>
      ) : (
        <p className="text-xs italic text-gray-400">Pas de commentaire écrit.</p>
      )}

      {/* Sub-ratings */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-100 text-xs">
        <div>
          <p className="text-gray-500">Globale</p>
          <p className="font-semibold text-gray-900">{v.rating_overall}/5</p>
        </div>
        <div>
          <p className="text-gray-500">Contenu</p>
          <p className="font-semibold text-gray-900">{v.rating_content}/5</p>
        </div>
        <div>
          <p className="text-gray-500">Pédagogie</p>
          <p className="font-semibold text-gray-900">{v.rating_pedagogy}/5</p>
        </div>
        <div>
          <p className="text-gray-500">Ergonomie</p>
          <p className="font-semibold text-gray-900">{v.rating_ergonomics}/5</p>
        </div>
      </div>

      {revealError && (
        <p className="inline-flex items-center gap-1 text-sm text-red-600">
          <AlertCircle size={14} />
          {revealError}
        </p>
      )}

      {/* Confirm modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <ShieldAlert className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Révéler l'identité du répondant</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Cette action sera enregistrée dans le journal d'audit RGPD. Le répondant pourra savoir que son identité a été consultée s'il en fait la demande (Art. 15 RGPD).
                </p>
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">
                Raison de la consultation <span className="text-gray-400 font-normal">(recommandé)</span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex. : prise de contact pour traiter un point d'amélioration mentionné…"
                rows={3}
                className="w-full text-sm px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary resize-y"
              />
            </div>

            {revealError && (
              <p className="text-sm text-red-600">{revealError}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  if (!revealing) setShowConfirm(false)
                }}
                disabled={revealing}
                className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmReveal}
                disabled={revealing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-white hover:bg-primary-hover transition-colors disabled:opacity-60"
              >
                {revealing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Révélation…
                  </>
                ) : (
                  'Confirmer la révélation'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VerbatimCard
