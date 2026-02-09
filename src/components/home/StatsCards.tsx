'use client'

import { Flame } from 'lucide-react'
import LeaderboardPanel from '@/components/leaderboard/LeaderboardPanel'

interface StatsCardsProps {
  userId?: string
  currentStreak: number
  refreshTrigger?: number
}

export default function StatsCards({ userId, currentStreak, refreshTrigger }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-5 gap-3">
      {/* Jours de suite (Streak) */}
      <div className="col-span-2 bg-gradient-to-br from-[#8B5CF6] to-[#7C3AED] rounded-[20px] shadow-lg p-4 md:p-5 text-white h-full flex flex-col">
        <div className="flex flex-col items-center">
          <div className="p-2.5 md:p-3 bg-white/20 rounded-xl">
            <Flame className="w-7 h-7 md:w-8 md:h-8 text-white" />
          </div>
          <p className="text-xs md:text-sm font-medium text-white/90 mt-2 md:mt-3">Jours de suite</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center mt-2">
          <span className="text-2xl md:text-3xl font-black">{currentStreak}</span>
        </div>
      </div>

      {/* Classement hebdo (agrandi col-span-3) */}
      <div className="col-span-3">
        <LeaderboardPanel userId={userId} compact refreshTrigger={refreshTrigger} />
      </div>
    </div>
  )
}
