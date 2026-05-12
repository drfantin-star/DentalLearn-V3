import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_LIMIT = 200

/**
 * Sprint 2 T2 — Liste des users ayant le rôle global `formateur`.
 *
 * Query params optionnels :
 *   - `available_for=<formation_id>` : ne retourne que les formateurs qui NE
 *     sont PAS déjà rattachés à cette formation (utile pour le select
 *     "Ajouter un intervenant" dans /admin/formations/[id]/instructors).
 */
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const availableFor = searchParams.get('available_for')
    if (availableFor && !UUID_RE.test(availableFor)) {
      return NextResponse.json({ error: 'available_for invalide' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // 1. Toutes les lignes user_roles(formateur).
    const { data: roles, error: rolesError } = await adminSupabase
      .from('user_roles')
      .select('user_id, created_at')
      .eq('role', 'formateur')
      .order('created_at', { ascending: false })
      .limit(MAX_LIMIT)

    if (rolesError) {
      console.error('Erreur chargement user_roles formateur:', rolesError)
      return NextResponse.json({ error: rolesError.message }, { status: 500 })
    }

    let userIds = (roles ?? []).map((r) => r.user_id as string)
    const promotedAtByUser = new Map<string, string>(
      (roles ?? []).map((r) => [r.user_id as string, r.created_at as string])
    )

    // 2. Filtrage available_for : on retire les users déjà rattachés.
    if (availableFor) {
      const { data: existingLinks, error: linksError } = await adminSupabase
        .from('formation_instructors')
        .select('user_id')
        .eq('formation_id', availableFor)
      if (linksError) {
        console.error('Erreur chargement formation_instructors:', linksError)
        return NextResponse.json({ error: linksError.message }, { status: 500 })
      }
      const taken = new Set((existingLinks ?? []).map((l) => l.user_id as string))
      userIds = userIds.filter((id) => !taken.has(id))
    }

    if (userIds.length === 0) {
      return NextResponse.json({ formateurs: [] })
    }

    // 3. Comptage des rattachements par user (en un seul SELECT).
    const { data: allLinks } = await adminSupabase
      .from('formation_instructors')
      .select('user_id')
      .in('user_id', userIds)

    const countByUser = new Map<string, number>()
    for (const l of allLinks ?? []) {
      const uid = l.user_id as string
      countByUser.set(uid, (countByUser.get(uid) ?? 0) + 1)
    }

    // 4. Profils.
    const profileById = new Map<string, { first_name: string | null; last_name: string | null }>()
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

    // 5. Emails (en parallèle).
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

    const formateurs = userIds.map((uid) => {
      const profile = profileById.get(uid)
      return {
        user_id: uid,
        email: emailById.get(uid) ?? null,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        promoted_at: promotedAtByUser.get(uid) ?? null,
        formations_count: countByUser.get(uid) ?? 0,
      }
    })

    return NextResponse.json({ formateurs })
  } catch (error) {
    console.error('Erreur API admin/formateurs GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
