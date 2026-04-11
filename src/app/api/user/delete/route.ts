import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id
    const deletionDate = new Date()
    deletionDate.setDate(deletionDate.getDate() + 30)

    const { error } = await supabase
      .from('user_profiles')
      .update({ deletion_requested_at: deletionDate.toISOString() })
      .eq('id', userId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      deletion_date: deletionDate.toISOString()
    })
  } catch (err) {
    console.error('Delete request error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id

    // Annuler la demande de suppression
    const { error } = await supabase
      .from('user_profiles')
      .update({ deletion_requested_at: null })
      .eq('id', userId)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('Cancel delete error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
