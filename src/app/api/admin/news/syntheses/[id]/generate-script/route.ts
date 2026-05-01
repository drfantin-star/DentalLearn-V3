import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildScriptPrompt,
  calcTargetWords,
  validateScriptFormat,
  type EditorialTone,
  type ScriptFormat,
  type ScriptNarrator,
} from '@/lib/news-audio'

const ADMIN_EMAIL = 'drfantin@gmail.com'

const ALLOWED_FORMATS: readonly ScriptFormat[] = ['dialogue', 'monologue']
const ALLOWED_NARRATORS: readonly ScriptNarrator[] = ['sophie', 'martin']
const ALLOWED_DURATIONS = new Set([3, 5, 8, 12])
const ALLOWED_TONES: readonly EditorialTone[] = [
  'standard',
  'flash_urgence',
  'pedagogique',
  'focus_specialite',
]

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_MAX_TOKENS = 4096
const ANTHROPIC_TIMEOUT_MS = 90_000
const ANTHROPIC_MAX_RETRIES = 2

// POST: génère un script Sonnet pour une synthèse News.
// Auth admin → fetch synthèse + raw → archivage de l'épisode existant si
// présent → appel Anthropic → validation format → INSERT news_episodes +
// news_episode_items.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: synthesisId } = await params

    // ----- 1. Auth admin -----
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // ----- 2. Body validation -----
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    const format = body.format
    if (!ALLOWED_FORMATS.includes(format)) {
      return NextResponse.json(
        { error: `format invalide (attendu : ${ALLOWED_FORMATS.join(', ')})` },
        { status: 400 },
      )
    }

    const target_duration_min = body.target_duration_min
    if (
      typeof target_duration_min !== 'number' ||
      !ALLOWED_DURATIONS.has(target_duration_min)
    ) {
      return NextResponse.json(
        { error: 'target_duration_min invalide (attendu : 3, 5, 8 ou 12)' },
        { status: 400 },
      )
    }

    const editorial_tone = body.editorial_tone
    if (!ALLOWED_TONES.includes(editorial_tone)) {
      return NextResponse.json(
        { error: `editorial_tone invalide (attendu : ${ALLOWED_TONES.join(', ')})` },
        { status: 400 },
      )
    }

    let narrator: ScriptNarrator | null = null
    if (format === 'monologue') {
      if (!ALLOWED_NARRATORS.includes(body.narrator)) {
        return NextResponse.json(
          { error: 'narrator requis pour format=monologue (sophie ou martin)' },
          { status: 400 },
        )
      }
      narrator = body.narrator
    } else if (body.narrator != null) {
      // En dialogue, narrator doit être null/absent (CHECK XOR BDD).
      return NextResponse.json(
        { error: 'narrator doit être absent pour format=dialogue' },
        { status: 400 },
      )
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Clé API Anthropic manquante côté serveur' },
        { status: 503 },
      )
    }

    const adminSupabase = createAdminClient()

    // ----- 3. Fetch synthèse + raw -----
    const { data: synthesis, error: synthError } = await adminSupabase
      .from('news_syntheses')
      .select(
        'id, raw_id, scored_id, status, display_title, summary_fr, themes, niveau_preuve, category_editorial, formation_category_match',
      )
      .eq('id', synthesisId)
      .eq('status', 'active')
      .maybeSingle()

    if (synthError) {
      console.error('Erreur lecture synthèse:', synthError)
      return NextResponse.json({ error: synthError.message }, { status: 500 })
    }
    if (!synthesis) {
      return NextResponse.json(
        { error: 'Synthèse introuvable ou inactive' },
        { status: 404 },
      )
    }

    const { data: raw, error: rawError } = await adminSupabase
      .from('news_raw')
      .select('title, authors, journal, published_at')
      .eq('id', synthesis.raw_id)
      .maybeSingle()

    if (rawError) {
      console.error('Erreur lecture news_raw:', rawError)
      return NextResponse.json({ error: rawError.message }, { status: 500 })
    }
    if (!raw) {
      return NextResponse.json(
        { error: 'Article source introuvable' },
        { status: 404 },
      )
    }

    const sourceAuthors = Array.isArray(raw.authors) && raw.authors.length > 0
      ? raw.authors.join(', ')
      : 'auteurs non renseignés'
    const sourceYear = raw.published_at
      ? new Date(raw.published_at as string).getUTCFullYear()
      : new Date().getUTCFullYear()
    const sourceTitle = raw.journal
      ? `${raw.title} (${raw.journal})`
      : raw.title

    // ----- 4. Archivage épisode existant (si présent) -----
    // On cherche l'épisode courant via news_episode_items (1 item par
    // synthèse côté insight). S'il en existe plusieurs (régénérations
    // antérieures), on n'archive que ceux qui ne le sont pas déjà.
    const { data: existingItems, error: itemsError } = await adminSupabase
      .from('news_episode_items')
      .select('episode_id')
      .eq('synthesis_id', synthesisId)

    if (itemsError) {
      console.error('Erreur lecture episode_items:', itemsError)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    if (existingItems && existingItems.length > 0) {
      const episodeIds = Array.from(
        new Set(existingItems.map((it: { episode_id: string }) => it.episode_id)),
      )
      const { error: archiveError } = await adminSupabase
        .from('news_episodes')
        .update({ status: 'archived' })
        .in('id', episodeIds)
        .neq('status', 'archived')

      if (archiveError) {
        console.error('Erreur archivage épisodes existants:', archiveError)
        return NextResponse.json(
          { error: archiveError.message },
          { status: 500 },
        )
      }
    }

    // ----- 5. Appel Anthropic (fetch direct, pattern _shared/anthropic.ts) -----
    const systemPrompt = buildScriptPrompt({
      display_title: synthesis.display_title ?? 'Sans titre',
      summary_fr: synthesis.summary_fr ?? '',
      specialites_tags: Array.isArray(synthesis.themes) ? synthesis.themes : [],
      niveau_preuve: synthesis.niveau_preuve ?? 'non précisé',
      source_title: sourceTitle ?? 'titre inconnu',
      source_authors: sourceAuthors,
      source_year: sourceYear,
      format,
      narrator,
      target_duration_min,
      editorial_tone,
    })

    let scriptMd: string
    try {
      scriptMd = await callAnthropic(systemPrompt, target_duration_min, format, narrator)
    } catch (err) {
      console.error('Échec appel Anthropic:', err)
      return NextResponse.json(
        {
          error: err instanceof Error
            ? err.message
            : 'Échec de la génération du script',
        },
        { status: 502 },
      )
    }

    // ----- 6. Validation format -----
    const validation = validateScriptFormat(
      scriptMd,
      format,
      narrator ?? undefined,
    )
    if (!validation.valid) {
      return NextResponse.json(
        {
          error: 'Script généré non conforme au format attendu',
          validation_errors: validation.errors,
        },
        { status: 422 },
      )
    }

    // ----- 7. INSERT news_episodes -----
    const wordCount = countWords(scriptMd)
    const estimatedDurationMin = wordCount > 0 ? wordCount / 150 : 0

    const { data: episode, error: insertError } = await adminSupabase
      .from('news_episodes')
      .insert({
        type: 'insight',
        title: synthesis.display_title ?? 'Sans titre',
        script_md: scriptMd,
        format,
        narrator,
        target_duration_min,
        editorial_tone,
        status: 'draft',
        week_iso: getCurrentIsoWeek(),
      })
      .select('id')
      .single()

    if (insertError || !episode) {
      console.error('Erreur INSERT news_episodes:', insertError)
      return NextResponse.json(
        { error: insertError?.message ?? 'Erreur création épisode' },
        { status: 500 },
      )
    }

    // ----- 8. INSERT news_episode_items -----
    const { error: linkError } = await adminSupabase
      .from('news_episode_items')
      .insert({
        episode_id: episode.id,
        synthesis_id: synthesisId,
        order_idx: 0,
      })

    if (linkError) {
      console.error('Erreur INSERT news_episode_items:', linkError)
      // L'épisode est créé mais orphelin — on retourne quand même 500 pour
      // alerter l'admin, qui pourra rejouer (l'archivage des doublons est
      // idempotent côté étape 4).
      return NextResponse.json(
        { error: linkError.message, episode_id: episode.id },
        { status: 500 },
      )
    }

    // ----- 9. Réponse -----
    return NextResponse.json({
      episode_id: episode.id,
      script_md: scriptMd,
      word_count: wordCount,
      estimated_duration_min: Number(estimatedDurationMin.toFixed(2)),
    })
  } catch (error) {
    console.error('Erreur API admin/news/syntheses/[id]/generate-script:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AnthropicTextBlock {
  type: 'text'
  text: string
}

interface AnthropicResponse {
  content: AnthropicTextBlock[]
}

async function callAnthropic(
  systemPrompt: string,
  target_duration_min: number,
  format: ScriptFormat,
  narrator: ScriptNarrator | null,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!
  const targetWords = calcTargetWords(target_duration_min)

  const userMessage = format === 'dialogue'
    ? `Génère le script complet (~${targetWords} mots ± 10%) au format Sophie:/Martin: ligne par ligne. Aucune introduction hors format. Commence directement par "Sophie: ..." ou "Martin: ...".`
    : `Génère le script complet (~${targetWords} mots ± 10%) au format ${narrator === 'sophie' ? 'Sophie' : 'Martin'}: ligne par ligne. Aucune introduction hors format. Commence directement par "${narrator === 'sophie' ? 'Sophie' : 'Martin'}: ...".`

  const body = JSON.stringify({
    model: ANTHROPIC_MODEL,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  })

  let attempt = 0
  let lastErr: unknown
  while (attempt <= ANTHROPIC_MAX_RETRIES) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), ANTHROPIC_TIMEOUT_MS)
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body,
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      if (res.ok) {
        const json = (await res.json()) as AnthropicResponse
        return json.content
          .filter((b): b is AnthropicTextBlock => b.type === 'text')
          .map((b) => b.text)
          .join('')
      }

      const errText = await res.text().catch(() => '(no body)')
      if ((res.status === 429 || res.status >= 500) && attempt < ANTHROPIC_MAX_RETRIES) {
        lastErr = new Error(`Anthropic ${res.status}: ${errText.slice(0, 300)}`)
        await sleep(1000 * Math.pow(2, attempt))
        attempt++
        continue
      }
      throw new Error(`Anthropic ${res.status}: ${errText.slice(0, 300)}`)
    } catch (e) {
      clearTimeout(timer)
      if (e instanceof DOMException && e.name === 'AbortError') {
        lastErr = new Error(`Anthropic timeout after ${ANTHROPIC_TIMEOUT_MS}ms`)
        if (attempt < ANTHROPIC_MAX_RETRIES) {
          await sleep(1000 * Math.pow(2, attempt))
          attempt++
          continue
        }
        throw lastErr
      }
      throw e
    }
  }
  throw lastErr ?? new Error('Anthropic: retries épuisés')
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter((w) => w.length > 0).length
}

// ISO 8601 week (e.g. "2026-W18"). Calcul standard sans dépendance.
function getCurrentIsoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ))
  // Décalage au jeudi de la semaine ISO en cours.
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  )
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
