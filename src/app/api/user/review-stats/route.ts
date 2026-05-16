import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

type Row = {
  mastered_at: string | null
  next_review_date: string | null
  question: {
    sequence: {
      formation: { category: string | null } | null
    } | null
  } | null
}

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('user_question_review')
      .select(`
        mastered_at,
        next_review_date,
        question:questions!inner (
          sequence:sequences!inner (
            formation:formations!inner ( category )
          )
        )
      `)
      .eq('user_id', user.id)

    if (error) {
      console.error('review-stats query error:', error)
      return NextResponse.json({ error: 'Erreur lecture stats' }, { status: 500 })
    }

    const stats: Record<string, { mastered: number; active: number; rate: number }> = {}
    for (const row of (data ?? []) as unknown as Row[]) {
      const category = row.question?.sequence?.formation?.category
      if (!category) continue
      if (!stats[category]) stats[category] = { mastered: 0, active: 0, rate: 0 }
      if (row.mastered_at) {
        stats[category].mastered++
      } else if (row.next_review_date) {
        stats[category].active++
      }
    }
    for (const key of Object.keys(stats)) {
      const s = stats[key]
      const total = s.mastered + s.active
      s.rate = total > 0 ? s.mastered / total : 0
    }

    return NextResponse.json({ stats })
  } catch (err) {
    console.error('review-stats GET error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
