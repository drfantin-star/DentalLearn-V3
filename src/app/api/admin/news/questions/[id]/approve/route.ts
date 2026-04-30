import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'drfantin@gmail.com'

// PATCH: bascule is_daily_quiz_eligible sur une question news.
// Garde-fou : refuse les questions qui ne sont pas liées à une synthèse news
// (news_synthesis_id IS NULL → question formation, hors périmètre).
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    if (!('is_daily_quiz_eligible' in body)) {
      return NextResponse.json(
        { error: 'Champ is_daily_quiz_eligible requis' },
        { status: 400 }
      )
    }

    const value = (body as { is_daily_quiz_eligible: unknown }).is_daily_quiz_eligible

    if (typeof value !== 'boolean') {
      return NextResponse.json(
        { error: 'is_daily_quiz_eligible doit être un boolean' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    const { data: existing, error: fetchError } = await adminSupabase
      .from('questions')
      .select('id, news_synthesis_id, sequence_id')
      .eq('id', id)
      .single()

    if (fetchError) {
      const status = fetchError.code === 'PGRST116' ? 404 : 500
      console.error('Erreur lecture question:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status })
    }

    if (!existing.news_synthesis_id) {
      return NextResponse.json(
        { error: 'Cette question n\'est pas liée à une synthèse news' },
        { status: 400 }
      )
    }

    const { data, error } = await adminSupabase
      .from('questions')
      .update({ is_daily_quiz_eligible: value })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      console.error('Erreur mise à jour approbation question:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, question: data })

  } catch (error) {
    console.error('Erreur API admin/news/questions/[id]/approve PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
