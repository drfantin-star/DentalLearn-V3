'use client'

import { useState, useEffect } from 'react'
import { Star, Flame, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import LeaderboardPanel from '@/components/leaderboard/LeaderboardPanel'

interface StatsCardsProps {
  userId?: string
  currentStreak: number
}

export default function StatsCards({ userId, currentStreak }: StatsCardsProps) {
  const [totalPoints, setTotalPoints] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchPoints() {
      if (!userId) {
        setLoading(false)
        return
      }

      const supabase = createClient()

      // Fetch total points from daily_axis_progress
      const { data, error } = await supabase
        .from('daily_axis_progress')
        .select('points_earned')
        .eq('user_id', userId)

      if (!error && data) {
        const total = data.reduce((sum, row) => sum + (row.points_earned || 0), 0)
        setTotalPoints(total)
      }

      setLoading(false)
    }

    fetchPoints()
  }, [userId])

  return (
    <div className="grid grid-cols-3 gap-3">
      {/* Points totaux */}
      <div className="bg-gradient-to-br from-[#F59E0B] to-[#D97706] rounded-[20px] shadow-lg p-4 md:p-5 text-white h-full flex flex-col">
        <div className="flex flex-col items-center">
          <div className="p-2.5 md:p-3 bg-white/20 rounded-xl">
            <Star className="w-7 h-7 md:w-8 md:h-8 text-white" />
          </div>
          <p className="text-xs md:text-sm font-medium text-white/90 mt-2 md:mt-3">Points</p>
        </div>
        <div className="flex-1 flex items-center justify-center mt-2">
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-white/70" />
          ) : (
            <span className="text-2xl md:text-3xl font-black">{totalPoints}</span>
          )}
        </div>
      </div>

      {/* Jours de suite */}
      <div className="bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-[20px] shadow-lg p-4 md:p-5 text-white h-full flex flex-col">
        <div className="flex flex-col items-center">
          <div className="p-2.5 md:p-3 bg-white/20 rounded-xl">
            <Flame className="w-7 h-7 md:w-8 md:h-8 text-white" />
          </div>
          <p className="text-xs md:text-sm font-medium text-white/90 mt-2 md:mt-3">Streak</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center mt-2">
          <span className="text-2xl md:text-3xl font-black">{currentStreak}</span>
          <span className="text-[10px] md:text-xs text-white/70 mt-0.5">jours</span>
        </div>
      </div>

      {/* Classement hebdo - LeaderboardPanel compact */}
      <LeaderboardPanel compact />
    </div>
  )
}
