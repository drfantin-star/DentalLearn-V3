// Orchestration de l'extraction structurelle Sonnet pour les formations
// (POC visualisation audio §6 — T5.1).
//
// Pattern fortement inspiré de
// supabase/functions/synthesize_articles/article_processor/sonnet_call.ts
// (boucle retry + parse strict + recovery + structure check). Différences :
//   - Côté Node.js (route Next.js), pas Deno → SDK officiel @anthropic-ai/sdk
//   - Modèle figé sur DEFAULT_SONNET_MODEL = "claude-sonnet-4-6" (cf.
//     supabase/functions/synthesize_articles/types.ts:18, lecture exacte)
//   - AbortController 45s — coupe avant maxDuration=60s de la route POST.
//   - Stages distincts : 'anthropic_call' / 'json_parse' / 'structure_check'
//
// IMPORTANT : ce module produit un format BRUT LLM (`SonnetExtractionRaw`),
// PAS encore une `Timeline` finale. La conversion `trigger_at_word_index →
// start_sec` + validation Zod stricte sera faite en T5.2 par
// `buildTimelineFromRaw`.

import Anthropic from '@anthropic-ai/sdk'

import {
  EXTRACTION_SYSTEM_PROMPT,
  buildFormationPrompt,
} from './llm-prompt-formations'
import { parseStrictWithRecovery } from './parse-json-recovery'
import type { Timeline } from './schema'

// ---------------------------------------------------------------------------
// Constants — figées en haut de fichier pour ajustement rapide
// ---------------------------------------------------------------------------

/** Modèle Sonnet figé. Lu depuis
 *  supabase/functions/synthesize_articles/types.ts:18 (DEFAULT_SONNET_MODEL).
 *  À ne JAMAIS modifier sans alignement avec le module Edge. */
export const SONNET_MODEL_T5 = 'claude-sonnet-4-6'

/** max_tokens output Sonnet — 4096 suffit pour 5 scènes + 12 concepts dense. */
export const SONNET_MAX_TOKENS_T5 = 4096

/** Boucle retry sur stages json_parse / structure_check (1 essai + 2 retries).
 *  Pas de retry sur stage='anthropic_call' (le SDK retry déjà 429/5xx). */
export const MAX_EXTRACTION_RETRIES = 3

/** Timeout AbortController par appel Anthropic. La route a maxDuration=60s,
 *  on coupe à 45s pour laisser 15s de marge sur la conversion + Storage. */
export const SONNET_CALL_TIMEOUT_MS = 45_000

/** Clés top-level requises dans la sortie LLM brute. */
const REQUIRED_TOP_LEVEL_KEYS = ['scenes', 'concepts'] as const

// ---------------------------------------------------------------------------
// Types — output BRUT LLM (avant conversion → Timeline finale T5.2)
// ---------------------------------------------------------------------------

export interface SonnetRawConcept {
  term: string
  definition: string
  at_word_index: number
  source?: string
}

export interface SonnetRawCardContent {
  text: string
  subtitle?: string
  variant?: 'highlight' | 'warning' | 'success'
}

/** Discriminated union sur `kind` — miroir du schéma TypeScript embarqué dans
 *  le prompt. La validation runtime stricte est faite par TimelineSchema en T5.2
 *  après conversion. Ici, on accepte tout objet bien formé en mode "permissif"
 *  (le caller fait son boulot). */
export type SonnetRawTemplate =
  | { kind: 'flowchart'; cards: SonnetRawCardContent[]; orientation?: 'horizontal' | 'vertical' }
  | { kind: 'grid'; columns: number; cards: SonnetRawCardContent[] }
  | {
      kind: 'comparison'
      left: { title: string; cards: SonnetRawCardContent[] }
      right: { title: string; cards: SonnetRawCardContent[] }
    }
  | {
      kind: 'causal'
      nodes: Array<SonnetRawCardContent & { id: string }>
      edges: Array<{ from: string; to: string; label?: string }>
    }
  | {
      kind: 'figures'
      figures: Array<{ value: string; label: string; emphasis?: boolean }>
    }
  | { kind: 'timeline'; events: Array<{ at_label: string; text: string }> }

export interface SonnetRawScene {
  id?: string
  title: string
  trigger_at_word_index: number
  display_duration_sec: number
  pedagogical_intent?: string
  template: SonnetRawTemplate
}

export interface SonnetExtractionRaw {
  scenes: SonnetRawScene[]
  concepts: SonnetRawConcept[]
}

// ---------------------------------------------------------------------------
// Result types — discriminated union sur `ok`
// ---------------------------------------------------------------------------

export interface ExtractionTokens {
  /** Cumul input tokens sur tous les essais. */
  input: number
  /** Cumul output tokens sur tous les essais. */
  output: number
}

export interface ExtractionSuccess {
  ok: true
  /** Sortie LLM brute (avant conversion timestamps + validation Zod finale). */
  raw_output: SonnetExtractionRaw
  tokens: ExtractionTokens
  /** Réponse Sonnet brute du dernier essai (full, non tronquée). */
  sonnet_raw: string
  /** Numéro de l'essai qui a réussi (1..MAX_EXTRACTION_RETRIES). */
  attempts: number
  duration_ms: number
  /** Warnings non bloquants : ['json_recovered_from_wrap'] si recovery actif. */
  warnings: string[]
}

export interface ExtractionFailure {
  ok: false
  /**
   * Stage qui a fait échouer l'extraction :
   *  - 'anthropic_call'  : appel API raté (timeout AbortController, 4xx,
   *    réseau). Pas de retry — le SDK retry déjà 429/5xx en interne.
   *  - 'json_parse'      : pas de JSON parsable (parse direct + recovery échoué)
   *    OU réponse Sonnet vide. Retryable.
   *  - 'structure_check' : JSON parsé mais clés top-level manquantes
   *    (scenes / concepts absentes ou mauvais type). Retryable.
   */
  stage: 'anthropic_call' | 'json_parse' | 'structure_check'
  errors: string[]
  /** Réponse Sonnet brute du dernier essai (tronquée à 2000 chars). */
  sonnet_raw: string
  /** Output partiellement parsé du dernier essai si parse OK mais structure KO. */
  partial_output: unknown | null
  tokens: ExtractionTokens
  attempts: number
  duration_ms: number
}

export type ExtractionResult = ExtractionSuccess | ExtractionFailure

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface StructureCheck {
  ok: boolean
  reason?: string
}

function checkTopLevelStructure(parsed: unknown): StructureCheck {
  if (parsed === null || typeof parsed !== 'object') {
    return {
      ok: false,
      reason: `output is not an object (got ${parsed === null ? 'null' : typeof parsed})`,
    }
  }
  if (Array.isArray(parsed)) {
    return { ok: false, reason: 'output is an array (expected object)' }
  }
  const obj = parsed as Record<string, unknown>
  const missing: string[] = []
  for (const k of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(k in obj)) missing.push(k)
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `missing top-level keys: ${missing.join(', ')}`,
    }
  }
  if (!Array.isArray(obj.scenes)) {
    return { ok: false, reason: 'scenes is not an array' }
  }
  if (!Array.isArray(obj.concepts)) {
    return { ok: false, reason: 'concepts is not an array' }
  }
  return { ok: true }
}

function truncateForLog(s: string, max = 2000): string {
  if (!s) return ''
  return s.length <= max ? s : `${s.slice(0, max)}…[truncated ${s.length - max}]`
}

function logEvent(event: string, payload: Record<string, unknown>): void {
  // Logger structuré minimal — JSON sur une ligne, picked up par Vercel logs.
  // Pas de Logger dédié pour rester léger côté Node.js.
  try {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ event, ...payload }))
  } catch {
    // Échec sérialisation (référence cyclique ?) — fallback silencieux.
  }
}

// ---------------------------------------------------------------------------
// Public API — extractScenesFromScript
// ---------------------------------------------------------------------------

export interface ExtractScenesArgs {
  script_text: string
  transcript: Timeline['transcript']
  source_id: string
}

/**
 * Boucle d'extraction Sonnet avec retry sur stages json_parse / structure_check.
 *
 * Cumul tokens sur TOUS les essais (succès ou fail) — exposé au caller pour le
 * calcul de coût indicatif côté UI admin.
 */
export async function extractScenesFromScript(
  args: ExtractScenesArgs
): Promise<ExtractionResult> {
  const startedAt = performance.now()
  const tokens: ExtractionTokens = { input: 0, output: 0 }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      stage: 'anthropic_call',
      errors: ['Missing ANTHROPIC_API_KEY env var'],
      sonnet_raw: '',
      partial_output: null,
      tokens,
      attempts: 0,
      duration_ms: Math.round(performance.now() - startedAt),
    }
  }

  const client = new Anthropic({ apiKey, maxRetries: 3 })
  const userPrompt = buildFormationPrompt(args.script_text, args.transcript)
  const warnings: string[] = []

  let lastSonnetRaw = ''
  let lastFailure: {
    stage: 'anthropic_call' | 'json_parse' | 'structure_check'
    errors: string[]
    partial_output: unknown | null
  } | null = null
  let attemptsDone = 0

  for (let attempt = 1; attempt <= MAX_EXTRACTION_RETRIES; attempt++) {
    attemptsDone = attempt

    // ----- 1. Appel Anthropic avec AbortController 45s -----
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), SONNET_CALL_TIMEOUT_MS)
    let response: Anthropic.Message
    try {
      response = await client.messages.create(
        {
          model: SONNET_MODEL_T5,
          max_tokens: SONNET_MAX_TOKENS_T5,
          temperature: 0,
          system: EXTRACTION_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userPrompt }],
        },
        { signal: ctrl.signal }
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
      logEvent('extraction_anthropic_call_failed', {
        source_id: args.source_id,
        attempt,
        is_abort: isAbort,
        error: msg,
      })
      lastFailure = {
        stage: 'anthropic_call',
        errors: [msg],
        partial_output: null,
      }
      lastSonnetRaw = ''
      // Pas de retry — le SDK retry déjà 429/5xx en interne, et un abort
      // signifie qu'on est trop proche du maxDuration route.
      break
    }
    clearTimeout(timer)

    tokens.input += response.usage?.input_tokens ?? 0
    tokens.output += response.usage?.output_tokens ?? 0

    // ----- 2. Extraction texte -----
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
    lastSonnetRaw = text

    if (!text || !text.trim()) {
      logEvent('extraction_empty_response', {
        source_id: args.source_id,
        attempt,
      })
      lastFailure = {
        stage: 'json_parse',
        errors: ['empty response from Sonnet'],
        partial_output: null,
      }
      if (attempt < MAX_EXTRACTION_RETRIES) continue
      break
    }

    // ----- 3. Parse JSON avec recovery -----
    const parseRes = parseStrictWithRecovery(text)
    if (!parseRes.ok) {
      logEvent('extraction_json_parse_failed', {
        source_id: args.source_id,
        attempt,
        reason: parseRes.reason,
        text_preview: truncateForLog(text, 200),
      })
      lastFailure = {
        stage: 'json_parse',
        errors: [parseRes.reason ?? 'JSON parse failed'],
        partial_output: null,
      }
      if (attempt < MAX_EXTRACTION_RETRIES) continue
      break
    }
    if (parseRes.recovered_from_wrap) {
      logEvent('extraction_json_recovered_from_wrap', {
        source_id: args.source_id,
        attempt,
      })
      if (!warnings.includes('json_recovered_from_wrap')) {
        warnings.push('json_recovered_from_wrap')
      }
    }

    // ----- 4. Check top-level structure -----
    const struct = checkTopLevelStructure(parseRes.parsed)
    if (!struct.ok) {
      logEvent('extraction_structure_check_failed', {
        source_id: args.source_id,
        attempt,
        reason: struct.reason,
      })
      lastFailure = {
        stage: 'structure_check',
        errors: [struct.reason ?? 'structure check failed'],
        partial_output: parseRes.parsed,
      }
      if (attempt < MAX_EXTRACTION_RETRIES) continue
      break
    }

    // ----- 5. Succès -----
    const raw = parseRes.parsed as SonnetExtractionRaw
    logEvent('extraction_succeeded', {
      source_id: args.source_id,
      attempt,
      tokens_input: tokens.input,
      tokens_output: tokens.output,
      scenes_count: raw.scenes.length,
      concepts_count: raw.concepts.length,
      recovered_from_wrap: parseRes.recovered_from_wrap,
    })
    return {
      ok: true,
      raw_output: raw,
      tokens,
      sonnet_raw: text,
      attempts: attempt,
      duration_ms: Math.round(performance.now() - startedAt),
      warnings,
    }
  }

  // ----- Boucle épuisée — return failure -----
  const fallback = lastFailure ?? {
    stage: 'json_parse' as const,
    errors: ['unknown failure (no attempt completed)'],
    partial_output: null,
  }
  logEvent('extraction_exhausted', {
    source_id: args.source_id,
    final_stage: fallback.stage,
    error_count: fallback.errors.length,
    attempts: attemptsDone,
    tokens_input: tokens.input,
    tokens_output: tokens.output,
  })
  return {
    ok: false,
    stage: fallback.stage,
    errors: fallback.errors,
    sonnet_raw: truncateForLog(lastSonnetRaw, 2000),
    partial_output: fallback.partial_output,
    tokens,
    attempts: attemptsDone,
    duration_ms: Math.round(performance.now() - startedAt),
  }
}
