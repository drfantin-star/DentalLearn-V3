'use client'

import { useState, useEffect } from 'react'
import { Play, CheckCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DailyQuizButtonProps {
  userId?: string
  onStart: () => void
  refreshTrigger?: number
}

export default function DailyQuizButton({ userId, onStart, refreshTrigger }: DailyQuizButtonProps) {
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
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })

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
  }, [userId, refreshTrigger])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (alreadyDone) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-5 flex items-center gap-4 shadow-md">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <CheckCircle size={28} className="text-white" />
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-white font-bold text-lg">Quiz du jour terminé !</p>
          <p className="text-white/80 text-sm">
            Score : {score}/10 · Reviens demain 🎯
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gradient-to-br from-[#2D1B96] to-[#3D2BB6] rounded-2xl p-5 flex items-center justify-between gap-4 cursor-pointer active:scale-95 transition-transform shadow-md"
         onClick={onStart}>
      <div className="flex flex-col gap-1">
        <p className="text-white font-bold text-lg leading-tight">Quiz du jour</p>
        <p className="text-white/70 text-sm">10 questions · ~5 min</p>
        <p className="text-white/50 text-xs">Testez vos connaissances !</p>
      </div>
      <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
        <Play size={28} className="text-white ml-1" fill="white" />
      </div>
    </div>
  )
}
