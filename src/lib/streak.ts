import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Get today's date in Europe/Paris timezone as "YYYY-MM-DD".
 */
export function getTodayParis(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
}

/**
 * Get yesterday's date in Europe/Paris timezone as "YYYY-MM-DD".
 */
export function getYesterdayParis(): string {
  const now = new Date()
  // Get current Paris date components
  const parisDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Paris' })
  const parisDate = new Date(parisDateStr + 'T12:00:00')
  parisDate.setDate(parisDate.getDate() - 1)
  return parisDate.toISOString().split('T')[0]
}

/**
 * Update the streak for a given user.
 *
 * Logic:
 * - If last_activity_date is today (Paris TZ) → no change
 * - If last_activity_date is yesterday (Paris TZ) → current_streak + 1
 * - If last_activity_date is older or null → reset current_streak to 1
 * - Always update longest_streak if current_streak exceeds it
 * - Always set last_activity_date to today
 */
export async function updateStreak(
  supabase: SupabaseClient,
  userId: string
): Promise<{ current_streak: number; longest_streak: number } | null> {
  const today = getTodayParis()
  const yesterday = getYesterdayParis()

  // Fetch current streak data
  const { data: streak, error: fetchError } = await supabase
    .from('streaks')
    .select('current_streak, longest_streak, last_activity_date')
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    // Row doesn't exist yet — create it
    if (fetchError.code === 'PGRST116') {
      const newStreak = { current_streak: 1, longest_streak: 1 }
      await supabase.from('streaks').insert({
        user_id: userId,
        current_streak: 1,
        longest_streak: 1,
        last_activity_date: today,
      })
      return newStreak
    }
    console.error('Error fetching streak:', fetchError)
    return null
  }

  const lastActivity = streak.last_activity_date

  // Already updated today — no change
  if (lastActivity === today) {
    return {
      current_streak: streak.current_streak,
      longest_streak: streak.longest_streak,
    }
  }

  let newCurrentStreak: number

  if (lastActivity === yesterday) {
    // Consecutive day — increment
    newCurrentStreak = streak.current_streak + 1
  } else {
    // Gap of 2+ days or first activity ever — reset to 1
    newCurrentStreak = 1
  }

  const newLongestStreak = Math.max(streak.longest_streak, newCurrentStreak)

  const { error: updateError } = await supabase
    .from('streaks')
    .update({
      current_streak: newCurrentStreak,
      longest_streak: newLongestStreak,
      last_activity_date: today,
    })
    .eq('user_id', userId)

  if (updateError) {
    console.error('Error updating streak:', updateError)
    return null
  }

  return {
    current_streak: newCurrentStreak,
    longest_streak: newLongestStreak,
  }
}
