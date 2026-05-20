'use client'

import React, { useState } from 'react'
import { GraduationCap, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  formationId: string
  formationTitle: string
  onSuccess: () => void
  variant: 'fixed-bottom' | 'inline'
  gradient?: { from: string; to: string }
  label?: string
}

export default function EnrollmentCTA({
  formationId,
  formationTitle: _formationTitle,
  onSuccess,
  variant,
  gradient,
  label,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const handleEnroll = async () => {
    if (loading) return
    setLoading(true)
    setMessage(null)

    const supabase = createClient()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setMessage({ kind: 'error', text: 'Erreur lors de l\'inscription, réessaie' })
        setLoading(false)
        return
      }

      await supabase
        .from('user_formations')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .neq('formation_id', formationId)

      const { error } = await supabase
        .from('user_formations')
        .insert({
          user_id: user.id,
          formation_id: formationId,
          is_active: true,
          current_sequence: 1,
          access_type: 'full',
          started_at: new Date().toISOString(),
        })
        .select()

      if (error) {
        // Code Postgres 23505 = violation contrainte unique = déjà inscrit.
        // On resync l'UI au lieu d'afficher une erreur frustrante (le user
        // EST inscrit, l'état local était stale).
        if (error.code === '23505') {
          onSuccess()
          return
        }
        // Autre erreur (réseau, RLS, etc.) → message classique
        throw error
      }

      setMessage({ kind: 'success', text: 'Inscription réussie ! Bonne formation 🎓' })
      onSuccess()
    } catch (err) {
      console.error('Erreur EnrollmentCTA:', err)
      setMessage({ kind: 'error', text: 'Erreur lors de l\'inscription, réessaie' })
    } finally {
      setLoading(false)
    }
  }

  const buttonLabel = label || 'S\'inscrire à cette formation gratuitement'
  const grad = gradient || { from: '#8B5CF6', to: '#A78BFA' }

  if (variant === 'fixed-bottom') {
    return (
      <div className="w-full">
        <button
          onClick={handleEnroll}
          disabled={loading}
          className="w-full py-3.5 rounded-2xl font-bold text-[15px] text-white flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
          }}
        >
          {loading ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <GraduationCap size={18} />
          )}
          {loading ? 'Inscription…' : buttonLabel}
        </button>
        {message && (
          <p
            className={`mt-2 text-center text-[12px] font-medium ${
              message.kind === 'success' ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {message.text}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="w-full">
      <button
        onClick={handleEnroll}
        disabled={loading}
        className="w-full py-3 px-4 rounded-2xl font-bold text-[14px] text-white flex items-center justify-center gap-2 shadow-md transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
        style={{
          background: `linear-gradient(135deg, ${grad.from}, ${grad.to})`,
        }}
      >
        {loading ? (
          <Loader2 size={16} className="animate-spin" />
        ) : (
          <GraduationCap size={16} />
        )}
        {loading ? 'Inscription…' : buttonLabel}
      </button>
      {message && (
        <p
          className={`mt-2 text-center text-[12px] font-medium ${
            message.kind === 'success' ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
