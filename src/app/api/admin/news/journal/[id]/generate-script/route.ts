import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildJournalPrompt,
  type EditorialTone,
  type JournalSynthesis,
  type ScriptFormat,
  type ScriptNarrator,
} from '@/lib/news-audio'

export const dynamic = 'force-dynamic'

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_MAX_TOKENS = 4096
const ANTHROPIC_TIMEOUT_MS = 90_000
const ANTHROPIC_MAX_RETRIES = 2

// Mêmes contraintes UI/BDD que /api/admin/news/syntheses/[id]/generate-script
// (cf. T7-bis). Permet à l'admin de choisir format/durée/ton pour le journal.
const ALLOWED_FORMATS: readonly ScriptFormat[] = ['dialogue', 'monologue']
const ALLOWED_NARRATORS: readonly ScriptNarrator[] = ['sophie', 'martin']
const ALLOWED_DURATIONS = new Set([3, 5, 8, 12])
const ALLOWED_TONES: readonly EditorialTone[] = [
  'standard',
  'flash_urgence',
  'pedagogique',
  'focus_specialite',
]

// Buffer Vercel : la génération Sonnet d'un script journal (1200-1800 mots)
// peut prendre jusqu'à 60s. On laisse 5min comme pour generate-audio.
export const maxDuration = 300

// POST — génère le script unifié du journal via Claude Sonnet à partir des
// synthèses liées (3 à 6, dans l'ordre de news_episode_syntheses.position).
// Body : { editorial_notes?: string }
// Pré-checks : journal en status 'draft' (un journal published/archived ne se
// régénère pas — il faut en créer un nouveau).

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'id manquant' }, { status: 400 })
    }

    let body: any = {}
    try {
      body = await request.json()
    } catch {
      // body optionnel
    }
    const editorialNotes =
      typeof body?.editorial_notes === 'string' && body.editorial_notes.trim().length > 0
        ? body.editorial_notes.trim()
        : undefined

    // ----- Validation paramètres T7-bis (alignés sur le formulaire admin) -----
    const format: ScriptFormat = ALLOWED_FORMATS.includes(body?.format)
      ? body.format
      : 'dialogue'

    let narrator: ScriptNarrator | null = null
    if (format === 'monologue') {
      if (!ALLOWED_NARRATORS.includes(body?.narrator)) {
        return NextResponse.json(
          { error: 'narrator requis pour format=monologue (sophie ou martin)' },
          { status: 400 },
        )
      }
      narrator = body.narrator as ScriptNarrator
    } else if (body?.narrator != null) {
      // Le CHECK XOR de news_episodes interdit narrator non-NULL en dialogue.
      return NextResponse.json(
        { error: 'narrator doit être absent pour format=dialogue' },
        { status: 400 },
      )
    }

    const targetDurationMin =
      typeof body?.target_duration_min === 'number' &&
      ALLOWED_DURATIONS.has(body.target_duration_min)
        ? (body.target_duration_min as number)
        : 12

    const editorialTone: EditorialTone = ALLOWED_TONES.includes(body?.editorial_tone)
      ? body.editorial_tone
      : 'standard'

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { error: 'Clé API Anthropic manquante côté serveur' },
        { status: 503 },
      )
    }

    const adminSupabase = createAdminClient()

    // ----- 1. Vérifier journal + statut -----
    const { data: episode, error: epErr } = await adminSupabase
      .from('news_episodes')
      .select('id, type, status, week_iso')
      .eq('id', id)
      .eq('type', 'journal')
      .maybeSingle()

    if (epErr) {
      console.error('generate-script journal episode error:', epErr)
      return NextResponse.json({ error: epErr.message }, { status: 500 })
    }
    if (!episode) {
      return NextResponse.json({ error: 'Journal introuvable' }, { status: 404 })
    }
    if (episode.status !== 'draft') {
      return NextResponse.json(
        {
          error:
            'Génération du script autorisée uniquement sur un journal en draft',
        },
        { status: 409 },
      )
    }

    // ----- 2. Récupérer les synthèses liées -----
    const { data: links, error: linksErr } = await adminSupabase
      .from('news_episode_syntheses')
      .select('synthesis_id, position')
      .eq('episode_id', id)
      .order('position', { ascending: true })

    if (linksErr) {
      console.error('generate-script journal links error:', linksErr)
      return NextResponse.json({ error: linksErr.message }, { status: 500 })
    }
    if (!links || links.length === 0) {
      return NextResponse.json(
        { error: 'Aucune synthèse liée à ce journal' },
        { status: 422 },
      )
    }

    const synIds = links.map((l) => l.synthesis_id as string)
    const { data: synRows, error: synErr } = await adminSupabase
      .from('news_syntheses')
      .select(
        'id, display_title, summary_fr, clinical_impact, key_figures, evidence_level, specialite',
      )
      .in('id', synIds)

    if (synErr) {
      console.error('generate-script journal syntheses error:', synErr)
      return NextResponse.json({ error: synErr.message }, { status: 500 })
    }

    const synById = new Map<string, any>()
    for (const s of synRows ?? []) {
      synById.set((s as { id: string }).id, s)
    }

    const journalSyntheses: JournalSynthesis[] = links
      .map((l): JournalSynthesis | null => {
        const s = synById.get(l.synthesis_id as string)
        if (!s) return null
        return {
          position: l.position as number,
          display_title: s.display_title ?? 'Sans titre',
          summary_fr: s.summary_fr ?? '',
          clinical_impact: s.clinical_impact ?? null,
          key_figures: Array.isArray(s.key_figures) ? s.key_figures : null,
          evidence_level: s.evidence_level ?? null,
          specialite: s.specialite ?? null,
        }
      })
      .filter((x): x is JournalSynthesis => x !== null)

    if (journalSyntheses.length === 0) {
      return NextResponse.json(
        { error: 'Synthèses liées introuvables' },
        { status: 404 },
      )
    }

    // ----- 3. Appel Anthropic -----
    const systemPrompt = buildJournalPrompt(journalSyntheses, editorialNotes, {
      format,
      narrator,
      target_duration_min: targetDurationMin,
      editorial_tone: editorialTone,
    })

    let scriptMd: string
    try {
      scriptMd = await callAnthropic(
        systemPrompt,
        journalSyntheses.length,
        format,
        narrator,
      )
    } catch (err) {
      console.error('Échec appel Anthropic (journal):', err)
      return NextResponse.json(
        {
          error:
            err instanceof Error ? err.message : 'Échec de la génération du script',
        },
        { status: 502 },
      )
    }

    // ----- 4. UPDATE script_md + paramètres choisis -----
    // Le CHECK XOR news_episodes_format_narrator_check exige
    // (format='dialogue' AND narrator IS NULL) OR (format='monologue' AND narrator IS NOT NULL).
    // L'objet construit ci-dessous respecte la contrainte.
    const { error: updErr } = await adminSupabase
      .from('news_episodes')
      .update({
        script_md: scriptMd,
        format,
        narrator,
        target_duration_min: targetDurationMin,
        editorial_tone: editorialTone,
      })
      .eq('id', id)

    if (updErr) {
      console.error('generate-script journal update error:', updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({
      script_md: scriptMd,
      word_count: countWords(scriptMd),
      format,
      narrator,
      target_duration_min: targetDurationMin,
      editorial_tone: editorialTone,
    })
  } catch (err) {
    console.error('POST generate-script journal error:', err)
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
  nArticles: number,
  format: ScriptFormat,
  narrator: ScriptNarrator | null,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY!

  const userMessage = format === 'dialogue'
    ? `Génère le script complet du Journal de la semaine dentaire (${nArticles} articles) ` +
      `au format dialogue strict Sophie:/Martin: ligne par ligne. Aucune introduction ` +
      `hors format. Commence directement par "Sophie: ..." (intro qui annonce les ` +
      `${nArticles} thèmes du jour).`
    : `Génère le script complet du Journal de la semaine dentaire (${nArticles} articles) ` +
      `en monologue strict ${narrator === 'sophie' ? 'Sophie' : 'Martin'}: ligne par ligne. ` +
      `Aucune introduction hors format. Commence directement par ` +
      `"${narrator === 'sophie' ? 'Sophie' : 'Martin'}: ..." (intro qui annonce les ` +
      `${nArticles} thèmes du jour).`

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
