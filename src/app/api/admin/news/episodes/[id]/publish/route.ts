import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// POST — publie un épisode en statut 'ready'.
// Précondition : status === 'ready' → 409 sinon.
// Écrit published_at + validated_by (réservés à cette route uniquement).
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: episodeId } = await params

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { data: episode, error: fetchErr } = await adminSupabase
      .from('news_episodes')
      .select('id, status')
      .eq('id', episodeId)
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!episode) {
      return NextResponse.json({ error: 'Épisode introuvable' }, { status: 404 })
    }
    if (episode.status !== 'ready') {
      return NextResponse.json(
        { error: 'Episode doit être en statut ready pour être publié' },
        { status: 409 },
      )
    }

    const { data: updated, error: updErr } = await adminSupabase
      .from('news_episodes')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        validated_by: session.user.id,
      })
      .eq('id', episodeId)
      .select('id, status, published_at')
      .single()

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, episode: updated })
  } catch (err) {
    console.error('POST /api/admin/news/episodes/[id]/publish error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
