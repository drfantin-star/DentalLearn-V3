'use client'

import React, { useState } from 'react'
import { GraduationCap, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSubmitSequenceResult, useUserFormationProgress } from '@/lib/supabase/hooks'

// Résultat du quiz d'intro joué AVANT inscription, conservé en mémoire React
// (pas de localStorage) le temps que l'utilisateur clique « S'inscrire ».
// Prioritaire sur la reconstitution base car il porte les points exacts de la
// session (bonus de rapidité compris).
export interface IntroSessionResult {
  sequenceId: string
  correctCount: number
  totalPoints: number
}

interface Props {
  formationId: string
  formationTitle: string
  onSuccess: () => void
  variant: 'fixed-bottom' | 'inline'
  gradient?: { from: string; to: string }
  label?: string
  introSessionResult?: IntroSessionResult | null
}

export default function EnrollmentCTA({
  formationId,
  formationTitle: _formationTitle,
  onSuccess,
  variant,
  gradient,
  label,
  introSessionResult,
}: Props) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)
  // Chemin AUTORISÉ d'écriture user_points (hook unique) + maj current_sequence.
  const { submit: submitResult } = useSubmitSequenceResult()
  const { markCompleted } = useUserFormationProgress(formationId)

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

  // Réconciliation d'une intro-QUIZ complétée AVANT inscription : créditer les
  // points (via le hook autorisé) et débloquer la séquence 1. Idempotent.
  // Source du résultat : prioritairement la session (introSessionResult), sinon
  // reconstitution depuis user_question_review (acquisitions). N'agit jamais
  // deux fois (garde user_points / user_sequences). Best-effort : ne bloque
  // jamais l'inscription.
  const reconcileIntroQuizCompletion = async (
    supabase: ReturnType<typeof createClient>,
    userId: string,
  ) => {
    try {
      const { data: intros, error: introsErr } = await supabase
        .from('sequences')
        .select('id, sequence_number')
        .eq('formation_id', formationId)
        .eq('is_intro', true)
      if (introsErr || !intros?.length) return

      for (const intro of intros) {
        // Questions de l'intro. Aucune question = intro audio-only -> hors
        // périmètre (géré par backfillIntroCompletions). On ne touche pas.
        const { data: questions, error: qErr } = await supabase
          .from('questions')
          .select('id, points')
          .eq('sequence_id', intro.id)
        if (qErr || !questions?.length) continue
        const total = questions.length

        // Idempotence : déjà crédité ou déjà complété -> ne rien refaire.
        const { data: existingPoints } = await supabase
          .from('user_points')
          .select('id')
          .eq('user_id', userId)
          .eq('sequence_id', intro.id)
          .maybeSingle()
        const { data: existingSeq } = await supabase
          .from('user_sequences')
          .select('id')
          .eq('user_id', userId)
          .eq('sequence_id', intro.id)
          .maybeSingle()
        if (existingPoints || existingSeq) continue

        // Détermination du résultat.
        let correctCount: number
        let totalPoints: number
        if (introSessionResult && introSessionResult.sequenceId === intro.id) {
          // Session : valeurs exactes (points réels, échecs éventuels inclus).
          correctCount = introSessionResult.correctCount
          totalPoints = introSessionResult.totalPoints
        } else {
          // Base : l'intro est « complétée » dès que TOUTES ses questions ont
          // été RÉPONDUES (chaque réponse, bonne ou ratée, laisse une ligne dans
          // user_question_review : recordAcquisition si réussie du 1er coup,
          // update_sm2_state quality=1 si ratée). On ne crédite que les réussies
          // (consecutive_correct >= 1) -> robuste au rechargement même avec
          // erreurs.
          const qIds = questions.map((q: { id: string }) => q.id)
          const { data: reviewed, error: reviewErr } = await supabase
            .from('user_question_review')
            .select('question_id, consecutive_correct')
            .eq('user_id', userId)
            .in('question_id', qIds)
          if (reviewErr) continue

          const answeredIds = new Set(
            (reviewed ?? []).map((r: { question_id: string }) => r.question_id),
          )
          if (answeredIds.size < total) continue // intro non terminée

          const passedIds = new Set(
            (reviewed ?? [])
              .filter((r: { consecutive_correct: number }) => r.consecutive_correct >= 1)
              .map((r: { question_id: string }) => r.question_id),
          )
          correctCount = passedIds.size
          totalPoints = questions.reduce(
            (s: number, q: { id: string; points: number | null }) =>
              s + (passedIds.has(q.id) ? q.points || 0 : 0),
            0,
          )
        }

        const score = total > 0 ? Math.round((correctCount / total) * 100) : 0

        // Crédit points + user_sequences via le SEUL chemin autorisé.
        await submitResult({
          sequenceId: intro.id,
          score,
          totalPoints,
          timeSpentSeconds: 0,
          answers: [],
        })

        // Déblocage current_sequence avec GREATEST (markCompleted pose la valeur
        // brute -> on calcule le max ici pour ne jamais régresser).
        const { data: uf } = await supabase
          .from('user_formations')
          .select('current_sequence')
          .eq('user_id', userId)
          .eq('formation_id', formationId)
          .maybeSingle()
        const nextSeq = Math.max(uf?.current_sequence ?? 0, intro.sequence_number + 1)
        await markCompleted(intro.id, nextSeq)
      }
    } catch (err) {
      console.error('Erreur réconciliation intro quiz:', err)
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
          current_sequence: 0,
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
          await reconcileIntroQuizCompletion(supabase, user.id)
          onSuccess()
          return
        }
        // Autre erreur (réseau, RLS, etc.) → message classique
        throw error
      }

      // Rétro-marquer l'intro audio-only éventuellement déjà écoutée AVANT
      // d'appeler onSuccess(), pour éviter le flash visuel "0/N → 1/N".
      await backfillIntroCompletions(supabase, user.id)

      // Réconcilier une intro-QUIZ déjà complétée (points + déblocage séq. 1).
      await reconcileIntroQuizCompletion(supabase, user.id)

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
