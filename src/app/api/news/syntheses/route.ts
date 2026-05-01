import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { NEWS_SPECIALITES_SET } from '@/lib/constants/news'
import type { NewsCard } from '@/types/news'

export const dynamic = 'force-dynamic'

const DEFAULT_LIMIT = 5
const MAX_LIMIT = 50

const NEWS_CARD_COLUMNS = [
  'id',
  'display_title',
  'specialite',
  'category_editorial',
  'formation_category_match',
  'published_at',
  'cover_image_url',
  'summary_fr',
  'clinical_impact',
  'key_figures',
  'evidence_level',
  'caveats',
].join(', ')

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    const limitRaw = parseInt(searchParams.get('limit') ?? String(DEFAULT_LIMIT), 10)
    const pageRaw = parseInt(searchParams.get('page') ?? '1', 10)
    const specialite = searchParams.get('specialite')

    if (!Number.isFinite(limitRaw) || limitRaw < 1) {
      return NextResponse.json({ error: 'Paramètre `limit` invalide' }, { status: 400 })
    }
    if (!Number.isFinite(pageRaw) || pageRaw < 1) {
      return NextResponse.json({ error: 'Paramètre `page` invalide' }, { status: 400 })
    }

    const limit = Math.min(limitRaw, MAX_LIMIT)
    const page = pageRaw

    if (specialite !== null && !NEWS_SPECIALITES_SET.has(specialite)) {
      return NextResponse.json({ error: 'Paramètre `specialite` invalide' }, { status: 400 })
    }

    const supabase = createClient()

    let query = supabase
      .from('news_syntheses')
      .select(NEWS_CARD_COLUMNS, { count: 'exact' })
      .eq('status', 'active')

    if (specialite) {
      query = query.eq('specialite', specialite)
    }

    const from = (page - 1) * limit
    const to = page * limit - 1

    const { data, error, count } = await query
      .order('published_at', { ascending: false, nullsFirst: false })
      .range(from, to)

    if (error) {
      console.error('news/syntheses list error:', error)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    return NextResponse.json({
      data: (data ?? []) as unknown as NewsCard[],
      total: count ?? 0,
      page,
    })
  } catch (err) {
    console.error('news/syntheses GET error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
