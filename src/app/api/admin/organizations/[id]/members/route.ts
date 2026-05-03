import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  isIntraRoleValidForOrgType,
  INTRA_ROLES_BY_ORG_TYPE,
} from '@/lib/auth/intra-role-matrix'
import type { IntraRole, OrgType } from '@/lib/auth/rbac'

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
// Une recherche stricte d'email locale (pas de validation RFC complète,
// mais filtre les inputs grossièrement invalides avant l'appel admin SDK).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const ALL_INTRA_ROLES = new Set<IntraRole>(
  Object.values(INTRA_ROLES_BY_ORG_TYPE).flat() as IntraRole[]
)

// Lookup user_id par email via Admin SDK. Pas d'API directe `getUserByEmail`
// — on parcourt les pages de listUsers. Acceptable tant que la base reste
// modeste; à remplacer par une RPC SQL si la perf devient un problème.
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

export async function POST(
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

    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const intraRoleRaw = typeof body.intra_role === 'string' ? body.intra_role : ''

    if (!email || !EMAIL_RE.test(email)) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    if (!ALL_INTRA_ROLES.has(intraRoleRaw as IntraRole)) {
      return NextResponse.json({ error: 'intra_role invalide' }, { status: 400 })
    }
    const intraRole = intraRoleRaw as IntraRole

    const adminSupabase = createAdminClient()

    // 1. Lire l'org pour valider la compatibilité intra_role × org.type
    const { data: org, error: orgError } = await adminSupabase
      .from('organizations')
      .select('id, type')
      .eq('id', params.id)
      .single()

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organisation introuvable' }, { status: 404 })
    }

    if (!isIntraRoleValidForOrgType(org.type as OrgType, intraRole)) {
      return NextResponse.json(
        { error: `Le rôle "${intraRole}" n'est pas autorisé pour ce type d'organisation` },
        { status: 400 }
      )
    }

    // 2. Lookup user existant par email
    let userId = await findUserIdByEmail(adminSupabase, email)
    let membershipStatus: 'active' | 'invited' = 'active'

    // 3. Si user inexistant, l'inviter via Admin SDK (crée auth.users + envoie l'invitation)
    if (!userId) {
      const { data: invited, error: inviteError } =
        await adminSupabase.auth.admin.inviteUserByEmail(email)

      if (inviteError || !invited?.user) {
        console.error('Erreur invitation user:', inviteError)
        return NextResponse.json(
          { error: inviteError?.message ?? 'Échec de l\'invitation' },
          { status: 500 }
        )
      }
      userId = invited.user.id
      membershipStatus = 'invited'
    }

    // 4. INSERT membership. UNIQUE(user_id) → un user dans une seule org.
    const nowIso = new Date().toISOString()
    const insertPayload: Record<string, unknown> = {
      user_id: userId,
      org_id: params.id,
      intra_role: intraRole,
      status: membershipStatus,
    }
    if (membershipStatus === 'active') {
      insertPayload.joined_at = nowIso
    }

    const { data: member, error: insertError } = await adminSupabase
      .from('organization_members')
      .insert(insertPayload)
      .select('id, user_id, intra_role, status, joined_at, created_at')
      .single()

    if (insertError) {
      // 23505 = unique_violation Postgres → user déjà membre d'une organisation
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Cet utilisateur est déjà membre d\'une organisation' },
          { status: 409 }
        )
      }
      console.error('Erreur INSERT organization_members:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json(member, { status: 201 })
  } catch (error) {
    console.error('Erreur API admin/organizations/[id]/members POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
