// Appel Sonnet pour la regeneration d'une synthese news depuis le texte
// integral (route POST /api/admin/news/syntheses/[id]/regenerate).
//
// Pattern fortement inspire de src/lib/timeline/llm-extraction.ts (SDK officiel
// @anthropic-ai/sdk cote Node.js, boucle retry, AbortController, parse strict +
// recovery) et de la logique de retry sur tag_validation de l'Edge Function
// synthesize_articles/article_processor/sonnet_call.ts.
//
// Modele et parametres FIGES sur ceux de l'Edge Function (decision D4 / brief
// 4.4) : claude-sonnet-4-6, temperature 0, max_tokens 4096. A ne pas modifier
// sans alignement avec supabase/functions/synthesize_articles/types.ts.

import Anthropic from '@anthropic-ai/sdk'

import { parseStrictWithRecovery } from '../timeline/parse-json-recovery'
import { SYSTEM_PROMPT, buildFullTextUserPrompt, type FullTextArticle } from './regenerate-fulltext-prompt'
import {
  validateTags,
  validateAndFilterQuestions,
  truncateDisplayTitle,
  QUESTION_VALID_THRESHOLD,
  type NormalizedQuestion,
  type SonnetSynthesisOutput,
  type TaxonomyLists,
} from './regenerate-fulltext-validators'

// ---------------------------------------------------------------------------
// Constantes figees
// ---------------------------------------------------------------------------

/** Modele Sonnet fige (lecture exacte de
 *  supabase/functions/synthesize_articles/types.ts:18). */
export const SONNET_MODEL = 'claude-sonnet-4-6'

/** max_tokens output : 4096 suffit (la sortie ne grossit pas avec l'entree). */
export const SONNET_MAX_TOKENS = 4096

/** 1 essai + 2 retries sur tag_validation / json_parse / structure_check. */
export const MAX_RETRIES = 3

/** Timeout AbortController par appel. Route maxDuration=60s : on coupe a 45s
 *  pour laisser une marge sur l'embedding OpenAI + la RPC. */
export const SONNET_CALL_TIMEOUT_MS = 45_000

/** Cles top-level requises dans la sortie Sonnet avant de tenter validateTags. */
const REQUIRED_TOP_LEVEL_KEYS = [
  'summary_fr',
  'specialite',
  'themes',
  'niveau_preuve',
  'category_editorial',
  'display_title',
  'quiz',
] as const

// ---------------------------------------------------------------------------
// Types de retour
// ---------------------------------------------------------------------------

export interface RegenTokens {
  input: number
  output: number
}

export interface RegenSuccess {
  ok: true
  /** Output Sonnet validé (tags OK), display_title déjà tronqué à 70. */
  output: SonnetSynthesisOutput
  /** Questions valides normalisées (≥1). */
  questions: NormalizedQuestion[]
  tokens: RegenTokens
  attempts: number
}

export interface RegenFailure {
  ok: false
  stage: 'anthropic_call' | 'json_parse' | 'tag_validation' | 'no_valid_questions'
  errors: string[]
  tokens: RegenTokens
  attempts: number
}

export type RegenResult = RegenSuccess | RegenFailure

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkTopLevelStructure(parsed: unknown): { ok: boolean; reason?: string } {
  if (parsed === null || typeof parsed !== 'object') {
    return { ok: false, reason: `output is not an object (got ${parsed === null ? 'null' : typeof parsed})` }
  }
  if (Array.isArray(parsed)) {
    return { ok: false, reason: 'output is an array (expected object)' }
  }
  const obj = parsed as Record<string, unknown>
  const missing = REQUIRED_TOP_LEVEL_KEYS.filter((k) => !(k in obj))
  if (missing.length > 0) {
    return { ok: false, reason: `missing top-level keys: ${missing.join(', ')}` }
  }
  return { ok: true }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Appelle Sonnet jusqu'a MAX_RETRIES fois pour obtenir une synthese dont tous
 * les tags sont conformes a la taxonomy, puis valide/filtre les questions.
 *
 * En cas d'echec a toute etape : ne persiste RIEN (le caller garde la synthese
 * d'origine intacte). Tokens cumules sur tous les essais.
 */
export async function regenerateSynthesisFromFullText(
  article: FullTextArticle,
  lists: TaxonomyLists,
): Promise<RegenResult> {
  const tokens: RegenTokens = { input: 0, output: 0 }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      stage: 'anthropic_call',
      errors: ['Missing ANTHROPIC_API_KEY env var'],
      tokens,
      attempts: 0,
    }
  }

  const client = new Anthropic({ apiKey, maxRetries: 3 })
  const userPrompt = buildFullTextUserPrompt(article, lists)

  let lastFailure: { stage: RegenFailure['stage']; errors: string[] } | null = null
  let attemptsDone = 0

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    attemptsDone = attempt

    // ----- 1. Appel Anthropic (AbortController 45s) -----
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), SONNET_CALL_TIMEOUT_MS)
    let response: Anthropic.Message
    try {
      response = await client.messages.create(
        {
          model: SONNET_MODEL,
          max_tokens: SONNET_MAX_TOKENS,
          temperature: 0,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        },
        { signal: ctrl.signal },
      )
    } catch (e) {
      clearTimeout(timer)
      const isAbort =
        e instanceof Error &&
        (e.name === 'AbortError' || e.message.toLowerCase().includes('aborted'))
      const msg = isAbort
        ? `Anthropic call aborted after ${SONNET_CALL_TIMEOUT_MS}ms`
        : e instanceof Error
          ? e.message
          : String(e)
      // Pas de retry : le SDK retry deja 429/5xx en interne, un abort signifie
      // qu'on est trop proche du maxDuration route.
      return { ok: false, stage: 'anthropic_call', errors: [msg], tokens, attempts: attempt }
    }
    clearTimeout(timer)

    tokens.input += response.usage?.input_tokens ?? 0
    tokens.output += response.usage?.output_tokens ?? 0

    // ----- 2. Extraction texte -----
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')

    if (!text || !text.trim()) {
      lastFailure = { stage: 'json_parse', errors: ['empty response from Sonnet'] }
      if (attempt < MAX_RETRIES) continue
      break
    }

    // ----- 3. Parse JSON + recovery -----
    const parseRes = parseStrictWithRecovery(text)
    if (!parseRes.ok) {
      lastFailure = { stage: 'json_parse', errors: [parseRes.reason ?? 'JSON parse failed'] }
      if (attempt < MAX_RETRIES) continue
      break
    }

    // ----- 4. Structure top-level -----
    const struct = checkTopLevelStructure(parseRes.parsed)
    if (!struct.ok) {
      lastFailure = { stage: 'json_parse', errors: [struct.reason ?? 'structure check failed'] }
      if (attempt < MAX_RETRIES) continue
      break
    }

    const output = parseRes.parsed as SonnetSynthesisOutput

    // ----- 5. Validation tags -----
    const tagRes = validateTags(output, lists)
    if (!tagRes.ok) {
      lastFailure = { stage: 'tag_validation', errors: tagRes.errors }
      if (attempt < MAX_RETRIES) continue
      break
    }

    // ----- 6. Validation questions -----
    const filter = validateAndFilterQuestions(output.quiz)
    if (filter.valid.length < QUESTION_VALID_THRESHOLD) {
      const totalReceived = Array.isArray(output.quiz) ? output.quiz.length : 0
      // Pas de retry sur ce stage (aligne Edge : les questions invalides ne
      // relancent pas Sonnet). On echoue proprement sans rien persister.
      return {
        ok: false,
        stage: 'no_valid_questions',
        errors: [
          `${filter.valid.length} valid question(s) out of ${totalReceived}`,
          ...filter.warnings.slice(0, 5).map((w) => `q${w.question_index}: ${w.reason}`),
        ],
        tokens,
        attempts: attempt,
      }
    }

    // ----- Succes -----
    return {
      ok: true,
      output: { ...output, display_title: truncateDisplayTitle(output.display_title) },
      questions: filter.valid,
      tokens,
      attempts: attempt,
    }
  }

  // Boucle epuisee
  const fallback = lastFailure ?? { stage: 'json_parse' as const, errors: ['unknown failure'] }
  return { ok: false, stage: fallback.stage, errors: fallback.errors, tokens, attempts: attemptsDone }
}
