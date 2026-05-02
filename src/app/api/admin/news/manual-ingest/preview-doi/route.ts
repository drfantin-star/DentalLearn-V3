import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'

const DOI_REGEX = /^10\.\d{4,9}\/[-._;()/:a-zA-Z0-9]+$/
const CROSSREF_TIMEOUT_MS = 5000
const USER_AGENT =
  'DentalLearn/1.0 (https://dentalschool.fr; mailto:contact@dentalschool.fr)'

// GET ?doi=10.xxxx/yyyy
// Renvoie les métadonnées Crossref mappées au format du formulaire admin.
// 400 = DOI invalide / 404 = inconnu / 503 = Crossref indisponible.
export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const doi = searchParams.get('doi')?.trim()

    if (!doi) {
      return NextResponse.json({ error: 'Paramètre doi requis' }, { status: 400 })
    }
    if (!DOI_REGEX.test(doi)) {
      return NextResponse.json(
        { error: 'Format DOI invalide (attendu : 10.xxxx/yyyy)' },
        { status: 400 }
      )
    }

    let res: Response
    try {
      res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
        signal: AbortSignal.timeout(CROSSREF_TIMEOUT_MS),
      })
    } catch (err) {
      console.error('Crossref fetch error:', err)
      return NextResponse.json(
        { error: 'Crossref indisponible, saisir manuellement' },
        { status: 503 }
      )
    }

    if (res.status === 404) {
      return NextResponse.json(
        { error: 'DOI introuvable sur Crossref' },
        { status: 404 }
      )
    }
    if (!res.ok) {
      console.error('Crossref non-OK:', res.status)
      return NextResponse.json(
        { error: `Crossref a renvoyé ${res.status}` },
        { status: 503 }
      )
    }

    const json = await res.json().catch(() => null)
    const message = json?.message
    if (!message || typeof message !== 'object') {
      return NextResponse.json(
        { error: 'Réponse Crossref inattendue' },
        { status: 503 }
      )
    }

    const metadata = {
      title: Array.isArray(message.title) ? message.title[0] ?? null : null,
      journal: Array.isArray(message['container-title'])
        ? message['container-title'][0] ?? null
        : null,
      authors: Array.isArray(message.author)
        ? message.author
            .map((a: any) => `${a?.given ?? ''} ${a?.family ?? ''}`.trim())
            .filter(Boolean)
            .join(', ') || null
        : null,
      published_at: extractCrossrefDate(message),
      abstract: cleanCrossrefAbstract(message.abstract),
      url: typeof message.URL === 'string' ? message.URL : `https://doi.org/${doi}`,
      doi,
    }

    return NextResponse.json({ source: 'crossref', metadata })

  } catch (error) {
    console.error('Erreur API admin/news/manual-ingest/preview-doi:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

function extractCrossrefDate(msg: any): string | null {
  const candidates = [
    msg['published-print'],
    msg['published-online'],
    msg.issued,
    msg.created,
  ]
  for (const c of candidates) {
    const parts = c?.['date-parts']?.[0]
    if (Array.isArray(parts) && parts.length > 0) {
      const [year, month = 1, day = 1] = parts
      const date = new Date(Date.UTC(year, month - 1, day))
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString().split('T')[0]
      }
    }
  }
  return null
}

function cleanCrossrefAbstract(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null
  return value
    .replace(/<jats:[^>]+>/g, '')
    .replace(/<\/jats:[^>]+>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim() || null
}
