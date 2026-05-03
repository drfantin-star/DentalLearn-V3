import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireTenantAdmin } from '@/lib/auth/tenant-guard'
import {
  isIntraRoleValidForOrgType,
  isAdminIntraRole,
  INTRA_ROLES_BY_ORG_TYPE,
} from '@/lib/auth/intra-role-matrix'
import type { IntraRole, OrgType } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_STATUS = new Set(['active', 'revoked'])
const ALL_INTRA_ROLES = new Set<IntraRole>(
  Object.values(INTRA_ROLES_BY_ORG_TYPE).flat() as IntraRole[]
)

export async function PATCH(
  request: Request,
  { params }: { params: { member_id: string } }
) {
  try {
    if (!UUID_RE.test(params.member_id)) {
      return NextResponse.json({ error: 'ID invalide' }, { status: 400 })
    }

    const guard = await requireTenantAdmin()
    if (!guard.ok) return guard.response

    const orgId = guard.ctx.org.id
    const orgType = guard.ctx.org.type as OrgType

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    // Charger le membership et VÉRIFIER qu'il appartient à l'org du caller.
    const { data: member, error: memberError } = await adminSupabase
      .from('organization_members')
      .select('id, user_id, org_id, intra_role, status')
      .eq('id', params.member_id)
      .eq('org_id', orgId)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    let willBecomeRevoked = false
    let newIntraRole: IntraRole | null = null

    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !ALLOWED_STATUS.has(body.status)) {
        return NextResponse.json(
          { error: 'Status invalide (active ou revoked uniquement)' },
          { status: 400 }
        )
      }
      updates.status = body.status
      if (body.status === 'revoked') {
        updates.revoked_at = new Date().toISOString()
        willBecomeRevoked = true
      } else if (body.status === 'active' && member.status !== 'active') {
        updates.joined_at = new Date().toISOString()
        updates.revoked_at = null
      }
    }

    if (body.intra_role !== undefined) {
      if (
        typeof body.intra_role !== 'string' ||
        !ALL_INTRA_ROLES.has(body.intra_role as IntraRole)
      ) {
        return NextResponse.json({ error: 'intra_role invalide' }, { status: 400 })
      }
      const role = body.intra_role as IntraRole
      if (!isIntraRoleValidForOrgType(orgType, role)) {
        return NextResponse.json(
          { error: `Le rôle "${role}" n'est pas autorisé pour ce type d'organisation` },
          { status: 400 }
        )
      }
      updates.intra_role = role
      newIntraRole = role
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'Aucun champ modifiable fourni' }, { status: 400 })
    }

    // Garde "dernier admin"
    const currentIsAdmin = isAdminIntraRole(member.intra_role as IntraRole)
    const losesAdminPrivilege =
      (willBecomeRevoked && currentIsAdmin) ||
      (newIntraRole !== null && currentIsAdmin && !isAdminIntraRole(newIntraRole))

    if (losesAdminPrivilege) {
      const { count, error: countError } = await adminSupabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('status', 'active')
        .in('intra_role', ['titulaire', 'admin_rh', 'admin_of'])

      if (countError) {
        console.error('tenant/members count admins:', countError)
        return NextResponse.json({ error: countError.message }, { status: 500 })
      }
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: "Impossible : c'est le dernier admin actif de l'organisation" },
          { status: 409 }
        )
      }
    }

    const { data, error } = await adminSupabase
      .from('organization_members')
      .update(updates)
      .eq('id', params.member_id)
      .eq('org_id', orgId)
      .select('id, user_id, intra_role, status, joined_at, revoked_at')
      .single()

    if (error) {
      console.error('tenant/members PATCH:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erreur API tenant/members/[member_id] PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
