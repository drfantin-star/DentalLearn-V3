import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Sprint 2 T2 — Retire un intervenant d'une formation (DELETE formation_instructors).
 * Ne touche PAS au rôle formateur global du user ni à ses autres rattachements.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; user_id: string } }
) {
  try {
    if (!UUID_RE.test(params.id) || !UUID_RE.test(params.user_id)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()
    const { error, count } = await adminSupabase
      .from('formation_instructors')
      .delete({ count: 'exact' })
      .eq('formation_id', params.id)
      .eq('user_id', params.user_id)

    if (error) {
      console.error('Erreur DELETE formation_instructors:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if ((count ?? 0) === 0) {
      return NextResponse.json({ error: 'Rattachement introuvable' }, { status: 404 })
    }

    return NextResponse.json({ success: true, rows_deleted: count })
  } catch (error) {
    console.error('Erreur API admin/formations/[id]/instructors/[user_id] DELETE:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * PATCH — Modifie le flag `is_primary` d'un rattachement existant.
 * Body : { is_primary: boolean }
 * Si is_primary=true, démet les autres lignes primary de la même formation
 * (un seul primary par formation, invariant garanti par l'ordre des updates).
 */
export async function PATCH(
  request: Request,
  { params }: { params: { id: string; user_id: string } }
) {
  try {
    if (!UUID_RE.test(params.id) || !UUID_RE.test(params.user_id)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object' || typeof body.is_primary !== 'boolean') {
      return NextResponse.json(
        { error: 'Body invalide : { is_primary: boolean } attendu' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    if (body.is_primary === true) {
      // 1. Démet tous les is_primary actuels de cette formation.
      const { error: demoteError } = await adminSupabase
        .from('formation_instructors')
        .update({ is_primary: false })
        .eq('formation_id', params.id)
        .eq('is_primary', true)
      if (demoteError) {
        console.error('Erreur démise is_primary:', demoteError)
        return NextResponse.json({ error: demoteError.message }, { status: 500 })
      }
    }

    // 2. Patch la ligne ciblée.
    const { data, error: updateError } = await adminSupabase
      .from('formation_instructors')
      .update({ is_primary: body.is_primary })
      .eq('formation_id', params.id)
      .eq('user_id', params.user_id)
      .select('id, user_id, is_primary')
      .single()

    if (updateError || !data) {
      if (updateError) console.error('Erreur PATCH formation_instructors:', updateError)
      return NextResponse.json(
        { error: updateError?.message ?? 'Rattachement introuvable' },
        { status: updateError ? 500 : 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erreur API admin/formations/[id]/instructors/[user_id] PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
