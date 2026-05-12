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

export interface FormateurFormation {
  id: string
  title: string
  slug: string
  cover_image_url: string | null
  is_primary: boolean
}

// ─── Cache par requête ────────────────────────────────────────────────────────
// Map en mémoire locale au module. Réinitialisé à chaque nouvelle invocation
// Edge/Node dans le contexte Next.js App Router — pas de state global persistant.

const roleCache = new Map<string, boolean>()
const orgCache = new Map<string, UserOrg | null>()
const intraRoleCache = new Map<string, IntraRole | null>()
const formateurFormationsCache = new Map<string, FormateurFormation[]>()

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

/**
 * Sprint 2 — Vérifie si un userId possède le rôle global `formateur`.
 * Délègue à `hasRole(userId, 'formateur')`.
 */
export async function isFormateur(userId: string): Promise<boolean> {
  return hasRole(userId, 'formateur')
}

/**
 * Sprint 2 — Liste des formations animées par un formateur (jointure
 * `formation_instructors` + `formations`). Renvoie un tableau vide si le
 * user n'est rattaché à aucune formation. Le flag `is_primary` provient
 * de `formation_instructors` pour ce user-là.
 */
export async function getFormateurFormations(
  userId: string
): Promise<FormateurFormation[]> {
  const cacheKey = `fmt:${userId}`
  if (formateurFormationsCache.has(cacheKey)) {
    return formateurFormationsCache.get(cacheKey)!
  }

  const supabase = createClient()

  // 1. Appel helper SQL : retourne SETOF uuid (les formation_id).
  const { data: idsRaw, error: idsError } = await supabase.rpc(
    'get_formateur_formations',
    { p_user_id: userId }
  )

  if (idsError || !Array.isArray(idsRaw) || idsRaw.length === 0) {
    formateurFormationsCache.set(cacheKey, [])
    return []
  }

  // La RPC peut retourner soit string[] soit {get_formateur_formations: string}[]
  // selon la sérialisation PostgREST des SETOF scalaires. On normalise.
  const ids: string[] = idsRaw
    .map((r: unknown) =>
      typeof r === 'string' ? r : (r as { get_formateur_formations?: string })?.get_formateur_formations ?? null
    )
    .filter((v): v is string => typeof v === 'string')

  if (ids.length === 0) {
    formateurFormationsCache.set(cacheKey, [])
    return []
  }

  // 2. JOIN formations.
  const { data: formations, error: formationsError } = await supabase
    .from('formations')
    .select('id, title, slug, cover_image_url')
    .in('id', ids)

  if (formationsError || !formations) {
    formateurFormationsCache.set(cacheKey, [])
    return []
  }

  // 3. Lecture du flag is_primary depuis formation_instructors pour ce user.
  const { data: links, error: linksError } = await supabase
    .from('formation_instructors')
    .select('formation_id, is_primary')
    .eq('user_id', userId)
    .in('formation_id', ids)

  const primaryByFormation = new Map<string, boolean>()
  if (!linksError && links) {
    for (const l of links) {
      primaryByFormation.set(l.formation_id as string, l.is_primary === true)
    }
  }

  const result: FormateurFormation[] = formations.map((f) => ({
    id: f.id as string,
    title: f.title as string,
    slug: f.slug as string,
    cover_image_url: (f.cover_image_url as string | null) ?? null,
    is_primary: primaryByFormation.get(f.id as string) ?? false,
  }))

  formateurFormationsCache.set(cacheKey, result)
  return result
}

/**
 * Sprint 2 — Vérifie qu'un userId est rattaché en tant que formateur à
 * une formation donnée. Délègue au helper SQL `is_formateur_of()`.
 */
export async function isFormateurOf(
  userId: string,
  formationId: string
): Promise<boolean> {
  const cacheKey = `fmtof:${userId}:${formationId}`
  if (roleCache.has(cacheKey)) return roleCache.get(cacheKey)!

  const supabase = createClient()
  const { data, error } = await supabase.rpc('is_formateur_of', {
    p_user_id: userId,
    p_formation_id: formationId,
  })

  const result = !error && data === true
  roleCache.set(cacheKey, result)
  return result
}
