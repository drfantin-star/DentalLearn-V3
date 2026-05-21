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

  // Pont autorisé course_watch_logs (DPC) → user_sequences (pédagogique),
  // cantonné aux intros audio-only. Quand un user écoute l'intro AVANT de
  // s'inscrire, course_watch_logs.completed=true existe mais aucune ligne
  // user_sequences n'a été créée (le write est gaté pour les non-inscrits).
  // À l'inscription, on rétro-marque ces intros complétées pour que la barre
  // de progression et la pastille ✓ reflètent l'écoute immédiatement.
  // Best-effort : ne bloque jamais l'inscription en cas d'échec.
  const backfillIntroCompletions = async (
    supabase: ReturnType<typeof createClient>,
    userId: string,
  ) => {
    try {
      const { data: intros, error: introsErr } = await supabase
        .from('sequences')
        .select('id')
        .eq('formation_id', formationId)
        .eq('is_intro', true)
      if (introsErr || !intros?.length) return

      const introIds = intros.map((s) => s.id)

      const { data: watched, error: watchedErr } = await supabase
        .from('course_watch_logs')
        .select('sequence_id')
        .eq('user_id', userId)
        .eq('completed', true)
        .in('sequence_id', introIds)
      if (watchedErr || !watched?.length) return

      const completedIntroIds = Array.from(
        new Set(watched.map((w) => w.sequence_id)),
      )

      // Règle métier : pour une séquence mixte (audio + quiz), l'écoute seule
      // ne suffit pas. On exclut donc toute intro qui possède au moins une
      // question. Cas audio-only uniquement.
      const { data: quizzed, error: quizErr } = await supabase
        .from('questions')
        .select('sequence_id')
        .in('sequence_id', completedIntroIds)
      if (quizErr) return

      const sequenceIdsWithQuiz = new Set(
        (quizzed || []).map((q) => q.sequence_id),
      )
      const audioOnlyCompletedIntros = completedIntroIds.filter(
        (id) => !sequenceIdsWithQuiz.has(id),
      )
      if (!audioOnlyCompletedIntros.length) return

      await supabase.from('user_sequences').upsert(
        audioOnlyCompletedIntros.map((sequenceId) => ({
          user_id: userId,
          sequence_id: sequenceId,
          completed_at: new Date().toISOString(),
        })),
        { onConflict: 'user_id,sequence_id', ignoreDuplicates: false },
      )
    } catch (err) {
      console.error('Erreur backfill intro completions:', err)
    }
  }

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
          await backfillIntroCompletions(supabase, user.id)
          onSuccess()
          return
        }
        // Autre erreur (réseau, RLS, etc.) → message classique
        throw error
      }

      // Rétro-marquer l'intro audio-only éventuellement déjà écoutée AVANT
      // d'appeler onSuccess(), pour éviter le flash visuel "0/N → 1/N".
      await backfillIntroCompletions(supabase, user.id)

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
