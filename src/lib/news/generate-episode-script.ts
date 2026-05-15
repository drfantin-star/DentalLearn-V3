import type { SupabaseClient } from '@supabase/supabase-js'
import {
  buildJournalPrompt,
  type EditorialTone,
  type JournalSynthesis,
  type ScriptFormat,
  type ScriptNarrator,
} from '@/lib/news-audio'

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_MAX_TOKENS = 4096
const ANTHROPIC_TIMEOUT_MS = 90_000
const ANTHROPIC_MAX_RETRIES = 2

export interface GenerateEpisodeScriptOptions {
  episodeId: string
  episodeType: 'journal' | 'insight'
  format: ScriptFormat
  narrator: ScriptNarrator | null
  targetDurationMin: number
  editorialTone: EditorialTone
  editorialNotes?: string
  /** Pour journaux : IDs des synthèses liées (dans l'ordre de position). Si absent, récupérés via news_episode_syntheses. */
  synthesesIds?: string[]
}

export interface GenerateEpisodeScriptResult {
  scriptMd: string
  scriptWithTags: string
}

/**
 * Génère le script d'un épisode journal via Claude claude-sonnet-4-6.
 *
 * Ne fait aucun UPDATE news_episodes — responsabilité du caller.
 * Scope actuel : episodeType='journal' uniquement (insight script = buildScriptPrompt,
 * logique spécifique à la synthèse source, gérée dans son propre endpoint).
 */
export async function generateEpisodeScript(
  supabase: SupabaseClient,
  opts: GenerateEpisodeScriptOptions,
): Promise<GenerateEpisodeScriptResult> {
  if (opts.episodeType !== 'journal') {
    throw new Error(
      'generateEpisodeScript : seul episodeType=journal est supporté (insight = endpoint dédié)',
    )
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('Clé API Anthropic manquante côté serveur')
  }

  // ----- 1. Fetch synthèses -----
  const syntheses = await fetchJournalSyntheses(
    supabase,
    opts.episodeId,
    opts.synthesesIds,
  )

  if (syntheses.length === 0) {
    throw new Error('Aucune synthèse liée à cet épisode journal')
  }

  // ----- 2. Prompt -----
  const systemPrompt = buildJournalPrompt(
    syntheses,
    opts.editorialNotes,
    {
      format: opts.format,
      narrator: opts.narrator,
      target_duration_min: opts.targetDurationMin,
      editorial_tone: opts.editorialTone,
    },
  )

  // ----- 3. Appel Claude -----
  const nArticles = syntheses.length
  const userMessage =
    opts.format === 'dialogue'
      ? `Génère le script complet du Journal de la semaine dentaire (${nArticles} articles) ` +
        `au format dialogue strict Sophie:/Martin: ligne par ligne. Aucune introduction ` +
        `hors format. Commence directement par "Sophie: ..." (intro qui annonce les ` +
        `${nArticles} thèmes du jour).`
      : `Génère le script complet du Journal de la semaine dentaire (${nArticles} articles) ` +
        `en monologue strict ${opts.narrator === 'sophie' ? 'Sophie' : 'Martin'}: ligne par ligne. ` +
        `Aucune introduction hors format. Commence directement par ` +
        `"${opts.narrator === 'sophie' ? 'Sophie' : 'Martin'}: ..." (intro qui annonce les ` +
        `${nArticles} thèmes du jour).`

  const scriptMd = await callAnthropic(apiKey, systemPrompt, userMessage)

  return { scriptMd, scriptWithTags: scriptMd }
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

async function fetchJournalSyntheses(
  supabase: SupabaseClient,
  episodeId: string,
  synthesesIds?: string[],
): Promise<JournalSynthesis[]> {
  let idsWithPositions: Array<{ synthesis_id: string; position: number }>

  if (synthesesIds && synthesesIds.length > 0) {
    idsWithPositions = synthesesIds.map((id, idx) => ({
      synthesis_id: id,
      position: idx + 1,
    }))
  } else {
    const { data: links, error } = await supabase
      .from('news_episode_syntheses')
      .select('synthesis_id, position')
      .eq('episode_id', episodeId)
      .order('position', { ascending: true })
    if (error) throw error
    const typedLinks = (links ?? []) as Array<{ synthesis_id: unknown; position: unknown }>
    idsWithPositions = typedLinks.map((l) => ({
      synthesis_id: l.synthesis_id as string,
      position: l.position as number,
    }))
  }

  if (idsWithPositions.length === 0) return []

  const ids = idsWithPositions.map((r) => r.synthesis_id)
  const { data: synRows, error: synErr } = await supabase
    .from('news_syntheses')
    .select(
      'id, display_title, summary_fr, clinical_impact, key_figures, evidence_level, specialite',
    )
    .in('id', ids)
  if (synErr) throw synErr

  const synById = new Map<string, Record<string, unknown>>()
  for (const s of synRows ?? []) {
    synById.set((s as { id: string }).id, s as Record<string, unknown>)
  }

  return idsWithPositions.flatMap(({ synthesis_id, position }) => {
    const row = synById.get(synthesis_id)
    if (!row) return []
    return [{
      position,
      display_title: (row.display_title as string) ?? '',
      summary_fr: (row.summary_fr as string) ?? '',
      clinical_impact: (row.clinical_impact as string | null) ?? null,
      key_figures: (row.key_figures as string[] | string | null) ?? null,
      evidence_level: (row.evidence_level as string | null) ?? null,
      specialite: (row.specialite as string | null) ?? null,
    }]
  })
}

interface AnthropicTextBlock {
  type: 'text'
  text: string
}

interface AnthropicResponse {
  content: AnthropicTextBlock[]
}

async function callAnthropic(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
): Promise<string> {
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

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Anthropic HTTP ${res.status}`)
        attempt++
        if (attempt <= ANTHROPIC_MAX_RETRIES) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000))
          continue
        }
        throw lastErr
      }

      const errBody = await res.json().catch(() => ({}))
      throw new Error(
        (errBody as { error?: { message?: string } }).error?.message ??
          `Anthropic HTTP ${res.status}`,
      )
    } catch (err) {
      clearTimeout(timer)
      if (attempt < ANTHROPIC_MAX_RETRIES && (err as { name?: string }).name !== 'AbortError') {
        lastErr = err
        attempt++
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt - 1) * 1000))
        continue
      }
      throw err
    }
  }
  throw lastErr ?? new Error('Échec appel Anthropic (retries épuisées)')
}
