import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { testRssFeed, testPubmedQuery } from '@/lib/news-source-validate'

// POST : test synchrone d'une source existante. Timeout 10s par appel externe
// (cf news-source-validate). Retour homogène { ok, articles_found, error? }.
export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const sourceId = params.id
    if (!sourceId) {
      return NextResponse.json({ error: 'id manquant' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data: source, error: fetchError } = await admin
      .from('news_sources')
      .select('id, name, type, url, query')
      .eq('id', sourceId)
      .maybeSingle()

    if (fetchError) {
      console.error('Erreur SELECT news_sources:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!source) {
      return NextResponse.json({ error: 'Source introuvable' }, { status: 404 })
    }

    if (source.type === 'manual') {
      return NextResponse.json({ ok: true, articles_found: 0 })
    }

    if (source.type === 'rss') {
      const query = (source.query as { feed_url?: string } | null) ?? null
      const feedUrl = query?.feed_url ?? source.url ?? ''
      const result = await testRssFeed(feedUrl)
      return NextResponse.json(result)
    }

    if (source.type === 'pubmed') {
      const query = (source.query as { term?: string } | null) ?? null
      const term = query?.term ?? ''
      const result = await testPubmedQuery(term, { retmax: 1 })
      return NextResponse.json(result)
    }

    return NextResponse.json(
      {
        ok: false,
        articles_found: 0,
        error: `Type non testable : ${source.type}`,
      },
      { status: 400 }
    )
  } catch (error: any) {
    console.error('Erreur API admin/news/sources/[id]/test POST:', error)
    return NextResponse.json(
      { ok: false, articles_found: 0, error: 'Erreur serveur' },
      { status: 500 }
    )
  }
}
