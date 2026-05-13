import { cache } from 'react'
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

export interface FormateurStatsPerFormation {
  formation_id: string
  formation_title: string
  formation_slug: string
  formation_cover: string | null
  is_primary: boolean
  inscrits: number
  completion_rate: number | null
  ecoutes: number
  points_distribues: number
}

export interface FormateurStats {
  period: { date_from: string; date_to: string }
  global: {
    inscrits_total: number
    completion_rate: number | null
    ecoutes_audio: number
    points_distribues: number
  }
  per_formation: FormateurStatsPerFormation[]
  formations_count: number
}

// ─── Cache par requête ────────────────────────────────────────────────────────
// Les helpers sensibles aux mutations de rôles/membership (isSuperAdmin,
// hasRole, isFormateurOf, getUserIntraRole) sont mémoïsés via React `cache()`
// qui scope strictement la mémoization à la durée d'une seule requête HTTP
// — y compris dans les Route Handlers App Router. Cela évite les Map au scope
// module qui persistent sur les Lambdas warm Vercel (bug observé : un user
// révoqué du rôle formateur voyait encore les flags is_formateur=true en cache
// jusqu'au cold start).
//
// Les caches `orgCache` et `formateurFormationsCache` restent au scope module
// pour l'instant (out of scope du fix bug D2-T3.5 ; à revoir Sprint 3 si
// reproduction d'un symptôme analogue).

const orgCache = new Map<string, UserOrg | null>()
const formateurFormationsCache = new Map<string, FormateurFormation[]>()

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Vérifie si un userId possède un rôle global donné.
 *
 * Lit directement la table `user_roles` (RLS `user_roles_select_own` autorise
 * `auth.uid() = user_id`). On évite la RPC SQL `has_role()` qui retournait
 * `false` silencieusement depuis le client supabase-js v2 en preview T3.5
 * (cause profonde non identifiée — probablement bug de sérialisation de
 * l'enum `app_role` par PostgREST quand passé en string non castée depuis
 * supabase-js ; le SQL équivalent direct renvoie bien `true`).
 *
 * Mémoïsé par requête via React `cache()`.
 */
export const hasRole = cache(async (userId: string, role: AppRole): Promise<boolean> => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', role)
    .maybeSingle()

  if (error) {
    console.error('[rbac.hasRole] user_roles read failed', {
      userId,
      role,
      error: error.message,
    })
    return false
  }
  return data !== null
})

/**
 * Vérifie si un userId est super_admin.
 * Délègue à `hasRole(userId, 'super_admin')` pour partager l'implémentation
 * lecture directe (cf. note de `hasRole`).
 * Mémoïsé par requête via React `cache()`.
 */
export const isSuperAdmin = cache(async (userId: string): Promise<boolean> => {
  return hasRole(userId, 'super_admin')
})

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
 * Mémoïsé par requête via React `cache()`.
 */
export const getUserIntraRole = cache(async (userId: string): Promise<IntraRole | null> => {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('organization_members')
    .select('intra_role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single()

  return error || !data ? null : (data.intra_role as IntraRole)
})

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
 * Mémoïsé par requête via React `cache()`.
 */
export const isFormateurOf = cache(async (
  userId: string,
  formationId: string
): Promise<boolean> => {
  const supabase = createClient()
  const { data, error } = await supabase.rpc('is_formateur_of', {
    p_user_id: userId,
    p_formation_id: formationId,
  })
  return !error && data === true
})

/**
 * Sprint 2 / Ticket 3 — KPIs agrégés du formateur sur la fenêtre temporelle
 * spécifiée. Aucun champ nominatif retourné (RGPD modèle A — agrégations SQL
 * pures). `completion_rate` est `null` si N<5 sur la fenêtre (masquage
 * statistique pour éviter la ré-identification sur petits effectifs).
 *
 * Période par défaut : 30 jours glissants (dateTo = aujourd'hui UTC).
 *
 * Délègue au helper SQL `formateur_aggregated_stats()` (`STABLE SECURITY
 * DEFINER`). Pas de cache module-local : la période varie et le coût de
 * recalcul est négligeable (volumes prod observés 13/05/2026 sous la
 * centaine de lignes par table impliquée).
 */
export async function getFormateurStats(
  userId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<FormateurStats> {
  const to = dateTo ?? new Date()
  const from = dateFrom ?? new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)

  const toIso = to.toISOString().slice(0, 10)
  const fromIso = from.toISOString().slice(0, 10)

  const empty: FormateurStats = {
    period: { date_from: fromIso, date_to: toIso },
    global: {
      inscrits_total: 0,
      completion_rate: null,
      ecoutes_audio: 0,
      points_distribues: 0,
    },
    per_formation: [],
    formations_count: 0,
  }

  const supabase = createClient()
  const { data, error } = await supabase.rpc('formateur_aggregated_stats', {
    p_user_id: userId,
    p_date_from: fromIso,
    p_date_to: toIso,
  })

  if (error || !data || typeof data !== 'object') {
    return empty
  }

  return data as FormateurStats
}
