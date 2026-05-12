import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Sprint 2 T2 — GET détail d'un formateur : profil + email + date promotion
 * + table des formations rattachées (titre + slug + cover + is_primary).
 */
export async function GET(
  _request: Request,
  { params }: { params: { user_id: string } }
) {
  try {
    if (!UUID_RE.test(params.user_id)) {
      return NextResponse.json({ error: 'user_id invalide' }, { status: 400 })
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

    // 1. Confirme que le user a bien le rôle formateur (sinon 404).
    const { data: roleRow } = await adminSupabase
      .from('user_roles')
      .select('created_at')
      .eq('user_id', params.user_id)
      .eq('role', 'formateur')
      .maybeSingle()

    if (!roleRow) {
      return NextResponse.json({ error: 'Formateur introuvable' }, { status: 404 })
    }

    // 2. auth.users → email.
    const { data: authData } = await adminSupabase.auth.admin.getUserById(params.user_id)
    const email = authData?.user?.email ?? null

    // 3. user_profiles → nom.
    const { data: profile } = await adminSupabase
      .from('user_profiles')
      .select('first_name, last_name, profile_photo_url, city')
      .eq('id', params.user_id)
      .maybeSingle()

    // 4. Formations rattachées + JOIN formations pour les titres.
    const { data: links } = await adminSupabase
      .from('formation_instructors')
      .select('formation_id, is_primary, assigned_at')
      .eq('user_id', params.user_id)
      .order('assigned_at', { ascending: true })

    const linkRows = links ?? []
    const formationIds = linkRows.map((l) => l.formation_id as string)

    const formationsById = new Map<string, { title: string; slug: string; cover_image_url: string | null }>()
    if (formationIds.length > 0) {
      const { data: formations } = await adminSupabase
        .from('formations')
        .select('id, title, slug, cover_image_url')
        .in('id', formationIds)
      for (const f of formations ?? []) {
        formationsById.set(f.id as string, {
          title: f.title as string,
          slug: f.slug as string,
          cover_image_url: (f.cover_image_url as string | null) ?? null,
        })
      }
    }

    const formationsRattached = linkRows
      .map((l) => {
        const f = formationsById.get(l.formation_id as string)
        if (!f) return null
        return {
          formation_id: l.formation_id as string,
          title: f.title,
          slug: f.slug,
          cover_image_url: f.cover_image_url,
          is_primary: l.is_primary === true,
          assigned_at: l.assigned_at as string,
        }
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)

    return NextResponse.json({
      formateur: {
        user_id: params.user_id,
        email,
        first_name: (profile?.first_name as string | null) ?? null,
        last_name: (profile?.last_name as string | null) ?? null,
        profile_photo_url: (profile?.profile_photo_url as string | null) ?? null,
        city: (profile?.city as string | null) ?? null,
        promoted_at: roleRow.created_at as string,
        formations: formationsRattached,
      },
    })
  } catch (error) {
    console.error('Erreur API admin/formateurs/[user_id] GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * Sprint 2 T2 — Rétrograde un formateur (retrait du rôle global uniquement).
 *
 * IMPORTANT : on NE touche PAS aux rows `formation_instructors`,
 * `formateur_profiles`, `live_events`, `live_sessions`, `live_registrations`
 * de ce user. Ces données restent en place pour permettre :
 *   - une re-promotion future sans reconstruction,
 *   - la préservation de l'historique RGPD / DPC.
 *
 * Conséquence visible (loggée D2-T2-02) : le nom du user peut rester
 * affiché sur les fiches formations où il était `is_primary` jusqu'à
 * intervention manuelle via `/admin/formations/[id]/instructors`.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: { user_id: string } }
) {
  try {
    if (!UUID_RE.test(params.user_id)) {
      return NextResponse.json({ error: 'user_id invalide' }, { status: 400 })
    }

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // Sécurité : un super_admin ne peut pas se rétrograder lui-même via cette
    // route (de toute façon il ne devrait pas être formateur, mais double check).
    if (params.user_id === session.user.id) {
      return NextResponse.json(
        { error: 'Auto-rétrogradation interdite' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    const { error: deleteError, count } = await adminSupabase
      .from('user_roles')
      .delete({ count: 'exact' })
      .eq('user_id', params.user_id)
      .eq('role', 'formateur')

    if (deleteError) {
      console.error('Erreur DELETE user_roles formateur:', deleteError)
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      user_id: params.user_id,
      rows_deleted: count ?? 0,
    })
  } catch (error) {
    console.error('Erreur API admin/formateurs/[user_id] DELETE:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
