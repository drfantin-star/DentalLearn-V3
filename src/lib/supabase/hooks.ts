'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type {
  Formation,
  Sequence,
  Question,
  UserFormation,
  UserSequence,
  FormationWithProgress,
  SequenceWithQuestions,
  getCategoryConfig,
} from './types'

// ============================================
// CLIENT SUPABASE
// ============================================

const supabase = createClient()

// ============================================
// HOOK — Liste des formations
// ============================================

interface UseFormationsOptions {
  category?: string
  isPublished?: boolean
}

export function useFormations(options: UseFormationsOptions = {}) {
  const [formations, setFormations] = useState<FormationWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    async function fetchFormations() {
      try {
        setLoading(true)
        
        let query = supabase
          .from('formations')
          .select('*')
          .order('created_at', { ascending: false })

        if (options.category) {
          query = query.eq('category', options.category)
        }

        if (options.isPublished !== undefined) {
          query = query.eq('is_published', options.isPublished)
        }

        const { data, error: fetchError } = await query

        if (fetchError) throw fetchError

        setFormations(data || [])
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur inconnue'))
      } finally {
        setLoading(false)
      }
    }

    fetchFormations()
  }, [options.category, options.isPublished])

  return { formations, loading, error }
}

// ============================================
// HOOK — Formation par ID avec séquences
// ============================================

export function useFormation(formationId: string | null) {
  const [formation, setFormation] = useState<Formation | null>(null)
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!formationId) {
      setFormation(null)
      setSequences([])
      setLoading(false)
      return
    }

    async function fetchFormationWithSequences() {
      try {
        setLoading(true)

        // Récupérer la formation
        const { data: formationData, error: formationError } = await supabase
          .from('formations')
          .select('*')
          .eq('id', formationId)
          .single()

        if (formationError) throw formationError

        // Récupérer les séquences
        const { data: sequencesData, error: sequencesError } = await supabase
          .from('sequences')
          .select('*')
          .eq('formation_id', formationId)
          .order('sequence_number', { ascending: true })

        if (sequencesError) throw sequencesError

        setFormation(formationData)
        setSequences(sequencesData || [])
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur inconnue'))
      } finally {
        setLoading(false)
      }
    }

    fetchFormationWithSequences()
  }, [formationId])

  return { formation, sequences, loading, error }
}

// ============================================
// HOOK — Questions d'une séquence
// ============================================

export function useSequenceQuestions(sequenceId: string | null) {
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!sequenceId) {
      setQuestions([])
      setLoading(false)
      return
    }

    async function fetchQuestions() {
      try {
        setLoading(true)

        const { data, error: fetchError } = await supabase
          .from('questions')
          .select('*')
          .eq('sequence_id', sequenceId)
          .order('question_order', { ascending: true })

        if (fetchError) throw fetchError

        setQuestions(data || [])
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur inconnue'))
      } finally {
        setLoading(false)
      }
    }

    fetchQuestions()
  }, [sequenceId])

  return { questions, loading, error }
}

// ============================================
// HOOK — Progression utilisateur sur une formation
// ============================================

export function useUserFormationProgress(formationId: string | null, userId: string | null) {
  const [userFormation, setUserFormation] = useState<UserFormation | null>(null)
  const [completedSequences, setCompletedSequences] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const refresh = useCallback(async () => {
    if (!formationId || !userId) {
      setUserFormation(null)
      setCompletedSequences([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      // Récupérer la progression de l'utilisateur sur cette formation
      const { data: ufData, error: ufError } = await supabase
        .from('user_formations')
        .select('*')
        .eq('formation_id', formationId)
        .eq('user_id', userId)
        .maybeSingle()

      if (ufError) throw ufError

      // Récupérer les séquences complétées
      const { data: usData, error: usError } = await supabase
        .from('user_sequences')
        .select('sequence_id')
        .eq('user_id', userId)

      if (usError) throw usError

      setUserFormation(ufData)
      setCompletedSequences(usData?.map((us) => us.sequence_id) || [])
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inconnue'))
    } finally {
      setLoading(false)
    }
  }, [formationId, userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { userFormation, completedSequences, loading, error, refresh }
}

// ============================================
// HOOK — Démarrer / rejoindre une formation
// ============================================

export function useEnrollFormation() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const enroll = useCallback(async (formationId: string, userId: string) => {
    try {
      setLoading(true)
      setError(null)

      // Vérifier si déjà inscrit
      const { data: existing } = await supabase
        .from('user_formations')
        .select('id')
        .eq('formation_id', formationId)
        .eq('user_id', userId)
        .maybeSingle()

      if (existing) {
        return existing.id // Déjà inscrit
      }

      // Créer l'inscription
      const { data, error: insertError } = await supabase
        .from('user_formations')
        .insert({
          user_id: userId,
          formation_id: formationId,
          started_at: new Date().toISOString(),
          is_active: true,
          current_sequence: 0,
        })
        .select()
        .single()

      if (insertError) throw insertError

      return data.id
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur inscription'))
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { enroll, loading, error }
}

// ============================================
// HOOK — Soumettre résultats séquence
// ============================================

interface SequenceResult {
  sequenceId: string
  userId: string
  score: number
  totalPoints: number
  timeSpentSeconds: number
  answers: {
    question_id: string
    selected_option: string
    is_correct: boolean
    points_earned: number
  }[]
}

export function useSubmitSequenceResult() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const submit = useCallback(async (result: SequenceResult) => {
    try {
      setLoading(true)
      setError(null)

      // 1. Enregistrer le résultat de la séquence
      const { error: usError } = await supabase
        .from('user_sequences')
        .upsert({
          user_id: result.userId,
          sequence_id: result.sequenceId,
          completed_at: new Date().toISOString(),
          score: result.score,
          time_spent_seconds: result.timeSpentSeconds,
          attempts_count: 1, // TODO: incrémenter si réessai
          answers: JSON.stringify(result.answers),
        })

      if (usError) throw usError

      // 2. Enregistrer les points gagnés
      if (result.totalPoints > 0) {
        const { error: pointsError } = await supabase
          .from('user_points')
          .insert({
            user_id: result.userId,
            sequence_id: result.sequenceId,
            points_earned: result.totalPoints,
            reason: 'sequence_complete',
          })

        if (pointsError) throw pointsError
      }

      // 3. Mettre à jour les stats utilisateur
      const { error: statsError } = await supabase.rpc('increment_user_stats', {
        p_user_id: result.userId,
        p_points: result.totalPoints,
        p_sequences: 1,
      })

      // Ignorer l'erreur si la fonction n'existe pas encore
      if (statsError && !statsError.message.includes('function')) {
        console.warn('Stats update failed:', statsError)
      }

      // 4. Mettre à jour la progression formation
      // Récupérer la formation liée à cette séquence
      const { data: seqData } = await supabase
        .from('sequences')
        .select('formation_id, sequence_number')
        .eq('id', result.sequenceId)
        .single()

      if (seqData) {
        await supabase
          .from('user_formations')
          .update({
            current_sequence: seqData.sequence_number + 1,
          })
          .eq('formation_id', seqData.formation_id)
          .eq('user_id', result.userId)
      }

      return true
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Erreur soumission'))
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { submit, loading, error }
}

// ============================================
// HOOK — Stats utilisateur
// ============================================

export function useUserStats(userId: string | null) {
  const [stats, setStats] = useState<{
    totalPoints: number
    currentStreak: number
    formationsCompleted: number
    sequencesCompleted: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!userId) {
      setStats(null)
      setLoading(false)
      return
    }

    async function fetchStats() {
      try {
        setLoading(true)

        const { data, error: fetchError } = await supabase
          .from('user_stats')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle()

        if (fetchError) throw fetchError

        if (data) {
          setStats({
            totalPoints: data.total_points || 0,
            currentStreak: data.current_streak || 0,
            formationsCompleted: data.formations_completed || 0,
            sequencesCompleted: data.sequences_completed || 0,
          })
        } else {
          setStats({
            totalPoints: 0,
            currentStreak: 0,
            formationsCompleted: 0,
            sequencesCompleted: 0,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Erreur stats'))
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [userId])

  return { stats, loading, error }
}
