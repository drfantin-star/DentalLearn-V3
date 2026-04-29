import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ALLOWED_FORMATION_CATEGORIES } from '@/lib/constants/news'

const ADMIN_EMAIL = 'drfantin@gmail.com'

const ALLOWED_FORMATION_CATEGORIES_SET: Set<string> = new Set(ALLOWED_FORMATION_CATEGORIES)

// GET: Détail d'une synthèse + article brut lié + nombre de questions associées
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    const { data: synthesis, error: synthError } = await adminSupabase
      .from('news_syntheses')
      .select('*')
      .eq('id', id)
      .single()

    if (synthError) {
      const status = synthError.code === 'PGRST116' ? 404 : 500
      console.error('Erreur chargement synthèse:', synthError)
      return NextResponse.json({ error: synthError.message }, { status })
    }

    let raw: {
      title: string
      url: string | null
      doi: string | null
      journal: string | null
      published_at: string | null
      abstract: string | null
    } | null = null

    if (synthesis.raw_id) {
      const { data: rawData, error: rawError } = await adminSupabase
        .from('news_raw')
        .select('title, url, doi, journal, published_at, abstract')
        .eq('id', synthesis.raw_id)
        .single()

      if (rawError && rawError.code !== 'PGRST116') {
        console.error('Erreur chargement news_raw lié:', rawError)
        return NextResponse.json({ error: rawError.message }, { status: 500 })
      }

      raw = rawData ?? null
    }

    const { count: questionsCount, error: questionsError } = await adminSupabase
      .from('questions')
      .select('id', { count: 'exact', head: true })
      .eq('news_synthesis_id', id)

    if (questionsError) {
      console.error('Erreur comptage questions liées:', questionsError)
      return NextResponse.json({ error: questionsError.message }, { status: 500 })
    }

    return NextResponse.json({
      synthesis,
      raw,
      questions_count: questionsCount ?? 0,
    })

  } catch (error) {
    console.error('Erreur API admin/news/syntheses/[id] GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// PATCH: Mise à jour de formation_category_match uniquement
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    if (!('formation_category_match' in body)) {
      return NextResponse.json(
        { error: 'Champ formation_category_match requis' },
        { status: 400 }
      )
    }

    const value = (body as { formation_category_match: unknown }).formation_category_match

    if (value !== null && typeof value !== 'string') {
      return NextResponse.json(
        { error: 'formation_category_match doit être string ou null' },
        { status: 400 }
      )
    }

    if (typeof value === 'string' && !ALLOWED_FORMATION_CATEGORIES_SET.has(value)) {
      return NextResponse.json(
        { error: 'formation_category_match invalide (slug non autorisé)' },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    const { data, error } = await adminSupabase
      .from('news_syntheses')
      .update({ formation_category_match: value })
      .eq('id', id)
      .select()
      .single()

    if (error) {
      const status = error.code === 'PGRST116' ? 404 : 500
      console.error('Erreur mise à jour synthèse:', error)
      return NextResponse.json({ error: error.message }, { status })
    }

    return NextResponse.json({ success: true, synthesis: data })

  } catch (error) {
    console.error('Erreur API admin/news/syntheses/[id] PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
