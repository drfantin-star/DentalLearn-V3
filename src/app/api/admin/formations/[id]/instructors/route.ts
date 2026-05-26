import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Sprint 2 T2 — GET liste des intervenants rattachés à une formation,
 * enrichie avec email + nom (jointures auth.users + user_profiles via
 * service_role).
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: 'ID formation invalide' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    // 1. Lire la formation pour avoir titre + slug + owner_org_id.
    const { data: formation, error: formationError } = await adminSupabase
      .from('formations')
      .select('id, title, slug, owner_org_id')
      .eq('id', params.id)
      .single()

    if (formationError || !formation) {
      return NextResponse.json({ error: 'Formation introuvable' }, { status: 404 })
    }

    // 2. Liste actuelle des intervenants.
    const { data: rawInstructors, error: instructorsError } = await adminSupabase
      .from('formation_instructors')
      .select('id, user_id, is_primary, assigned_at')
      .eq('formation_id', params.id)
      .order('assigned_at', { ascending: true })

    if (instructorsError) {
      console.error('Erreur chargement formation_instructors:', instructorsError)
      return NextResponse.json({ error: instructorsError.message }, { status: 500 })
    }

    const instructors = rawInstructors ?? []
    const userIds = instructors.map((i) => i.user_id as string)

    // 3. Profils (parallèle).
    const profileById = new Map<string, { first_name: string | null; last_name: string | null }>()
    if (userIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from('user_profiles')
        .select('id, first_name, last_name')
        .in('id', userIds)
      for (const p of profiles ?? []) {
        profileById.set(p.id as string, {
          first_name: (p.first_name as string | null) ?? null,
          last_name: (p.last_name as string | null) ?? null,
        })
      }
    }

    // 4. Emails (parallèle).
    const emailById = new Map<string, string | null>()
    await Promise.all(
      userIds.map(async (uid) => {
        try {
          const { data, error } = await adminSupabase.auth.admin.getUserById(uid)
          emailById.set(uid, error || !data?.user ? null : data.user.email ?? null)
        } catch {
          emailById.set(uid, null)
        }
      })
    )

    const enriched = instructors.map((row) => {
      const uid = row.user_id as string
      const profile = profileById.get(uid)
      return {
        id: row.id as string,
        user_id: uid,
        email: emailById.get(uid) ?? null,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        is_primary: row.is_primary === true,
        assigned_at: row.assigned_at as string,
      }
    })

    return NextResponse.json({ formation, instructors: enriched })
  } catch (error) {
    console.error('Erreur API admin/formations/[id]/instructors GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

/**
 * POST — Rattache un formateur à la formation.
 * Body : { user_id: string, is_primary?: boolean }
 * Si is_primary=true, démet les autres `is_primary` de la même formation
 * (un seul intervenant principal par formation).
 */
export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!UUID_RE.test(params.id)) {
      return NextResponse.json({ error: 'ID formation invalide' }, { status: 400 })
    }

    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
    const isPrimary = body.is_primary === true

    if (!UUID_RE.test(userId)) {
      return NextResponse.json({ error: 'user_id invalide' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Vérifie que le user a bien le rôle formateur (défense en profondeur :
    // l'UI filtre déjà mais on garde ce check côté API).
    const { data: hasRoleRow } = await adminSupabase
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'formateur')
      .maybeSingle()

    if (!hasRoleRow) {
      return NextResponse.json(
        { error: 'Cet utilisateur n\'a pas le rôle formateur — promouvez-le d\'abord' },
        { status: 400 }
      )
    }

    // Si is_primary=true → démettre les autres avant d'insérer.
    // Pas de transaction multi-statements côté supabase-js, mais l'ordre
    // (démettre d'abord) garantit l'invariant : à tout moment ≤1 primary.
    if (isPrimary) {
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

    const { data, error: insertError } = await adminSupabase
      .from('formation_instructors')
      .insert({
        formation_id: params.id,
        user_id: userId,
        is_primary: isPrimary,
        assigned_by: session.user.id,
      })
      .select('id, user_id, is_primary, assigned_at')
      .single()

    if (insertError) {
      // 23505 = unique_violation (formation_id, user_id) déjà liés.
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Ce formateur est déjà rattaché à cette formation' },
          { status: 409 }
        )
      }
      console.error('Erreur INSERT formation_instructors:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erreur API admin/formations/[id]/instructors POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
