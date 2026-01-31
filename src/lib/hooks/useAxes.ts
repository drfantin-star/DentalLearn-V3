'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { CpAxe, DailyAxisQuiz } from '@/types/database'

export interface AxisWithProgress extends CpAxe {
  progressFilled: number
  dailyDone: boolean
}

export function useAxes(userId?: string) {
  const [axes, setAxes] = useState<AxisWithProgress[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchAxes() {
      const supabase = createClient()
      
      try {
        // Récupérer les 4 axes
        const { data: axesData, error: axesError } = await supabase
          .from('cp_axes')
          .select('*')
          .order('display_order')

        if (axesError) throw axesError

        // Si pas d'utilisateur, retourner les axes sans progression
        if (!userId) {
          setAxes(axesData.map(axe => ({
            ...axe,
            progressFilled: 0,
            dailyDone: false
          })))
          setLoading(false)
          return
        }

        // Récupérer les quiz du jour pour cet utilisateur
        const today = new Date().toISOString().split('T')[0]
        const { data: todayQuizzes, error: quizError } = await supabase
          .from('daily_axis_quizzes')
          .select('axe_id, completed_at')
          .eq('user_id', userId)
          .eq('quiz_date', today)

        if (quizError) throw quizError

        // Récupérer la progression totale par axe
        const { data: progressData, error: progressError } = await supabase
          .from('daily_axis_progress')
          .select('axe_id, points_earned')
          .eq('user_id', userId)

        if (progressError) throw progressError

        // Calculer la progression par axe
        const progressByAxe: Record<number, number> = {}
        progressData?.forEach(p => {
          progressByAxe[p.axe_id] = (progressByAxe[p.axe_id] || 0) + p.points_earned
        })

        // Combiner les données
        const axesWithProgress = axesData.map(axe => {
          const totalPoints = progressByAxe[axe.id] || 0
          const progressFilled = Math.min(4, Math.floor(totalPoints / 10)) // 10 points = 1 barre
          const dailyDone = todayQuizzes?.some(q => q.axe_id === axe.id && q.completed_at) || false

          return {
            ...axe,
            progressFilled,
            dailyDone
          }
        })

        setAxes(axesWithProgress)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }

    fetchAxes()
  }, [userId])

  // Fonction pour marquer un quiz comme complété
  const completeQuiz = async (axeId: number, score: number) => {
    if (!userId) return

    const supabase = createClient()
    const today = new Date().toISOString().split('T')[0]

    // Mettre à jour ou créer le quiz du jour
    await supabase
      .from('daily_axis_quizzes')
      .upsert({
        user_id: userId,
        axe_id: axeId,
        quiz_date: today,
        score,
        max_score: 4,
        completed_at: new Date().toISOString(),
        questions_ids: []
      }, { onConflict: 'user_id,axe_id,quiz_date' })

    // Ajouter les points à la progression
    await supabase
      .from('daily_axis_progress')
      .upsert({
        user_id: userId,
        axe_id: axeId,
        progress_date: today,
        points_earned: score,
        quizzes_completed: 1
      }, { onConflict: 'user_id,axe_id,progress_date' })

    // Mettre à jour l'état local
    setAxes(prev => prev.map(a => 
      a.id === axeId ? { ...a, dailyDone: true } : a
    ))
  }

  return { axes, loading, error, completeQuiz }
}
