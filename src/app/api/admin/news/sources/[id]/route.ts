import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'drfantin@gmail.com'

// PATCH : soft-toggle d'une source. Seul le champ `active` est exposé ici
// (pas de suppression définitive — soft delete uniquement, conformément au
// brief Phase 2 §B3).
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const sourceId = params.id
    if (!sourceId) {
      return NextResponse.json({ error: 'id manquant' }, { status: 400 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    if (typeof body?.active !== 'boolean') {
      return NextResponse.json(
        { error: 'Champ `active` (boolean) requis' },
        { status: 400 }
      )
    }

    const admin = createAdminClient()
    const { data: updated, error } = await admin
      .from('news_sources')
      .update({ active: body.active })
      .eq('id', sourceId)
      .select('id, active')
      .maybeSingle()

    if (error) {
      console.error('Erreur UPDATE news_sources:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!updated) {
      return NextResponse.json({ error: 'Source introuvable' }, { status: 404 })
    }

    return NextResponse.json({ success: true, id: updated.id, active: updated.active })
  } catch (error: any) {
    console.error('Erreur API admin/news/sources/[id] PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
