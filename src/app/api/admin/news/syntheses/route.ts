import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

const SUMMARY_TRUNCATE_CHARS = 200
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const ALLOWED_STATUSES = new Set(['active', 'retracted', 'deleted', 'failed', 'failed_permanent'])
const ALLOWED_SORTS = new Set([
  'created_at_desc',
  'created_at_asc',
  'specialite_asc',
  'published_at_desc',
  'published_at_asc',
])

function truncate(value: string | null, max: number): string | null {
  if (!value) return value
  if (value.length <= max) return value
  return value.slice(0, max)
}

function sanitizeSearchTerm(q: string): string {
  // Supabase .or() utilise une syntaxe avec virgules / parenthèses comme séparateurs.
  // On retire ces caractères + % pour éviter qu'ils cassent la requête ou élargissent
  // implicitement le motif ILIKE. Les espaces et autres caractères restent autorisés.
  return q.replace(/[,()%]/g, '').trim()
}

type AudioState = 'published' | 'ready' | 'none'

function hasAudio(url: unknown): boolean {
  return typeof url === 'string' && url.trim().length > 0
}

// Calcule en UNE requête groupée l'état audio de chaque synthèse affichée.
// Chemin : news_episode_items.synthesis_id → news_episodes (type='insight').
//   1. 'published' s'il existe ≥1 épisode insight lié publié avec audio.
//   2. sinon 'ready' s'il existe ≥1 épisode insight lié avec audio (non publié).
//   3. sinon 'none'.
async function computeAudioStates(
  adminSupabase: ReturnType<typeof createAdminClient>,
  synthesisIds: string[],
): Promise<Map<string, AudioState>> {
  const result = new Map<string, AudioState>()
  if (synthesisIds.length === 0) return result

  // synthesis_id NULL (hard-delete legacy) est écarté par .in().
  const { data: itemRows, error: itemErr } = await adminSupabase
    .from('news_episode_items')
    .select('synthesis_id, episode_id')
    .in('synthesis_id', synthesisIds)

  if (itemErr) {
    console.error('Erreur lecture news_episode_items (audio state):', itemErr)
    return result
  }

  const episodeIds = Array.from(
    new Set(
      (itemRows ?? [])
        .map((r: { episode_id: string | null }) => r.episode_id)
        .filter((id): id is string => !!id),
    ),
  )
  if (episodeIds.length === 0) return result

  const { data: episodeRows, error: epErr } = await adminSupabase
    .from('news_episodes')
    .select('id, status, audio_url')
    .in('id', episodeIds)
    .eq('type', 'insight')

  if (epErr) {
    console.error('Erreur lecture news_episodes (audio state):', epErr)
    return result
  }

  const episodeById = new Map<
    string,
    { status: string; audio_url: string | null }
  >()
  for (const e of episodeRows ?? []) {
    episodeById.set(e.id as string, {
      status: (e.status as string) ?? '',
      audio_url: (e.audio_url as string | null) ?? null,
    })
  }

  // Agrège l'état par synthèse : published prime sur ready prime sur none.
  for (const row of itemRows ?? []) {
    const synthesisId = row.synthesis_id as string | null
    if (!synthesisId) continue
    const episode = episodeById.get(row.episode_id as string)
    if (!episode || !hasAudio(episode.audio_url)) continue

    const current = result.get(synthesisId) ?? 'none'
    if (episode.status === 'published') {
      result.set(synthesisId, 'published')
    } else if (current !== 'published') {
      result.set(synthesisId, 'ready')
    }
  }

  return result
}

// GET: Liste paginée des synthèses news avec filtres
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)

    // Pagination
    const pageRaw = parseInt(searchParams.get('page') || '1', 10)
    const limitRaw = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10)
    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1
    const limit = Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(limitRaw, MAX_LIMIT)
      : DEFAULT_LIMIT

    // Filtres
    const specialite = searchParams.get('specialite')
    const niveauPreuve = searchParams.get('niveau_preuve')
    const categoryEditorial = searchParams.get('category_editorial')
    const formationCategoryMatch = searchParams.get('formation_category_match')
    const statusParam = searchParams.get('status') ?? 'active'
    const status = ALLOWED_STATUSES.has(statusParam) ? statusParam : 'active'
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')
    const qRaw = searchParams.get('q')
    const q = qRaw ? sanitizeSearchTerm(qRaw) : ''

    // Tri
    const sortParam = searchParams.get('sort') ?? 'created_at_desc'
    const sort = ALLOWED_SORTS.has(sortParam) ? sortParam : 'created_at_desc'

    const adminSupabase = createAdminClient()

    // Quand le statut filtré est failed/failed_permanent, on ajoute les
    // colonnes de diagnostic. Sinon on garde le payload léger pour les
    // listes 'active'/'retracted'/'deleted' qui n'en ont pas besoin.
    const includeFailedDiagnostics =
      status === 'failed' || status === 'failed_permanent'
    const baseColumns =
      'id, display_title, summary_fr, specialite, themes, niveau_preuve, category_editorial, formation_category_match, status, failed_attempts, manual_added, created_at, published_at, raw:raw_id(ingested_at)'
    const selectColumns = includeFailedDiagnostics
      ? `${baseColumns}, validation_errors, validation_warnings`
      : baseColumns

    let query = adminSupabase
      .from('news_syntheses')
      .select(selectColumns, { count: 'exact' })
      .eq('status', status)

    if (specialite) query = query.eq('specialite', specialite)
    if (niveauPreuve) query = query.eq('niveau_preuve', niveauPreuve)
    if (categoryEditorial) query = query.eq('category_editorial', categoryEditorial)
    if (formationCategoryMatch === '__none__') {
      query = query.is('formation_category_match', null)
    } else if (formationCategoryMatch) {
      query = query.eq('formation_category_match', formationCategoryMatch)
    }
    if (dateFrom) query = query.gte('created_at', dateFrom)
    if (dateTo) query = query.lte('created_at', dateTo)
    if (q) {
      query = query.or(`display_title.ilike.%${q}%,summary_fr.ilike.%${q}%`)
    }

    if (sort === 'created_at_asc') {
      query = query.order('created_at', { ascending: true })
    } else if (sort === 'specialite_asc') {
      query = query
        .order('specialite', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
    } else if (sort === 'published_at_desc') {
      query = query
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false })
    } else if (sort === 'published_at_asc') {
      query = query
        .order('published_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
    } else {
      query = query.order('created_at', { ascending: false })
    }

    const from = (page - 1) * limit
    const to = from + limit - 1
    query = query.range(from, to)

    const { data, error, count } = await query

    if (error) {
      console.error('Erreur chargement news_syntheses:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const audioStates = await computeAudioStates(
      adminSupabase,
      (data ?? []).map((row: any) => row.id as string),
    )

    const syntheses = (data ?? []).map((row: any) => {
      const base = {
        id: row.id,
        audioState: audioStates.get(row.id) ?? 'none',
        display_title: row.display_title,
        summary_fr: truncate(row.summary_fr, SUMMARY_TRUNCATE_CHARS),
        specialite: row.specialite,
        themes: row.themes,
        niveau_preuve: row.niveau_preuve,
        category_editorial: row.category_editorial,
        formation_category_match: row.formation_category_match,
        status: row.status,
        failed_attempts: row.failed_attempts,
        manual_added: row.manual_added,
        created_at: row.created_at,
        published_at: row.published_at,
        ingested_at: row.raw?.ingested_at ?? null,
      }
      if (includeFailedDiagnostics) {
        return {
          ...base,
          validation_errors: row.validation_errors ?? null,
          validation_warnings: row.validation_warnings ?? null,
        }
      }
      return base
    })

    const total = count ?? 0
    const total_pages = total === 0 ? 0 : Math.ceil(total / limit)

    return NextResponse.json({
      syntheses,
      total,
      page,
      limit,
      total_pages,
    })

  } catch (error) {
    console.error('Erreur API admin/news/syntheses GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
