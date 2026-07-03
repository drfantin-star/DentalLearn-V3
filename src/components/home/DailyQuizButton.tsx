'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { HomeFeedCard } from './HomeFeedCard'

interface DailyQuizButtonProps {
  userId?: string
  onStart: () => void
  refreshTrigger?: number
  // T11/3.E : variant 'square' pour le rendu carte cote-a-cote avec
  // JournalWeekCard sur la home. 'wide' (defaut) conserve le rendu original
  // pleine largeur utilise dans toutes les autres pages.
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
          className="flex min-w-0 min-h-[112px] rounded-2xl items-center justify-center"
          style={{ background: '#1C1C1E', border: '0.5px solid rgba(255,255,255,0.08)' }}
        >
          <Loader2 className="w-6 h-6 animate-spin text-white/40" />
        </div>
      )
    }
    return (
      <div className="rounded-2xl p-6 shadow-sm flex items-center justify-center" style={{ background: '#242424', border: '0.5px solid #333' }}>
        <Loader2 className="w-6 h-6 animate-spin text-white/40" />
      </div>
    )
  }

  if (isSquare) {
    if (alreadyDone) {
      return (
        <HomeFeedCard
          accent="violet"
          eyebrow="Quiz du jour"
          title={`Termine ! Score ${score}/10`}
          icon={
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src="/images/sophie-certily-quizz.webp"
              alt=""
              aria-hidden
              className="h-full w-full object-cover"
            />
          }
          onClick={() => {}}
          ariaLabel="Quiz du jour termine"
          disabled
        />
      )
    }

    return (
      <HomeFeedCard
        accent="violet"
        eyebrow="Quiz du jour"
        title="Teste tes connaissances"
        icon={
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/images/sophie-certily-quizz.webp"
            alt=""
            aria-hidden
            className="h-full w-full object-cover"
          />
        }
        onClick={onStart}
        ariaLabel="Commencer le quiz du jour"
      />
    )
  }

  if (alreadyDone) {
    return (
      <div className="bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl p-5 flex items-center gap-4 shadow-md">
        <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
          <span className="text-2xl">✅</span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-white font-bold text-lg">Quiz du jour termine !</p>
          <p className="text-white/80 text-sm">
            Score : {score}/10 · Reviens demain 🎯
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="rounded-2xl p-5 flex items-center justify-between gap-4 cursor-pointer active:scale-95 transition-transform shadow-md"
      style={{ background: 'linear-gradient(135deg, #2D1B96, #8B5CF6)' }}
      onClick={onStart}
    >
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
