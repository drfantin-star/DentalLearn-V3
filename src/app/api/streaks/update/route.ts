import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { updateStreak } from '@/lib/streak'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
    }

    const result = await updateStreak(supabase, session.user.id)

    if (!result) {
      return NextResponse.json(
        { error: 'Impossible de mettre a jour le streak' },
        { status: 500 }
      )
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('Streak update error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
