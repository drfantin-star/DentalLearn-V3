import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { SourcesPageClient, type SourceRow } from './SourcesPageClient'

// Page server : auth + agrégation des stats par source.
// Les interactions (modal "Ajouter", boutons "Tester" / "Désactiver") sont
// déléguées à <SourcesPageClient/>.
export const dynamic = 'force-dynamic'

export default async function SourcesPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/login')
  }
  if (!(await isSuperAdmin(session.user.id))) {
    redirect('/')
  }

  const admin = createAdminClient()
  const cutoff30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

  // 1) Sources (toutes, y compris inactives).
  const sourcesPromise = admin
    .from('news_sources')
    .select(
      'id, name, type, url, query, spe_tags, active, notes, last_fetched_at, error_count, created_at'
    )
    .order('active', { ascending: true })
    .order('name', { ascending: true })

  // 2) news_raw (30j) — group by source_id.
  const rawPromise = admin
    .from('news_raw')
    .select('source_id')
    .gte('ingested_at', cutoff30d)
    .not('source_id', 'is', null)

  // 3) news_scored (30j, score >= 0.70) — join news_raw pour remonter source_id.
  const scoredPromise = admin
    .from('news_scored')
    .select('news_raw!inner(source_id)')
    .gte('relevance_score', 0.7)
    .gte('scored_at', cutoff30d)

  // 4) news_syntheses (30j, status = 'active') — join news_raw.
  const synthesesPromise = admin
    .from('news_syntheses')
    .select('news_raw!inner(source_id)')
    .eq('status', 'active')
    .gte('created_at', cutoff30d)

  const [sourcesRes, rawRes, scoredRes, synthRes] = await Promise.all([
    sourcesPromise,
    rawPromise,
    scoredPromise,
    synthesesPromise,
  ])

  if (sourcesRes.error) {
    throw new Error(`news_sources: ${sourcesRes.error.message}`)
  }

  const ingeresMap = countBySourceId(rawRes.data ?? [], (r) => r.source_id)
  const eligiblesMap = countBySourceId(scoredRes.data ?? [], (r) =>
    extractEmbeddedSourceId(r.news_raw)
  )
  const synthMap = countBySourceId(synthRes.data ?? [], (r) =>
    extractEmbeddedSourceId(r.news_raw)
  )

  const rows: SourceRow[] = (sourcesRes.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    url: s.url,
    active: s.active,
    notes: s.notes,
    last_fetched_at: s.last_fetched_at,
    error_count: s.error_count ?? 0,
    query: s.query as Record<string, unknown> | null,
    spe_tags: s.spe_tags ?? [],
    articles_ingeres_30j: ingeresMap.get(s.id) ?? 0,
    articles_eligibles_30j: eligiblesMap.get(s.id) ?? 0,
    articles_synthetises_30j: synthMap.get(s.id) ?? 0,
  }))

  return <SourcesPageClient initialSources={rows} />
}

function countBySourceId<T>(rows: T[], getId: (row: T) => string | null | undefined): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) {
    const id = getId(row)
    if (!id) continue
    map.set(id, (map.get(id) ?? 0) + 1)
  }
  return map
}

// L'embed Supabase peut renvoyer soit un objet, soit un tableau selon la
// cardinalité inférée. On normalise.
function extractEmbeddedSourceId(embedded: unknown): string | null {
  if (!embedded) return null
  if (Array.isArray(embedded)) {
    const first = embedded[0] as { source_id?: string | null } | undefined
    return first?.source_id ?? null
  }
  return (embedded as { source_id?: string | null }).source_id ?? null
}
