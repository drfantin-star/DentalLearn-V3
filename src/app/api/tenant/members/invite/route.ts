import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantAdmin } from '@/lib/auth/tenant-guard'
import {
  isIntraRoleValidForOrgType,
  INTRA_ROLES_BY_ORG_TYPE,
} from '@/lib/auth/intra-role-matrix'
import type { IntraRole, OrgType } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ALL_INTRA_ROLES = new Set<IntraRole>(
  Object.values(INTRA_ROLES_BY_ORG_TYPE).flat() as IntraRole[]
)

// Lookup user_id par email via Admin SDK (pas d'API directe getUserByEmail).
async function findUserIdByEmail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminSupabase: any,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase()
  const PER_PAGE = 200
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({
      page,
      perPage: PER_PAGE,
    })
    if (error || !data) return null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const found = (data.users ?? []).find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (u: any) => (u.email ?? '').toLowerCase() === target
    )
    if (found) return found.id as string
    if ((data.users ?? []).length < PER_PAGE) return null
  }
  return null
}

export async function POST(request: Request) {
  try {
    const guard = await requireTenantAdmin()
    if (!guard.ok) return guard.response

    const orgId = guard.ctx.org.id
    const orgType = guard.ctx.org.type as OrgType

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const intraRoleRaw = typeof body.intra_role === 'string' ? body.intra_role : ''

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    if (!ALL_INTRA_ROLES.has(intraRoleRaw as IntraRole)) {
      return NextResponse.json({ error: 'intra_role invalide' }, { status: 400 })
    }
    const intraRole = intraRoleRaw as IntraRole

    if (!isIntraRoleValidForOrgType(orgType, intraRole)) {
      return NextResponse.json(
        { error: `Le rôle "${intraRole}" n'est pas autorisé pour ce type d'organisation` },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    let userId = await findUserIdByEmail(adminSupabase, email)
    let membershipStatus: 'active' | 'invited' = 'active'

    if (!userId) {
      const { data: invited, error: inviteError } =
        await adminSupabase.auth.admin.inviteUserByEmail(email)

      if (inviteError || !invited?.user) {
        console.error('tenant/invite: inviteUserByEmail', inviteError)
        return NextResponse.json(
          { error: inviteError?.message ?? "Échec de l'invitation" },
          { status: 500 }
        )
      }
      userId = invited.user.id
      membershipStatus = 'invited'
    }

    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      org_id: orgId,
      intra_role: intraRole,
      status: membershipStatus,
    }
    if (membershipStatus === 'active') {
      insertPayload.joined_at = new Date().toISOString()
    }

    const { data: member, error: insertError } = await adminSupabase
      .from('organization_members')
      .insert(insertPayload)
      .select('id, user_id, intra_role, status, joined_at, created_at')
      .single()

    if (insertError) {
      // 23505 = unique_violation Postgres → user déjà membre d'une org
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: "Cet utilisateur est déjà membre d'une organisation" },
          { status: 409 }
        )
      }
      console.error('tenant/invite: INSERT membership', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('Erreur API tenant/members/invite POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
