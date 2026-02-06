'use client'

import { useState, useEffect } from 'react'
import { Play, CheckCircle2, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DailyQuizButtonProps {
  userId?: string
  onStart: () => void
}

export default function DailyQuizButton({ userId, onStart }: DailyQuizButtonProps) {
  const [alreadyDone, setAlreadyDone] = useState(false)
  const [loading, setLoading] = useState(true)
  const [score, setScore] = useState<number | null>(null)

  useEffect(() => {
    async function checkDailyQuiz() {
      if (!userId) {
        setLoading(false)
        return
      }

      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]

      const { data } = await supabase
        .from('daily_quiz_results')
        .select('score, total_questions')
        .eq('user_id', userId)
        .eq('quiz_date', today)
        .single()

      if (data) {
        setAlreadyDone(true)
        setScore(data.score)
      }

      setLoading(false)
    }

    checkDailyQuiz()
  }, [userId])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (alreadyDone) {
    return (
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl p-5 shadow-sm border border-emerald-200">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-100 rounded-xl">
            <CheckCircle2 className="w-7 h-7 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-emerald-800">Quiz du jour termine !</p>
            <p className="text-xs text-emerald-600 mt-0.5">
              Score : {score}/10 &bull; Reviens demain pour un nouveau quiz
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <button
      onClick={onStart}
      className="w-full bg-gradient-to-r from-[#2D1B96] to-[#4C3BCF] rounded-2xl p-5 shadow-lg hover:shadow-xl transition-all active:scale-[0.98] group"
    >
      <div className="flex items-center gap-4">
        <div className="p-3 bg-white/15 rounded-xl group-hover:bg-white/25 transition-colors">
          <Play className="w-7 h-7 text-white" fill="white" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-base font-bold text-white">Quiz du jour</p>
          <p className="text-sm text-white/80 mt-0.5">10 questions &bull; ~5 min</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-white/70">Bonus +50 pts si 100%</p>
        </div>
      </div>
    </button>
  )
}
