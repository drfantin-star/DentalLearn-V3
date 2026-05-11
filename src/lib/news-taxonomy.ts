import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Résolution serveur-side des slugs `news_taxonomy` → libellés français.
 *
 * Source de vérité unique : table `news_taxonomy` (30 lignes actives au
 * 11/05/2026 : 12 spécialités + 10 niveaux de preuve + 8 thèmes). Évite la
 * dérive des constantes TS dupliquées côté front (cf. NEWS_SPECIALITE_LABELS
 * et NEWS_NIVEAU_PREUVE dans src/lib/constants/news.ts).
 *
 * Cache mémoire process (TTL 5 min) — la table est quasi statique. Le cache
 * est partagé entre tous les appels du même process Node.js. Acceptable car
 * `news_taxonomy` ne change qu'à la suite d'un déploiement (migration de
 * seed) ; 5 minutes de désynchronisation post-déploiement est négligeable.
 *
 * Filtre `active = true` : exclut les slugs dépréciés qui pourraient encore
 * traîner dans des synthèses anciennes.
 *
 * Décision Q-T8-5=c (T8 v2).
 */

const CACHE_TTL_MS = 5 * 60 * 1000 // 5 min

interface CacheEntry {
  label: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

function readCache(slug: string): string | null {
  const entry = cache.get(slug)
  if (!entry) return null
  if (entry.expiresAt < Date.now()) {
    cache.delete(slug)
    return null
  }
  return entry.label
}

function writeCache(slug: string, label: string): void {
  cache.set(slug, { label, expiresAt: Date.now() + CACHE_TTL_MS })
}

/**
 * Capitalise un slug pour fallback si non trouvé en BDD :
 * "peri-implantite" → "Peri Implantite".
 */
function capitalizeSlug(slug: string): string {
  if (!slug) return ''
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Résout un tableau de slugs en libellés français.
 *
 * - Hits cache : retournés immédiatement.
 * - Misses cache : 1 seule query batchée `WHERE slug = ANY($1)`.
 * - Slugs introuvables en BDD : fallback `capitalizeSlug(slug)`.
 *
 * Retourne un Record<slug, label> qui contient TOUTES les entrées de `slugs`
 * (jamais d'undefined) pour simplifier la lecture côté caller.
 */
export async function resolveTaxonomyLabels(
  supabase: SupabaseClient,
  slugs: string[],
): Promise<Record<string, string>> {
  if (slugs.length === 0) return {}

  const uniqueSlugs = Array.from(new Set(slugs.filter(Boolean)))
  const result: Record<string, string> = {}
  const toFetch: string[] = []

  for (const slug of uniqueSlugs) {
    const cached = readCache(slug)
    if (cached !== null) {
      result[slug] = cached
    } else {
      toFetch.push(slug)
    }
  }

  if (toFetch.length === 0) return result

  const { data, error } = await supabase
    .from('news_taxonomy')
    .select('slug, label')
    .in('slug', toFetch)
    .eq('active', true)

  if (error) {
    console.warn('[resolveTaxonomyLabels] BDD error, fallback to capitalize:', error.message)
    for (const slug of toFetch) {
      result[slug] = capitalizeSlug(slug)
    }
    return result
  }

  const found = new Set<string>()
  for (const row of data ?? []) {
    if (row.slug && row.label) {
      result[row.slug] = row.label
      writeCache(row.slug, row.label)
      found.add(row.slug)
    }
  }

  // Slugs absents de la BDD : fallback capitalize, sans pollution du cache
  // (on ne veut pas mémoriser un fallback qui pourrait masquer un futur seed).
  for (const slug of toFetch) {
    if (!found.has(slug)) {
      result[slug] = capitalizeSlug(slug)
    }
  }

  return result
}

/**
 * Réservé aux tests (jamais appelé en runtime).
 */
export function _resetTaxonomyCache(): void {
  cache.clear()
}
