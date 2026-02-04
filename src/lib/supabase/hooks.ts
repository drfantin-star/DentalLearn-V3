'use client'

import { useState, useEffect, useCallback } from 'react'
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
// MODE PREVIEW — Sans authentification
// ============================================

export function usePreviewMode() {
  return {
    isPreview: true,
  }
}

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
// HOOK — Progression utilisateur (MODE PREVIEW)
// ============================================

export function useUserFormationProgress(formationId: string | null) {
  const { isPreview } = usePreviewMode()
  const [currentSequence, setCurrentSequence] = useState(1)
  const [completedSequenceIds, setCompletedSequenceIds] = useState<string[]>([])
  const [loading] = useState(false)

  const markCompleted = useCallback((sequenceId: string, nextSeqNumber: number) => {
    if (!completedSequenceIds.includes(sequenceId)) {
      setCompletedSequenceIds(prev => [...prev, sequenceId])
      setCurrentSequence(nextSeqNumber)
    }
  }, [completedSequenceIds])

  const refresh = useCallback(() => {
    if (isPreview) {
      setCurrentSequence(1)
      setCompletedSequenceIds([])
    }
  }, [isPreview])

  return { 
    currentSequence, 
    completedSequenceIds, 
    loading, 
    refresh,
    markCompleted,
  }
}

// ============================================
// HOOK — Accès premium (MODE PREVIEW)
// ============================================

export function usePremiumAccess() {
  return {
    isPremium: true,
    loading: false,
  }
}

// ============================================
// HOOK — Soumettre résultats (MODE PREVIEW)
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
  const { isPreview } = usePreviewMode()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const submit = useCallback(async (result: SequenceResult) => {
    try {
      setLoading(true)
      setError(null)

      if (isPreview) {
        console.log('📊 [Preview] Résultats séquence:', {
          score: result.score,
          points: result.totalPoints,
          temps: result.timeSpentSeconds + 's',
        })
        await new Promise(resolve => setTimeout(resolve, 300))
        return true
      }

      return true
    } catch (err) {
      console.error('Erreur submit:', err)
      setError(err instanceof Error ? err : new Error('Erreur soumission'))
      throw err
    } finally {
      setLoading(false)
    }
  }, [isPreview])

  return { submit, loading, error }
}

// ============================================
// HELPER — Vérifier accessibilité séquence
// ============================================

export function isSequenceAccessible(
  sequence: Sequence,
  currentSequence: number,
  completedSequenceIds: string[],
  isPremium: boolean,
  isPreview: boolean = false
): { 
  accessible: boolean
  reason: 'free' | 'unlocked' | 'completed' | 'premium_required' | 'not_unlocked' 
} {
  
  // Mode Preview : toutes les séquences sont accessibles
  if (isPreview) {
    if (completedSequenceIds.includes(sequence.id)) {
      return { accessible: true, reason: 'completed' }
    }
    return { accessible: true, reason: 'unlocked' }
  }
  
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
