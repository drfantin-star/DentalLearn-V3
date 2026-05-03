import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const ALLOWED_PLANS = new Set(['standard', 'premium'])

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!UUID_RE.test(params.id)) {
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

    const { data: org, error: orgError } = await adminSupabase
      .from('organizations')
      .select('id, name, type, plan, owner_user_id, created_at, updated_at')
      .eq('id', params.id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })
    }

    const { data: rawMembers, error: membersError } = await adminSupabase
      .from('organization_members')
      .select('id, user_id, intra_role, status, joined_at, revoked_at, created_at')
      .eq('org_id', params.id)
      .order('created_at', { ascending: true })

    if (membersError) {
      console.error('Erreur chargement membres:', membersError)
      return NextResponse.json({ error: membersError.message }, { status: 500 })
    }

    const members = rawMembers ?? []
    const userIds = members.map((m) => m.user_id)

    // Profil (nom) — depuis user_profiles, accessible via service role.
    const profileById = new Map<string, { first_name: string | null; last_name: string | null }>()
    if (userIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from('user_profiles')
        .select('id, first_name, last_name')
        .in('id', userIds)

      for (const p of profiles ?? []) {
        profileById.set(p.id, { first_name: p.first_name, last_name: p.last_name })
      }
    }

    // Email — auth.users via admin SDK getUserById, en parallèle.
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

    const enrichedMembers = members.map((m) => {
      const profile = profileById.get(m.user_id)
      return {
        id: m.id,
        user_id: m.user_id,
        email: emailById.get(m.user_id) ?? null,
        first_name: profile?.first_name ?? null,
        last_name: profile?.last_name ?? null,
        intra_role: m.intra_role,
        status: m.status,
        joined_at: m.joined_at,
        revoked_at: m.revoked_at,
        created_at: m.created_at,
      }
    })

    return NextResponse.json({ organization: org, members: enrichedMembers })
  } catch (error) {
    console.error('Erreur API admin/organizations/[id] GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    if (!UUID_RE.test(params.id)) {
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
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (body.name !== undefined) {
      const name = typeof body.name === 'string' ? body.name.trim() : ''
      if (!name) {
        return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
      }
      updates.name = name
    }

    if (body.plan !== undefined) {
      if (typeof body.plan !== 'string' || !ALLOWED_PLANS.has(body.plan)) {
        return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
      }
      updates.plan = body.plan
    }

    // type est immuable après création — on ignore silencieusement si fourni.

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucun champ modifiable fourni' }, { status: 400 })
    }

    updates.updated_at = new Date().toISOString()

    const adminSupabase = createAdminClient()

    const { data, error } = await adminSupabase
      .from('organizations')
      .update(updates)
      .eq('id', params.id)
      .select('id, name, type, plan, updated_at')
      .single()

    if (error) {
      console.error('Erreur PATCH organization:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erreur API admin/organizations/[id] PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
