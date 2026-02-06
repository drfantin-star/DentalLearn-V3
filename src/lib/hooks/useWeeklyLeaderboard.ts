'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface LeaderboardEntry {
  user_id: string
  full_name: string
  avatar_url: string | null
  weekly_points: number
  rank: number
  is_current_user: boolean
}

export function useWeeklyLeaderboard(userId: string | null | undefined) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [userRank, setUserRank] = useState<LeaderboardEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { data, error: rpcError } = await supabase.rpc('get_weekly_quiz_leaderboard', {
      p_user_id: userId ?? null
    })

    if (rpcError) {
      console.error('Leaderboard error:', rpcError)
      setError('Impossible de charger le classement')
      setLoading(false)
      return
    }

    if (data && data.length > 0) {
      setLeaderboard(data.filter((e: LeaderboardEntry) => e.rank <= 10))
      setUserRank(data.find((e: LeaderboardEntry) => e.is_current_user) || null)
    } else {
      setLeaderboard([])
      setUserRank(null)
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return { leaderboard, userRank, loading, error, refetch: fetchLeaderboard }
}
