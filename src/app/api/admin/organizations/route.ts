import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const ALLOWED_TYPES = new Set(['cabinet', 'hr_entity', 'training_org'])
const ALLOWED_PLANS = new Set(['standard', 'premium'])
const MAX_LIMIT = 200

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
    const typeFilter = searchParams.get('type')
    const planFilter = searchParams.get('plan')

    const adminSupabase = createAdminClient()

    let orgQuery = adminSupabase
      .from('organizations')
      .select('id, name, type, plan, created_at')
      .order('created_at', { ascending: false })
      .limit(MAX_LIMIT)

    if (typeFilter && ALLOWED_TYPES.has(typeFilter)) {
      orgQuery = orgQuery.eq('type', typeFilter)
    }
    if (planFilter && ALLOWED_PLANS.has(planFilter)) {
      orgQuery = orgQuery.eq('plan', planFilter)
    }

    const { data: orgs, error: orgsError } = await orgQuery

    if (orgsError) {
      console.error('Erreur chargement organizations:', orgsError)
      return NextResponse.json({ error: orgsError.message }, { status: 500 })
    }

    const orgIds = (orgs ?? []).map((o) => o.id)
    const memberCounts = new Map<string, number>()

    if (orgIds.length > 0) {
      const { data: members, error: membersError } = await adminSupabase
        .from('organization_members')
        .select('org_id')
        .in('org_id', orgIds)
        .eq('status', 'active')

      if (membersError) {
        console.error('Erreur chargement organization_members count:', membersError)
        return NextResponse.json({ error: membersError.message }, { status: 500 })
      }

      for (const m of members ?? []) {
        memberCounts.set(m.org_id, (memberCounts.get(m.org_id) ?? 0) + 1)
      }
    }

    const organizations = (orgs ?? []).map((o) => ({
      ...o,
      active_members_count: memberCounts.get(o.id) ?? 0,
    }))

    return NextResponse.json({ organizations })
  } catch (error) {
    console.error('Erreur API admin/organizations GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
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

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const type = typeof body.type === 'string' ? body.type : ''
    const plan = typeof body.plan === 'string' ? body.plan : 'standard'

    if (!name) {
      return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })
    }
    if (!ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: 'Type d\'organisation invalide' }, { status: 400 })
    }
    if (!ALLOWED_PLANS.has(plan)) {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // owner_user_id NOT NULL côté DB → on assigne le super_admin créateur par défaut.
    // Pourra être réassigné en V2 si nécessaire.
    const { data, error } = await adminSupabase
      .from('organizations')
      .insert({
        name,
        type,
        plan,
        owner_user_id: session.user.id,
      })
      .select('id, name, type, plan')
      .single()

    if (error) {
      console.error('Erreur création organization:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Erreur API admin/organizations POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
