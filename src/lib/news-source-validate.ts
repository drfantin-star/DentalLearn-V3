// Helpers de test des sources d'ingestion news (RSS + PubMed).
// Utilisés par :
//   - POST /api/admin/news/sources/[id]/test (Ticket 8 Phase 2 — B1)
//   - POST /api/admin/news/sources           (Ticket 8 Phase 2 — B2, validation pré-INSERT)
//
// Contraintes :
//   - timeout 10s par appel externe (AbortController)
//   - aucune dépendance NPM ajoutée : parse RSS minimaliste par regex, PubMed
//     en JSON natif via NCBI eSearch (retmode=json).
//   - retour homogène { ok, articles_found, error? } pour permettre une UX
//     cohérente côté admin (badge vert/rouge + count).

export interface SourceTestResult {
  ok: boolean
  articles_found: number
  error?: string
}

const DEFAULT_TIMEOUT_MS = 10_000
const NCBI_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

// ---------------------------------------------------------------------------
// RSS
// ---------------------------------------------------------------------------

export async function testRssFeed(
  feedUrl: string,
  opts: { timeoutMs?: number } = {}
): Promise<SourceTestResult> {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (!feedUrl) {
    return { ok: false, articles_found: 0, error: 'feed_url manquant' }
  }
  try {
    new URL(feedUrl)
  } catch {
    return { ok: false, articles_found: 0, error: 'URL du flux invalide' }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(feedUrl, {
      method: 'GET',
      headers: {
        // User-Agent explicite : certains serveurs (rss.app, Cloudflare) servent
        // un 403 sans UA "navigateur".
        'User-Agent': 'DentalLearn-Admin-Test/1.0 (+https://dentallearn.com)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!res.ok) {
      return {
        ok: false,
        articles_found: 0,
        error: `HTTP ${res.status} ${res.statusText}`.trim(),
      }
    }

    const xml = await res.text()
    if (!xml || xml.trim().length === 0) {
      return { ok: false, articles_found: 0, error: 'Réponse vide' }
    }

    const itemCount = countFeedItems(xml)
    if (itemCount === 0) {
      return {
        ok: false,
        articles_found: 0,
        error: 'Aucun item RSS/Atom détecté dans la réponse',
      }
    }
    return { ok: true, articles_found: itemCount }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, articles_found: 0, error: `Timeout après ${timeoutMs}ms` }
    }
    return { ok: false, articles_found: 0, error: err?.message || 'Erreur réseau' }
  } finally {
    clearTimeout(timer)
  }
}

// Compte les <item> (RSS 2.0 / RSS 1.0) et <entry> (Atom). Regex case-insensitive,
// suffisante pour un test "le flux contient au moins X articles". On ne parse
// pas le contenu détaillé ici — c'est le rôle de l'Edge Function ingest_rss.
function countFeedItems(xml: string): number {
  const items = xml.match(/<item[\s>]/gi)?.length ?? 0
  const entries = xml.match(/<entry[\s>]/gi)?.length ?? 0
  return items + entries
}

// ---------------------------------------------------------------------------
// PubMed (NCBI eSearch)
// ---------------------------------------------------------------------------

export interface PubmedTestOptions {
  /** retmax envoyé à eSearch (défaut 1, suffit pour le test). */
  retmax?: number
  /** reldate (jours) — filtre Pubmed natif "Date Publication". */
  reldate?: number
  /** Timeout fetch (défaut 10s). */
  timeoutMs?: number
}

export async function testPubmedQuery(
  term: string,
  opts: PubmedTestOptions = {}
): Promise<SourceTestResult> {
  const retmax = opts.retmax ?? 1
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  if (!term || term.trim().length === 0) {
    return { ok: false, articles_found: 0, error: 'term MeSH manquant' }
  }

  const params = new URLSearchParams({
    db: 'pubmed',
    term: term.trim(),
    retmode: 'json',
    retmax: String(retmax),
  })
  if (opts.reldate && opts.reldate > 0) {
    params.set('reldate', String(opts.reldate))
    params.set('datetype', 'pdat')
  }

  const apiKey = process.env.NCBI_API_KEY
  if (apiKey) params.set('api_key', apiKey)
  const adminEmail = process.env.NCBI_EMAIL
  if (adminEmail) params.set('email', adminEmail)
  params.set('tool', 'dentallearn-admin-test')

  const url = `${NCBI_BASE}/esearch.fcgi?${params.toString()}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) {
      return {
        ok: false,
        articles_found: 0,
        error: `NCBI HTTP ${res.status} ${res.statusText}`.trim(),
      }
    }
    const json = (await res.json()) as {
      esearchresult?: { count?: string; idlist?: string[]; ERROR?: string }
    }
    const result = json.esearchresult
    if (result?.ERROR) {
      return { ok: false, articles_found: 0, error: result.ERROR }
    }
    const count = result?.count ? parseInt(result.count, 10) : 0
    if (Number.isNaN(count)) {
      return { ok: false, articles_found: 0, error: 'Réponse NCBI invalide' }
    }
    return { ok: count > 0, articles_found: count }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, articles_found: 0, error: `Timeout après ${timeoutMs}ms` }
    }
    return { ok: false, articles_found: 0, error: err?.message || 'Erreur réseau' }
  } finally {
    clearTimeout(timer)
  }
}
