import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const userId = session.user.id
    // Semantique : on stocke la DATE DE DEMANDE (now()). Le delai J+30 est
    // calcule a l'affichage cote UI et applique par le cron
    // purge_expired_deletions (deletion_requested_at < now() - 30 jours).
    const requestedAt = new Date().toISOString()

    const { error } = await supabase
      .from('user_profiles')
      .update({ deletion_requested_at: requestedAt })
      .eq('id', userId)

    if (error) throw error

    return NextResponse.json({
      success: true,
      deletion_requested_at: requestedAt
    })
  } catch (err) {
    console.error('Delete request error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = await createClient()
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
