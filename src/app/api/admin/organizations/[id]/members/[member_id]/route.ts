import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  isIntraRoleValidForOrgType,
  isAdminIntraRole,
  INTRA_ROLES_BY_ORG_TYPE,
} from '@/lib/auth/intra-role-matrix'
import type { IntraRole, OrgType } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ALLOWED_STATUS_TRANSITIONS = new Set(['active', 'revoked'])
const ALL_INTRA_ROLES = new Set<IntraRole>(
  Object.values(INTRA_ROLES_BY_ORG_TYPE).flat() as IntraRole[]
)

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; member_id: string } }
) {
  try {
    if (!UUID_RE.test(params.id) || !UUID_RE.test(params.member_id)) {
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

    const adminSupabase = createAdminClient()

    // Charger membership + org pour valider
    const { data: member, error: memberError } = await adminSupabase
      .from('organization_members')
      .select('id, user_id, org_id, intra_role, status')
      .eq('id', params.member_id)
      .eq('org_id', params.id)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
    }

    const { data: org, error: orgError } = await adminSupabase
      .from('organizations')
      .select('id, type')
      .eq('id', params.id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })
    }

    const updates: Record<string, unknown> = {}
    let willBecomeRevoked = false
    let newIntraRole: IntraRole | null = null

    if (body.status !== undefined) {
      if (typeof body.status !== 'string' || !ALLOWED_STATUS_TRANSITIONS.has(body.status)) {
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
      if (!isIntraRoleValidForOrgType(org.type as OrgType, role)) {
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

    // Garde "dernier admin" : on bloque la révocation OU le changement de rôle
    // si le membre courant est admin et qu'il est le seul admin actif de l'org.
    const currentIsAdmin = isAdminIntraRole(member.intra_role as IntraRole)
    const losesAdminPrivilege =
      (willBecomeRevoked && currentIsAdmin) ||
      (newIntraRole !== null && currentIsAdmin && !isAdminIntraRole(newIntraRole))

    if (losesAdminPrivilege) {
      const { count, error: countError } = await adminSupabase
        .from('organization_members')
        .select('id', { count: 'exact', head: true })
        .eq('org_id', params.id)
        .eq('status', 'active')
        .in('intra_role', ['titulaire', 'admin_rh', 'admin_of'])

      if (countError) {
        console.error('Erreur count admins:', countError)
        return NextResponse.json({ error: countError.message }, { status: 500 })
      }
      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          { error: 'Impossible : c\'est le dernier admin actif de l\'organisation' },
          { status: 409 }
        )
      }
    }

    const { data, error } = await adminSupabase
      .from('organization_members')
      .update(updates)
      .eq('id', params.member_id)
      .eq('org_id', params.id)
      .select('id, user_id, intra_role, status, joined_at, revoked_at')
      .single()

    if (error) {
      console.error('Erreur PATCH organization_members:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Erreur API admin/organizations/[id]/members/[member_id] PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
