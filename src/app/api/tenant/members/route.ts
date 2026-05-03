import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantAdmin } from '@/lib/auth/tenant-guard'

export const dynamic = 'force-dynamic'

const ALLOWED_STATUS_FILTERS = new Set(['active', 'invited', 'revoked'])

export async function GET(request: Request) {
  try {
    const guard = await requireTenantAdmin()
    if (!guard.ok) return guard.response

    const orgId = guard.ctx.org.id
    const url = new URL(request.url)
    const statusParam = url.searchParams.get('status')
    const statusFilter = statusParam && ALLOWED_STATUS_FILTERS.has(statusParam) ? statusParam : null

    const adminSupabase = createAdminClient()

    let query = adminSupabase
      .from('organization_members')
      .select('id, user_id, intra_role, status, joined_at, revoked_at, created_at')
      .eq('org_id', orgId)
      .order('created_at', { ascending: true })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    const { data: rawMembers, error: membersError } = await query

    if (membersError) {
      console.error('tenant/members GET:', membersError)
      return NextResponse.json({ error: membersError.message }, { status: 500 })
    }

    const members = rawMembers ?? []
    const userIds = members.map((m) => m.user_id)

    const profileById = new Map<
      string,
      { first_name: string | null; last_name: string | null }
    >()
    if (userIds.length > 0) {
      const { data: profiles } = await adminSupabase
        .from('user_profiles')
        .select('id, first_name, last_name')
        .in('id', userIds)

      for (const p of profiles ?? []) {
        profileById.set(p.id, { first_name: p.first_name, last_name: p.last_name })
      }
    }

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

    const enriched = members.map((m) => {
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

    return NextResponse.json({ members: enriched, org: guard.ctx.org })
  } catch (error) {
    console.error('Erreur API tenant/members GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
