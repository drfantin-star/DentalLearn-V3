import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserOrg, getUserIntraRole } from '@/lib/auth/rbac'
import type { IntraRole, UserOrg } from '@/lib/auth/rbac'

const TENANT_ADMIN_ROLES: ReadonlySet<IntraRole> = new Set<IntraRole>([
  'titulaire',
  'admin_rh',
  'admin_of',
])

export interface TenantAdminContext {
  userId: string
  org: UserOrg
  intraRole: IntraRole
}

export type TenantGuardResult =
  | { ok: true; ctx: TenantAdminContext }
  | { ok: false; response: NextResponse }

/**
 * Garde commune des routes /api/tenant/*. Vérifie :
 *  - session valide,
 *  - user rattaché à une org,
 *  - intra_role ∈ {titulaire, admin_rh, admin_of}.
 * Retourne soit le contexte, soit la réponse d'erreur à propager telle quelle.
 */
export async function requireTenantAdmin(): Promise<TenantGuardResult> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Non authentifié' }, { status: 401 }),
    }
  }

  const org = await getUserOrg(user.id)
  if (!org) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Aucune organisation' }, { status: 403 }),
    }
  }

  const intraRole = await getUserIntraRole(user.id)
  if (!intraRole || !TENANT_ADMIN_ROLES.has(intraRole)) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 }),
    }
  }

  return { ok: true, ctx: { userId: user.id, org, intraRole } }
}
