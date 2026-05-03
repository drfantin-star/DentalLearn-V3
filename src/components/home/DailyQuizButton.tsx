'use client'

import { useState, useEffect } from 'react'
import { CheckCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface DailyQuizButtonProps {
  userId?: string
  onStart: () => void
  refreshTrigger?: number
  // T11/3.E : variant 'square' pour le rendu carte carrée côte-à-côte avec
  // JournalWeekCard sur la home. 'wide' (défaut) conserve le rendu original
  // pleine largeur utilisé dans toutes les autres pages.
  variant?: 'wide' | 'square'
}

export default function DailyQuizButton({
  userId,
  onStart,
  refreshTrigger,
  variant = 'wide',
}: DailyQuizButtonProps) {
  const isSquare = variant === 'square'
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
    if (isSquare) {
      return (
        <div
          className="flex-1 aspect-square rounded-2xl flex items-center justify-center"
          style={{ background: '#242424', border: '0.5px solid #333' }}
        >
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )
    }
    return (
      <div className="rounded-2xl p-6 shadow-sm flex items-center justify-center" style={{ background: '#242424', border: '0.5px solid #333' }}>
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    )
  }

  if (alreadyDone) {
    if (isSquare) {
      return (
        <div className="flex-1 aspect-square rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex flex-col justify-between p-3 shadow-md">
          <div>
            <span className="text-xs font-bold text-white/90 uppercase tracking-wide">
              ✅ Quiz du jour
            </span>
            <p className="text-white font-bold text-sm mt-1 leading-tight">
              Terminé !
            </p>
          </div>
          <p className="text-white/90 text-[11px]">
            Score : {score}/10 · à demain
          </p>
        </div>
      )
    }
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

  if (isSquare) {
    return (
      <button
        type="button"
        onClick={onStart}
        className="flex-1 aspect-square rounded-2xl flex flex-col justify-between items-center p-3 active:scale-95 transition-transform shadow-md"
        style={{ background: 'linear-gradient(135deg, #2D1B96, #8B5CF6)' }}
      >
        {/* Bloc central : icône au-dessus du titre + sous-titre, le tout
            centré horizontalement. Le justify-between du parent pousse ce
            bloc vers le haut et la ligne "10 questions" vers le bas. */}
        <div className="flex flex-col items-center text-center gap-2 mt-1">
          <div className="w-10 h-10 rounded-xl overflow-hidden">
            <img
              src="https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/ui-assets/quizz.jpg"
              alt="Quiz"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <span className="text-xs font-bold text-white/80 uppercase tracking-wide">
              🎯 Quiz du jour
            </span>
            <p className="text-white font-bold text-sm mt-0.5 leading-tight">
              Viens tester
              <br />
              tes connaissances
            </p>
          </div>
        </div>
        <p className="text-white/80 text-[11px] text-center">
          10 questions · ~5 min
        </p>
      </button>
    )
  }

  return (
    <div className="rounded-2xl p-5 flex items-center justify-between gap-4 cursor-pointer active:scale-95 transition-transform shadow-md"
         style={{ background: 'linear-gradient(135deg, #2D1B96, #8B5CF6)' }}
         onClick={onStart}>
      <div className="flex flex-col gap-1">
        <p className="text-white font-black text-xl leading-tight">Quiz du jour</p>
        <p className="text-white/80 text-sm font-semibold">10 questions · ~5 min</p>
        <p className="text-white/70 text-sm font-medium">Viens tester tes connaissances !</p>
      </div>
      <div className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0">
        <img
          src="https://dxybsuhfkwuemapqrvgz.supabase.co/storage/v1/object/public/ui-assets/quizz.jpg"
          alt="Quiz"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  )
}
