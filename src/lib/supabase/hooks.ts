'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from './client'
import type {
  Formation,
  Sequence,
  Question,
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
  const [formations, setFormations] = useState<Formation[]>([])
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
        console.error('Erreur fetchFormations:', err)
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

        const { data: formationData, error: formationError } = await supabase
          .from('formations')
          .select('*')
          .eq('id', formationId)
          .single()

        if (formationError) throw formationError

        const { data: sequencesData, error: sequencesError } = await supabase
          .from('sequences')
          .select('*')
          .eq('formation_id', formationId)
          .order('sequence_number', { ascending: true })

        if (sequencesError) throw sequencesError

        setFormation(formationData)
        setSequences(sequencesData || [])
      } catch (err) {
        console.error('Erreur fetchFormation:', err)
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
// HOOK — Formation par slug avec séquences
// ============================================

export function useFormationBySlug(slug: string | null) {
  const [formation, setFormation] = useState<Formation | null>(null)
  const [sequences, setSequences] = useState<Sequence[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (!slug) {
      setFormation(null)
      setSequences([])
      setLoading(false)
      return
    }

    async function fetchFormationBySlug() {
      try {
        setLoading(true)

        const { data: formationData, error: formationError } = await supabase
          .from('formations')
          .select('*')
          .eq('slug', slug)
          .single()

        if (formationError) throw formationError

        const { data: sequencesData, error: sequencesError } = await supabase
          .from('sequences')
          .select('*')
          .eq('formation_id', formationData.id)
          .order('sequence_number', { ascending: true })

        if (sequencesError) throw sequencesError

        setFormation(formationData)
        setSequences(sequencesData || [])
      } catch (err) {
        console.error('Erreur fetchFormationBySlug:', err)
        setError(err instanceof Error ? err : new Error('Erreur inconnue'))
      } finally {
        setLoading(false)
      }
    }

    fetchFormationBySlug()
  }, [slug])

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
        console.error('Erreur fetchQuestions:', err)
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
// HOOK — Progression utilisateur (vraie DB)
// ============================================

export function useUserFormationProgress(formationId: string | null) {
  const [currentSequence, setCurrentSequence] = useState(1)
  const [completedSequenceIds, setCompletedSequenceIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!formationId) {
      setCompletedSequenceIds([])
      setCurrentSequence(1)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setCompletedSequenceIds([])
        setCurrentSequence(1)
        setLoading(false)
        return
      }

      const { data: completed, error: completedErr } = await supabase
        .rpc('get_user_completed_sequences', {
          p_user_id: user.id,
          p_formation_id: formationId,
        })

      if (completedErr) {
        console.error('Erreur get_user_completed_sequences:', completedErr)
        setCompletedSequenceIds([])
      } else {
        setCompletedSequenceIds((completed || []).map((c: any) => c.sequence_id))
      }

      const { data: userFormation } = await supabase
        .from('user_formations')
        .select('current_sequence')
        .eq('user_id', user.id)
        .eq('formation_id', formationId)
        .maybeSingle()

      setCurrentSequence(userFormation?.current_sequence || 1)
    } catch (err) {
      console.error('Erreur chargement progression:', err)
    } finally {
      setLoading(false)
    }
  }, [formationId])

  useEffect(() => {
    load()
  }, [load])

  const markCompleted = useCallback(async (sequenceId: string, nextSeqNumber: number) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !formationId) return

      await supabase
        .from('user_sequences')
        .upsert({
          user_id: user.id,
          sequence_id: sequenceId,
          completed_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,sequence_id',
          ignoreDuplicates: false,
        })

      await supabase
        .from('user_formations')
        .upsert({
          user_id: user.id,
          formation_id: formationId,
          current_sequence: nextSeqNumber,
          is_active: true,
          access_type: 'full',
          started_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,formation_id',
          ignoreDuplicates: false,
        })

      await load()
    } catch (err) {
      console.error('Erreur markCompleted:', err)
    }
  }, [formationId, load])

  return {
    currentSequence,
    completedSequenceIds,
    loading,
    refresh: load,
    markCompleted,
  }
}

// ============================================
// HOOK — Accès premium
// ============================================

export function usePremiumAccess() {
  return {
    isPremium: true,
    loading: false,
  }
}

// ============================================
// HOOK — Soumettre résultats séquence (vraie DB)
// ============================================

interface SequenceResult {
  sequenceId: string
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

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Utilisateur non authentifié')
      }

      const { error: seqErr } = await supabase
        .from('user_sequences')
        .upsert({
          user_id: user.id,
          sequence_id: result.sequenceId,
          completed_at: new Date().toISOString(),
          score: result.score,
          time_spent_seconds: result.timeSpentSeconds,
          attempts_count: 1,
          answers: result.answers as any,
        }, {
          onConflict: 'user_id,sequence_id',
          ignoreDuplicates: false,
        })

      if (seqErr) {
        console.error('Erreur user_sequences:', seqErr)
        throw seqErr
      }

      if (result.totalPoints > 0) {
        const { error: pointsErr } = await supabase
          .from('user_points')
          .insert({
            user_id: user.id,
            sequence_id: result.sequenceId,
            points_earned: result.totalPoints,
            reason: 'perfect_sequence',
          })

        if (pointsErr) {
          console.error('Erreur user_points:', pointsErr)
        }
      }

      const { data: seqData } = await supabase
        .from('sequences')
        .select('formation_id')
        .eq('id', result.sequenceId)
        .single()

      if (seqData?.formation_id) {
        const { data: allPoints } = await supabase
          .from('user_points')
          .select('points_earned, sequence_id, sequences!inner(formation_id)')
          .eq('user_id', user.id)
          .eq('sequences.formation_id', seqData.formation_id)

        const totalFormationPoints = (allPoints || []).reduce(
          (sum, p: any) => sum + (p.points_earned || 0),
          0
        )

        await supabase
          .from('user_formations')
          .upsert({
            user_id: user.id,
            formation_id: seqData.formation_id,
            total_points: totalFormationPoints,
            best_score: result.score,
            access_type: 'full',
            is_active: true,
          }, {
            onConflict: 'user_id,formation_id',
            ignoreDuplicates: false,
          })
      }

      return true
    } catch (err) {
      console.error('Erreur submit:', err)
      setError(err instanceof Error ? err : new Error('Erreur soumission'))
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return { submit, loading, error }
}

// ============================================
// HELPER — Vérifier accessibilité séquence
// ============================================

export function isSequenceAccessible(
  sequence: Sequence,
  currentSequence: number,
  completedSequenceIds: string[],
  isPremium: boolean
): {
  accessible: boolean
  reason: 'free' | 'unlocked' | 'completed' | 'premium_required' | 'not_unlocked'
} {
  if (completedSequenceIds.includes(sequence.id)) {
    return { accessible: true, reason: 'completed' }
  }

  if (sequence.is_intro || sequence.access_level === 'free') {
    return { accessible: true, reason: 'free' }
  }

  if (sequence.access_level === 'premium' && !isPremium) {
    return { accessible: false, reason: 'premium_required' }
  }

  if (sequence.sequence_number > currentSequence) {
    return { accessible: false, reason: 'not_unlocked' }
  }

  return { accessible: true, reason: 'unlocked' }
}

// ============================================
// HOOK — Like formation
// ============================================

export function useFormationLike(formationId: string | null) {
  const [isLiked, setIsLiked] = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!formationId) return

    async function fetchLikeStatus() {
      try {
        const { data: formation } = await supabase
          .from('formations')
          .select('likes_count')
          .eq('id', formationId)
          .single()

        if (formation) {
          setLikesCount(formation.likes_count || 0)
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: like } = await supabase
          .from('formation_likes')
          .select('id')
          .eq('formation_id', formationId)
          .eq('user_id', user.id)
          .single()

        setIsLiked(!!like)
      } catch (err) {
        console.error('Erreur fetchLikeStatus:', err)
      }
    }

    fetchLikeStatus()
  }, [formationId])

  const toggleLike = useCallback(async () => {
    if (!formationId) return

    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non authentifié')

      if (isLiked) {
        await supabase
          .from('formation_likes')
          .delete()
          .eq('formation_id', formationId)
          .eq('user_id', user.id)

        setIsLiked(false)
        setLikesCount(prev => Math.max(0, prev - 1))
      } else {
        await supabase
          .from('formation_likes')
          .insert({ formation_id: formationId, user_id: user.id })

        setIsLiked(true)
        setLikesCount(prev => prev + 1)
      }
    } catch (err) {
      console.error('Erreur toggleLike:', err)
    } finally {
      setLoading(false)
    }
  }, [formationId, isLiked])

  return { isLiked, likesCount, toggleLike, loading }
}

// ============================================
// HOOK — Points formation
// ============================================

export function useFormationPoints(formationId: string | null) {
  const [totalPoints, setTotalPoints] = useState(0)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!formationId) {
      setLoading(false)
      return
    }

    async function fetchPoints() {
      try {
        setLoading(true)

        const { data: sequences } = await supabase
          .from('sequences')
          .select('id')
          .eq('formation_id', formationId)

        if (sequences && sequences.length > 0) {
          const sequenceIds = sequences.map(s => s.id)

          const { data: questionsData } = await supabase
            .from('questions')
            .select('points')
            .in('sequence_id', sequenceIds)

          const total = questionsData?.reduce((sum, q) => sum + (q.points || 0), 0) || 0
          setTotalPoints(total)
        }

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return

        const { data: userFormation } = await supabase
          .from('user_formations')
          .select('total_points')
          .eq('formation_id', formationId)
          .eq('user_id', user.id)
          .single()

        if (userFormation) {
          setEarnedPoints(userFormation.total_points || 0)
        }
      } catch (err) {
        console.error('Erreur fetchPoints:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchPoints()
  }, [formationId])

  const addPoints = useCallback((points: number) => {
    setEarnedPoints(prev => prev + points)
    console.log(`⭐ Points ajoutés: +${points} (Total: ${earnedPoints + points})`)
  }, [earnedPoints])

  const progressPercent = totalPoints > 0 ? Math.round((earnedPoints / totalPoints) * 100) : 0

  return { totalPoints, earnedPoints, progressPercent, addPoints, loading }
}

// ============================================
// HOOK — Vérifier si formation complétée
// ============================================

export function useFormationCompletion(formationId: string | null, sequences: Sequence[], completedSequenceIds: string[]) {
  const isCompleted = useMemo(() => {
    if (!sequences.length) return false
    return sequences.every(seq => completedSequenceIds.includes(seq.id))
  }, [sequences, completedSequenceIds])

  const completionPercent = useMemo(() => {
    if (!sequences.length) return 0
    return Math.round((completedSequenceIds.filter(id => 
      sequences.some(s => s.id === id)
    ).length / sequences.length) * 100)
  }, [sequences, completedSequenceIds])

  return { isCompleted, completionPercent }
}
