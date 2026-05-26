import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE: supprime définitivement une question news.
// Garde-fou : refuse les questions qui ne sont pas liées à une synthèse news
// (news_synthesis_id IS NULL → question formation, hors périmètre).
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { data: existing, error: fetchError } = await adminSupabase
      .from('questions')
      .select('id, news_synthesis_id')
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

    const { error } = await adminSupabase
      .from('questions')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Erreur suppression question:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Erreur API admin/news/questions/[id] DELETE:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
