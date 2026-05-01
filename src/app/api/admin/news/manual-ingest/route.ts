import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NEWS_SPECIALITES_SET } from '@/lib/constants/news'

const ADMIN_EMAIL = 'drfantin@gmail.com'

const DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+$/
const TITLE_MIN = 5
const TITLE_MAX = 300

interface ValidationError {
  field: string
  message: string
}

// POST: ingestion ad hoc d'un article via le panneau admin.
// Insertion dans news_raw uniquement (pas de chaînage score/synthesize en
// 6a — réservé 6b). Source 'manual' utilisée systématiquement.
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
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
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    const errors: ValidationError[] = []

    // url (required)
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    if (!url) {
      errors.push({ field: 'url', message: 'URL requise' })
    } else {
      try {
        const parsed = new URL(url)
        if (!/^https?:$/.test(parsed.protocol)) {
          errors.push({ field: 'url', message: 'URL doit être http(s)' })
        }
      } catch {
        errors.push({ field: 'url', message: 'URL invalide' })
      }
    }

    // doi (optional)
    const doiRaw = typeof body.doi === 'string' ? body.doi.trim() : ''
    const doi = doiRaw || null
    if (doi && !DOI_REGEX.test(doi)) {
      errors.push({ field: 'doi', message: 'Format DOI invalide (attendu : 10.xxxx/yyyy)' })
    }

    // title (required)
    const title = typeof body.title === 'string' ? body.title.trim() : ''
    if (!title) {
      errors.push({ field: 'title', message: 'Titre requis' })
    } else if (title.length < TITLE_MIN || title.length > TITLE_MAX) {
      errors.push({
        field: 'title',
        message: `Titre doit contenir entre ${TITLE_MIN} et ${TITLE_MAX} caractères`,
      })
    }

    // journal / abstract (optional strings)
    const journal = typeof body.journal === 'string' && body.journal.trim()
      ? body.journal.trim()
      : null
    const abstract = typeof body.abstract === 'string' && body.abstract.trim()
      ? body.abstract.trim()
      : null

    // authors : on accepte string ("Dupont J, Martin P") OU array
    let authors: string[] | null = null
    if (Array.isArray(body.authors)) {
      const cleaned: string[] = body.authors
        .map((a: unknown) => (typeof a === 'string' ? a.trim() : ''))
        .filter((s: string) => s.length > 0)
      authors = cleaned.length > 0 ? cleaned : null
    } else if (typeof body.authors === 'string' && body.authors.trim()) {
      const cleaned: string[] = body.authors
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0)
      authors = cleaned.length > 0 ? cleaned : null
    }

    // published_at (optional, YYYY-MM-DD ou ISO datetime)
    let published_at: string | null = null
    if (typeof body.published_at === 'string' && body.published_at.trim()) {
      const parsed = new Date(body.published_at)
      if (Number.isNaN(parsed.getTime())) {
        errors.push({ field: 'published_at', message: 'Date invalide' })
      } else {
        // Format date PG : YYYY-MM-DD
        published_at = parsed.toISOString().split('T')[0]
      }
    }

    // spe_tags (optional array, doit appartenir à la taxonomy)
    const spe_tags: string[] = []
    if (Array.isArray(body.spe_tags)) {
      const invalid: string[] = []
      for (const tag of body.spe_tags) {
        if (typeof tag !== 'string') continue
        if (!NEWS_SPECIALITES_SET.has(tag)) {
          invalid.push(tag)
        } else if (!spe_tags.includes(tag)) {
          spe_tags.push(tag)
        }
      }
      if (invalid.length > 0) {
        errors.push({
          field: 'spe_tags',
          message: `Spécialités hors taxonomy : ${invalid.join(', ')}`,
        })
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation échouée', details: errors },
        { status: 400 }
      )
    }

    const adminSupabase = createAdminClient()

    // Source manuelle (créée par la migration 20260501).
    const { data: manualSource, error: sourceError } = await adminSupabase
      .from('news_sources')
      .select('id')
      .eq('type', 'manual')
      .single()

    if (sourceError || !manualSource) {
      console.error('Source manuelle introuvable:', sourceError)
      return NextResponse.json(
        {
          error:
            'Source manuelle non configurée, contacter l\'équipe technique',
        },
        { status: 500 }
      )
    }

    // Détection doublon : DOI > URL.
    const dedupColumn = doi ? 'doi' : 'url'
    const dedupValue = doi ?? url
    const { data: existing, error: dedupError } = await adminSupabase
      .from('news_raw')
      .select('id')
      .eq(dedupColumn, dedupValue)
      .limit(1)
      .maybeSingle()

    if (dedupError) {
      console.error('Erreur vérif doublon news_raw:', dedupError)
      return NextResponse.json({ error: dedupError.message }, { status: 500 })
    }

    if (existing) {
      // Cherche aussi une synthèse pour proposer un lien direct côté UI.
      const { data: synthesis } = await adminSupabase
        .from('news_syntheses')
        .select('id')
        .eq('raw_id', existing.id)
        .maybeSingle()

      return NextResponse.json(
        {
          error: 'Article déjà ingéré',
          existing_raw_id: existing.id,
          existing_synthesis_id: synthesis?.id ?? null,
        },
        { status: 409 }
      )
    }

    const externalId = doi ?? `manual-${randomUUID()}`

    const insertPayload = {
      source_id: manualSource.id,
      external_id: externalId,
      url,
      title,
      journal,
      authors,
      published_at,
      abstract,
      doi,
      raw_payload: {
        manual: true,
        added_by: session.user.email,
        spe_tags,
        submitted_at: new Date().toISOString(),
      },
    }

    const { data: inserted, error: insertError } = await adminSupabase
      .from('news_raw')
      .insert(insertPayload)
      .select('id')
      .single()

    if (insertError) {
      console.error('Erreur INSERT news_raw manuel:', insertError)
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }

    // Chaînage fire-and-forget vers score_articles. Cas C (cf brief commit
    // 6b) : les Edge Functions n'acceptent pas de param raw_id ciblé. On
    // envoie limit=50 pour absorber un éventuel backlog + notre article.
    // La 2e étape (synthesize_articles) sera déclenchée par la page de
    // résultat quand elle détectera l'état "scored éligible mais pas de
    // synthèse" — voir trigger-synth/route.ts.
    triggerScoreArticles(inserted.id)

    return NextResponse.json(
      { success: true, raw_id: inserted.id },
      { status: 201 }
    )

  } catch (error) {
    console.error('Erreur API admin/news/manual-ingest POST:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function triggerScoreArticles(rawId: string): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceKey) {
    console.error('Trigger score_articles : variables Supabase manquantes')
    return
  }
  // Pas de await — on n'attend pas. .catch() seulement pour logger.
  fetch(`${supabaseUrl}/functions/v1/score_articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({ limit: 50 }),
  }).catch((err) => {
    console.error('Trigger score_articles a échoué:', err, 'raw_id:', rawId)
  })
}
