import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AppRole =
  | 'super_admin'
  | 'formateur'
  | 'cs_member'
  | 'marketing'
  | 'support'
  | 'user'

export type OrgType = 'cabinet' | 'hr_entity' | 'training_org'

export type OrgPlan = 'standard' | 'premium'

export type IntraRole =
  | 'titulaire'
  | 'collaborateur'
  | 'assistante'
  | 'admin_rh'
  | 'manager'
  | 'praticien_salarie'
  | 'admin_of'
  | 'formateur_of'
  | 'apprenant_of'

export type MembershipStatus = 'active' | 'invited' | 'revoked'

export interface UserOrg {
  id: string
  type: OrgType
  plan: OrgPlan
  name: string
}

// ─── Cache par requête ────────────────────────────────────────────────────────
// Map en mémoire locale au module. Réinitialisé à chaque nouvelle invocation
// Edge/Node dans le contexte Next.js App Router — pas de state global persistant.

const roleCache = new Map<string, boolean>()
const orgCache = new Map<string, UserOrg | null>()
const intraRoleCache = new Map<string, IntraRole | null>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Vérifie si un userId est super_admin.
 * Appelle le helper SQL `is_super_admin()` créé en T1.
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const cacheKey = `sa:${userId}`
  if (roleCache.has(cacheKey)) return roleCache.get(cacheKey)!

  const supabase = createClient()
  const { data, error } = await supabase.rpc('is_super_admin', {
    p_user_id: userId,
  })

  const result = !error && data === true
  roleCache.set(cacheKey, result)
  return result
}

/**
 * Vérifie si un userId possède un rôle global donné.
 * Appelle le helper SQL `has_role()` créé en T1.
 */
export async function hasRole(userId: string, role: AppRole): Promise<boolean> {
  const cacheKey = `role:${userId}:${role}`
  if (roleCache.has(cacheKey)) return roleCache.get(cacheKey)!

  const supabase = createClient()
  const { data, error } = await supabase.rpc('has_role', {
    p_user_id: userId,
    p_role: role,
  })

  const result = !error && data === true
  roleCache.set(cacheKey, result)
  return result
}

/**
 * Retourne l'organisation active du user, ou null si orgless / invité.
 * Enrichit le résultat de `user_org()` SQL avec name + type + plan.
 */
export async function getUserOrg(userId: string): Promise<UserOrg | null> {
  const cacheKey = `org:${userId}`
  if (orgCache.has(cacheKey)) return orgCache.get(cacheKey)!

  const supabase = createClient()

  const { data: orgId, error: rpcError } = await supabase.rpc('user_org', {
    p_user_id: userId,
  })

  if (rpcError || !orgId) {
    orgCache.set(cacheKey, null)
    return null
  }

  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, name, type, plan')
    .eq('id', orgId)
    .single()

  const result = orgError || !org ? null : (org as UserOrg)
  orgCache.set(cacheKey, result)
  return result
}

/**
 * Retourne l'intra_role actif du user dans son organisation, ou null si orgless.
 */
export async function getUserIntraRole(userId: string): Promise<IntraRole | null> {
  const cacheKey = `intra:${userId}`
  if (intraRoleCache.has(cacheKey)) return intraRoleCache.get(cacheKey)!

  const supabase = createClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('intra_role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  const result = error || !data ? null : (data.intra_role as IntraRole)
  intraRoleCache.set(cacheKey, result)
  return result
}
