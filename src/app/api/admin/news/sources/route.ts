import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { testRssFeed, testPubmedQuery } from '@/lib/news-source-validate'

const ADMIN_EMAIL = 'drfantin@gmail.com'

const NAME_MIN = 3
const NAME_MAX = 200
const ALLOWED_TYPES = new Set(['rss', 'pubmed'])
const PUBMED_VALIDATION_RELDATE = 90 // fenêtre élargie pour la validation pré-INSERT

interface ValidationError {
  field: string
  message: string
}

// POST : crée une nouvelle source RSS ou PubMed. Le type 'manual' est interdit
// ici (créé par migration). Retour 422 + warning si le test pré-INSERT remonte
// 0 article ; le client peut renvoyer la requête avec `force: true` pour
// passer outre.
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    const errors: ValidationError[] = []

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name) {
      errors.push({ field: 'name', message: 'Nom requis' })
    } else if (name.length < NAME_MIN || name.length > NAME_MAX) {
      errors.push({
        field: 'name',
        message: `Nom doit contenir entre ${NAME_MIN} et ${NAME_MAX} caractères`,
      })
    }

    const type = typeof body.type === 'string' ? body.type : ''
    if (!ALLOWED_TYPES.has(type)) {
      errors.push({ field: 'type', message: 'Type invalide (rss ou pubmed)' })
    }

    let url: string | null = null
    let term: string | null = null
    let reldate: number | null = null

    if (type === 'rss') {
      const rawUrl = typeof body.url === 'string' ? body.url.trim() : ''
      if (!rawUrl) {
        errors.push({ field: 'url', message: 'URL du flux requise' })
      } else {
        try {
          const parsed = new URL(rawUrl)
          if (!/^https?:$/.test(parsed.protocol)) {
            errors.push({ field: 'url', message: 'URL doit être http(s)' })
          } else {
            url = rawUrl
          }
        } catch {
          errors.push({ field: 'url', message: 'URL invalide' })
        }
      }
    } else if (type === 'pubmed') {
      const rawTerm = typeof body.term === 'string' ? body.term.trim() : ''
      if (!rawTerm) {
        errors.push({ field: 'term', message: 'Requête MeSH requise' })
      } else {
        term = rawTerm
      }
      const rawReldate = body.reldate
      if (rawReldate == null || rawReldate === '') {
        reldate = 14
      } else {
        const parsed =
          typeof rawReldate === 'number' ? rawReldate : parseInt(String(rawReldate), 10)
        if (!Number.isFinite(parsed) || parsed <= 0) {
          errors.push({ field: 'reldate', message: 'reldate doit être un entier positif' })
        } else {
          reldate = parsed
        }
      }
    }

    const notes =
      typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation échouée', details: errors },
        { status: 400 }
      )
    }

    const admin = createAdminClient()

    // Unicité du nom (CONSTRAINT news_sources_name_uniq).
    const { data: existing, error: dupError } = await admin
      .from('news_sources')
      .select('id')
      .eq('name', name)
      .maybeSingle()
    if (dupError) {
      console.error('Erreur SELECT name:', dupError)
      return NextResponse.json({ error: dupError.message }, { status: 500 })
    }
    if (existing) {
      return NextResponse.json(
        { error: 'Une source avec ce nom existe déjà' },
        { status: 409 }
      )
    }

    // Validation pré-INSERT (warning non bloquant si force=false).
    const force = body.force === true
    if (!force) {
      if (type === 'rss' && url) {
        const test = await testRssFeed(url)
        if (!test.ok || test.articles_found === 0) {
          return NextResponse.json(
            {
              warning:
                test.error ||
                'Aucun article détecté dans le flux RSS. Vérifiez l\'URL ou forcez la création.',
              articles_found: test.articles_found,
            },
            { status: 422 }
          )
        }
      } else if (type === 'pubmed' && term) {
        const test = await testPubmedQuery(term, {
          retmax: 1,
          reldate: PUBMED_VALIDATION_RELDATE,
        })
        if (!test.ok || test.articles_found === 0) {
          return NextResponse.json(
            {
              warning:
                test.error ||
                `Aucun article PubMed sur ${PUBMED_VALIDATION_RELDATE} jours. Vérifiez le terme MeSH ou forcez la création.`,
              articles_found: test.articles_found,
            },
            { status: 422 }
          )
        }
      }
    }

    // Construction de la ligne. La colonne query stocke la config typée.
    const queryPayload =
      type === 'rss'
        ? { feed_url: url, format: 'rss2' }
        : { term, reldate: reldate ?? 14 }

    const insertPayload = {
      name,
      type,
      url: type === 'rss' ? url : null,
      query: queryPayload,
      spe_tags: [] as string[],
      active: true,
      notes,
    }

    const { data: inserted, error: insertError } = await admin
      .from('news_sources')
      .insert(insertPayload)
      .select('id')
      .single()

    if (insertError) {
      console.error('Erreur INSERT news_sources:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: inserted.id }, { status: 201 })
  } catch (error: any) {
    console.error('Erreur API admin/news/sources POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
