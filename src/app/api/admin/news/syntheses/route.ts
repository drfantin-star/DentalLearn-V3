import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'drfantin@gmail.com'

const SUMMARY_TRUNCATE_CHARS = 200
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 50

const ALLOWED_STATUSES = new Set(['active', 'retracted', 'deleted', 'failed', 'failed_permanent'])
const ALLOWED_SORTS = new Set(['created_at_desc', 'created_at_asc', 'specialite_asc'])

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

// GET: Liste paginée des synthèses news avec filtres
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.email !== ADMIN_EMAIL) {
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

    let query = adminSupabase
      .from('news_syntheses')
      .select(
        'id, display_title, summary_fr, specialite, themes, niveau_preuve, category_editorial, formation_category_match, status, failed_attempts, manual_added, created_at',
        { count: 'exact' }
      )
      .eq('status', status)

    if (specialite) query = query.eq('specialite', specialite)
    if (niveauPreuve) query = query.eq('niveau_preuve', niveauPreuve)
    if (categoryEditorial) query = query.eq('category_editorial', categoryEditorial)
    if (formationCategoryMatch) query = query.eq('formation_category_match', formationCategoryMatch)
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

    const syntheses = (data ?? []).map(row => ({
      ...row,
      summary_fr: truncate(row.summary_fr, SUMMARY_TRUNCATE_CHARS),
    }))

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
