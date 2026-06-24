'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

export interface UnifiedLeaderboardEntry {
  user_id: string
  full_name: string
  avatar_url: string | null
  points: number
  rank: number
  is_current_user: boolean
}

export function useLeaderboard(
  userId: string | null | undefined,
  mode: 'weekly' | 'lifetime'
) {
  const [leaderboard, setLeaderboard] = useState<UnifiedLeaderboardEntry[]>([])
  const [userRank, setUserRank] = useState<UnifiedLeaderboardEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const rpcName = mode === 'lifetime' ? 'get_lifetime_leaderboard' : 'get_weekly_quiz_leaderboard'

    const { data, error: rpcError } = await supabase.rpc(rpcName, {
      p_user_id: userId ?? null
    })

    if (rpcError) {
      console.error('Leaderboard error:', rpcError)
      setError('Impossible de charger le classement')
      setLoading(false)
      return
    }

    if (data && data.length > 0) {
      const mapped: UnifiedLeaderboardEntry[] = data.map((e: Record<string, unknown>) => ({
        user_id: e.user_id as string,
        full_name: e.full_name as string,
        avatar_url: e.avatar_url as string | null,
        points: Number(mode === 'lifetime' ? e.total_points : e.weekly_points),
        rank: Number(e.rank),
        is_current_user: e.is_current_user as boolean,
      }))
      setLeaderboard(mapped.filter(e => e.rank <= 10))
      setUserRank(mapped.find(e => e.is_current_user) ?? null)
    } else {
      setLeaderboard([])
      setUserRank(null)
    }

    setLoading(false)
  }, [userId, mode])

  useEffect(() => {
    fetchLeaderboard()
  }, [fetchLeaderboard])

  return { leaderboard, userRank, loading, error, refetch: fetchLeaderboard }
}
