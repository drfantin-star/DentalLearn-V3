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
  buildFormationPromptApprox,
} from './llm-prompt-formations'
import { parseStrictWithRecovery } from './parse-json-recovery'
import { TimelineSchema, type Timeline } from './schema'
import { makeWordIndexLookup, countWordsFlat } from './word-index-lookup'

// ---------------------------------------------------------------------------
// Constants — figées en haut de fichier pour ajustement rapide
// ---------------------------------------------------------------------------

/** Modèle Sonnet figé. Lu depuis
 *  supabase/functions/synthesize_articles/types.ts:18 (DEFAULT_SONNET_MODEL).
 *  À ne JAMAIS modifier sans alignement avec le module Edge. */
export const SONNET_MODEL_T5 = 'claude-sonnet-4-6'

/** max_tokens output Sonnet — 4096 suffit pour 8-12 scènes JSON (T5-bis :
 *  une scène dense fait ~250-350 tokens output, soit ~3500 max pour 10 scènes
 *  + 12 concepts). Revenu de 8192 à 4096 — l'over-provisioning était inutile. */
export const SONNET_MAX_TOKENS_T5 = 4096

/** Boucle retry sur stages json_parse / structure_check (1 essai + 2 retries).
 *  Pas de retry sur stage='anthropic_call' (le SDK retry déjà 429/5xx). */
export const MAX_EXTRACTION_RETRIES = 3

/** Timeout AbortController par appel Anthropic. La route a maxDuration=60s,
 *  on coupe à 45s pour laisser 15s de marge sur la conversion + Storage.
 *
 *  Note T5-bis-B : ce timeout n'est appliqué que dans le chemin DRY-RUN
 *  synchrone de la route Next.js. La voie de production (non-dry_run) passe
 *  par la Supabase Edge Function extract-scenes-formation qui a son propre
 *  timeout interne (90s) et ne dépend pas de cette constante. */
export const SONNET_CALL_TIMEOUT_MS = 45_000

/** Clés top-level requises dans la sortie LLM brute. */
const REQUIRED_TOP_LEVEL_KEYS = ['scenes', 'concepts'] as const

// ---------------------------------------------------------------------------
// T5.2 — Constantes de garde pour la conversion raw → Timeline finale
// ---------------------------------------------------------------------------

/** Cap dur sur le nombre de scènes — T5-bis : cible 8-12, plafond défensif 15
 *  (le prompt instruit Sonnet à 8-12, le serveur tronque uniquement si la
 *  consigne dérive franchement). */
export const MAX_SCENES = 15

/** Bornes display_duration_sec — T5-bis : fenêtre resserrée 15-35s pour
 *  densifier la timeline. Clamping côté serveur pour éviter un end_sec qui
 *  dépasse l'audio ou une scène trop courte. */
export const MIN_DURATION_SEC = 15
export const MAX_DURATION_SEC = 35

/** Durée par défaut affichée pour un concept (en secondes). Le concept reste
 *  highlightable pendant 4s autour de son `at_sec` — choix arbitraire pour
 *  donner un end_sec valide au schéma sans faire dépendre la durée réelle
 *  d'un champ Sonnet (qui ne contrôle que `at_word_index`). */
export const CONCEPT_HIGHLIGHT_DURATION_SEC = 4

/** Limites text/subtitle des cards — alignées sur CardContentSchema. */
const MAX_CARD_TEXT_LEN = 60
const MAX_CARD_SUBTITLE_LEN = 40

// ---------------------------------------------------------------------------
// Types — output BRUT LLM (avant conversion → Timeline finale T5.2)
// ---------------------------------------------------------------------------

/**
 * Discriminated par la présence de `at_word_index` (mode word_index) ou
 * `at_sec` (mode approx_sec, §1 handoff). Aucun des deux n'est strictement
 * obligatoire au niveau type — `buildTimelineFromRaw` applique le fallback
 * proportionnel si la valeur est absente.
 */
export interface SonnetRawConcept {
  term: string
  definition: string
  at_word_index?: number
  at_sec?: number
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

/**
 * Discriminated par la présence de `trigger_at_word_index` (mode word_index)
 * ou `trigger_at_sec` (mode approx_sec, §1 handoff). Le caller / le builder
 * applique le fallback proportionnel si la valeur est absente.
 */
export interface SonnetRawScene {
  id?: string
  title: string
  trigger_at_word_index?: number
  trigger_at_sec?: number
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

export type ExtractionMode = 'word_index' | 'approx_sec'

export interface ExtractScenesArgs {
  script_text: string
  source_id: string
  /** Mode `word_index` (défaut historique) : nécessite `transcript`. Mode
   *  `approx_sec` (§1 handoff) : transcript optionnel, `duration_sec` requis. */
  mode?: ExtractionMode
  transcript?: Timeline['transcript']
  /** Durée audio en secondes — requise en mode `approx_sec` pour borner
   *  `trigger_at_sec` dans le prompt et clamper côté builder. */
  duration_sec?: number
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
  const mode: ExtractionMode = args.mode ?? 'word_index'
  let userPrompt: string
  if (mode === 'approx_sec') {
    if (!args.duration_sec || args.duration_sec <= 0) {
      return {
        ok: false,
        stage: 'anthropic_call',
        errors: ['mode approx_sec requires positive duration_sec'],
        sonnet_raw: '',
        partial_output: null,
        tokens,
        attempts: 0,
        duration_ms: Math.round(performance.now() - startedAt),
      }
    }
    userPrompt = buildFormationPromptApprox(args.script_text, args.duration_sec)
  } else {
    userPrompt = buildFormationPrompt(args.script_text, args.transcript)
  }
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

// ---------------------------------------------------------------------------
// T5.2 — buildTimelineFromRaw : conversion raw LLM → Timeline Zod-validée
// ---------------------------------------------------------------------------

export interface BuildTimelineSuccess {
  ok: true
  timeline: Timeline
  warnings: string[]
}

export interface BuildTimelineFailure {
  ok: false
  stage: 'validation'
  errors: string[]
  /** Objet brut tel que construit avant TimelineSchema.parse — exposé pour
   *  permettre un debug admin (ex : voir un id de causal node manquant). */
  partial_timeline: unknown
  warnings: string[]
}

export type BuildTimelineResult = BuildTimelineSuccess | BuildTimelineFailure

export interface BuildTimelineArgs {
  raw: SonnetExtractionRaw
  source_id: string
  audio_url: string
  duration_sec: number
  /** Mode `word_index` (défaut) : utilise `transcript` pour la lookup
   *  word-index → start_sec. Mode `approx_sec` (§1 handoff) : utilise
   *  `trigger_at_sec` / `at_sec` directement, `transcript` est optionnel
   *  (peut être absent ou des segments vides). */
  mode?: ExtractionMode
  transcript?: Timeline['transcript']
}

/**
 * Pipeline de conversion (ordre exact spec POC §6.3) :
 *  1. Tronque scenes à MAX_SCENES + warning `scenes_truncated`
 *  2. Truncate text/subtitle ≥ limites + warning `text_truncated`
 *  3. Conversion `trigger_at_word_index → start_sec` via lookup transcript
 *     (fallback proportionnel si index hors bornes)
 *  4. Calcul end_sec = start_sec + clamp(display_duration_sec, [20,45])
 *     (warning `duration_clamped` si clamp actif)
 *  5. Génération id scènes (`scene-${index+1}`) si absent ou non unique
 *  6. Génération id cards synthétique pour les non-causal templates ;
 *     causal validé par TimelineSchema.refine() (échec → stage='validation')
 *  7. Concepts : at_sec via lookup, fallback at_sec=0 + warning, dérive
 *     id/label/start_sec/end_sec
 *  8. Chapters : un par scène, tri ASC sur start_sec
 *  9. Validation Zod finale via TimelineSchema.safeParse — si fail, retourne
 *     stage='validation' avec partial_timeline et erreurs Zod aplaties
 */
export function buildTimelineFromRaw(
  args: BuildTimelineArgs
): BuildTimelineResult {
  const warnings: string[] = []
  const mode: ExtractionMode = args.mode ?? 'word_index'
  const lookup = makeWordIndexLookup(args.transcript)
  const totalWords = countWordsFlat(args.transcript)

  // ----- 1. Tronquer scenes à MAX_SCENES -----
  const sourceScenes = args.raw.scenes ?? []
  let scenes = sourceScenes
  if (sourceScenes.length > MAX_SCENES) {
    scenes = sourceScenes.slice(0, MAX_SCENES)
    warnings.push(`scenes_truncated:${sourceScenes.length}->${MAX_SCENES}`)
  }

  // ----- 2 + 3 + 4 + 5 + 6 — Conversion scènes -----
  const usedIds = new Set<string>()
  const convertedScenes = scenes.map((scene, index) => {
    const sceneIndexLabel = `scene-${index + 1}`
    const safeId = ensureUniqueSceneId(scene.id, sceneIndexLabel, usedIds)

    // Conversion start_sec — branche selon le mode (§2 handoff).
    let startSec: number | null = null
    if (mode === 'approx_sec') {
      const rawSec = Number(scene.trigger_at_sec)
      if (Number.isFinite(rawSec)) {
        startSec = clamp(rawSec, 0, args.duration_sec)
      }
    } else {
      // mode === 'word_index'
      if (typeof scene.trigger_at_word_index === 'number') {
        startSec = lookup(scene.trigger_at_word_index)
      }
    }
    if (startSec === null) {
      // Fallback proportionnel — identique aux deux modes : si on n'a pas
      // pu lire la valeur (out-of-bounds word index ou trigger_at_sec
      // manquant/non-fini), on répartit uniformément la scène sur la durée.
      startSec =
        mode === 'word_index'
          ? totalWords > 0
            ? (index * args.duration_sec) / Math.max(scenes.length, 1)
            : 0
          : (index * args.duration_sec) / Math.max(scenes.length, 1)
      warnings.push(
        mode === 'word_index'
          ? `word_index_out_of_bounds:${safeId}`
          : `trigger_at_sec_missing:${safeId}`
      )
    }

    // Clamp display_duration_sec
    const rawDuration = Number(scene.display_duration_sec ?? MIN_DURATION_SEC)
    let duration = Number.isFinite(rawDuration) ? rawDuration : MIN_DURATION_SEC
    if (duration < MIN_DURATION_SEC || duration > MAX_DURATION_SEC) {
      duration = clamp(duration, MIN_DURATION_SEC, MAX_DURATION_SEC)
      warnings.push(`duration_clamped:${safeId}`)
    }

    // Truncate text/subtitle défensif sur tout le template
    const safeTemplate = sanitizeTemplate(scene.template, safeId, warnings)

    return {
      id: safeId,
      title: typeof scene.title === 'string' ? scene.title : safeId,
      start_sec: startSec,
      end_sec: Math.min(startSec + duration, args.duration_sec),
      template: safeTemplate,
    }
  })

  // ----- 7. Concepts — branche selon le mode (§2 handoff) -----
  const sourceConcepts = args.raw.concepts ?? []
  const convertedConcepts = sourceConcepts.map((concept, index) => {
    let atSec: number | null = null
    if (mode === 'approx_sec') {
      const rawSec = Number(concept.at_sec)
      if (Number.isFinite(rawSec)) {
        atSec = clamp(rawSec, 0, args.duration_sec)
      }
    } else {
      if (typeof concept.at_word_index === 'number') {
        atSec = lookup(concept.at_word_index)
      }
    }
    if (atSec === null) {
      atSec = 0
      warnings.push(
        mode === 'word_index'
          ? `concept_word_index_out_of_bounds:${concept.term ?? `idx-${index}`}`
          : `concept_at_sec_missing:${concept.term ?? `idx-${index}`}`
      )
    }
    const id = generateConceptId()
    const label = (concept.term ?? '').trim() || `concept-${index + 1}`
    return {
      id,
      label,
      start_sec: atSec,
      end_sec: Math.min(
        atSec + CONCEPT_HIGHLIGHT_DURATION_SEC,
        args.duration_sec
      ),
      term: concept.term,
      definition: truncateString(concept.definition, 300),
      at_sec: atSec,
      ...(typeof concept.at_word_index === 'number'
        ? { at_word_index: concept.at_word_index }
        : {}),
      source: concept.source,
    }
  })

  // ----- 8. Chapters — un par scène, ASC -----
  const chapters = convertedScenes
    .slice()
    .sort((a, b) => a.start_sec - b.start_sec)
    .map((scene, idx) => ({
      id: `chapter-${idx + 1}`,
      title: scene.title,
      start_sec: scene.start_sec,
      end_sec: scene.end_sec,
    }))

  // ----- 9. Construction objet Timeline -----
  // En mode approx_sec on n'embarque PAS de transcript (la timeline finale
  // n'aura pas de karaoké word-level). Le champ est optionnel sur le schéma.
  const timelineDraft: Record<string, unknown> = {
    schema_version: '1.0',
    source_type: 'formation_sequence',
    source_id: args.source_id,
    audio_url: args.audio_url,
    duration_sec: args.duration_sec,
    generated_at: new Date().toISOString(),
    generator:
      mode === 'approx_sec' ? 'auto_llm_extraction_approx' : 'auto_llm_extraction',
    scenes: convertedScenes,
    concepts: convertedConcepts,
    chapters,
  }
  if (mode === 'word_index' && args.transcript) {
    timelineDraft.transcript = args.transcript
  }

  // ----- 10. Validation Zod finale -----
  const parsed = TimelineSchema.safeParse(timelineDraft)
  if (!parsed.success) {
    const flat = parsed.error.flatten()
    const formErrors = flat.formErrors ?? []
    const fieldErrors = flat.fieldErrors ?? {}
    const fieldErrorList = Object.entries(fieldErrors).flatMap(([k, vs]) =>
      (vs ?? []).map((v) => `${k}: ${v}`)
    )
    const errors = [...formErrors, ...fieldErrorList]
    return {
      ok: false,
      stage: 'validation',
      errors:
        errors.length > 0 ? errors : [parsed.error.message ?? 'validation failed'],
      partial_timeline: timelineDraft,
      warnings,
    }
  }

  return {
    ok: true,
    timeline: parsed.data,
    warnings,
  }
}

// ---------------------------------------------------------------------------
// T5.2 — Helpers internes
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n))
}

function truncateString<T>(s: T, max: number): T {
  if (typeof s !== 'string') return s
  if (s.length <= max) return s
  // -3 pour réserver place du "..."
  return ((s.slice(0, Math.max(0, max - 3)) + '...') as unknown) as T
}

function ensureUniqueSceneId(
  rawId: string | undefined,
  fallback: string,
  used: Set<string>
): string {
  const candidate =
    typeof rawId === 'string' && rawId.trim().length > 0 ? rawId.trim() : fallback
  const safe = used.has(candidate) ? fallback : candidate
  used.add(safe)
  return safe
}

function generateConceptId(): string {
  // crypto.randomUUID() est dispo en Node 18+ et côté Edge — pas besoin de
  // shim. Fallback string vide si jamais runtime sans crypto (improbable).
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID()
  }
  return `concept-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Truncate les `text` (≤60) et `subtitle` (≤40) sur tous les contenus du
 * template. Loggue un warning par scène (pas par card — éviterait la
 * cardinalité explosive si une scène a 5 cards toutes trop longues).
 */
function sanitizeTemplate(
  template: SonnetRawTemplate,
  sceneId: string,
  warnings: string[]
): SonnetRawTemplate {
  let textTouched = false
  let subtitleTouched = false

  const sanitizeCard = (c: SonnetRawCardContent): SonnetRawCardContent => {
    let text = c.text ?? ''
    let subtitle = c.subtitle
    if (typeof text === 'string' && text.length > MAX_CARD_TEXT_LEN) {
      text = text.slice(0, MAX_CARD_TEXT_LEN - 3) + '...'
      textTouched = true
    }
    if (
      typeof subtitle === 'string' &&
      subtitle.length > MAX_CARD_SUBTITLE_LEN
    ) {
      subtitle = subtitle.slice(0, MAX_CARD_SUBTITLE_LEN - 3) + '...'
      subtitleTouched = true
    }
    return { ...c, text, ...(subtitle !== undefined ? { subtitle } : {}) }
  }

  let result: SonnetRawTemplate
  switch (template.kind) {
    case 'flowchart':
      result = { ...template, cards: template.cards.map(sanitizeCard) }
      break
    case 'grid':
      result = { ...template, cards: template.cards.map(sanitizeCard) }
      break
    case 'comparison':
      result = {
        ...template,
        left: { ...template.left, cards: template.left.cards.map(sanitizeCard) },
        right: {
          ...template.right,
          cards: template.right.cards.map(sanitizeCard),
        },
      }
      break
    case 'causal':
      result = {
        ...template,
        nodes: template.nodes.map((n) => ({
          ...sanitizeCard(n),
          id: n.id,
        })),
      }
      break
    case 'figures':
      // figures.value/label ne sont pas bornés par CardContentSchema mais on
      // tronque label défensivement à MAX_CARD_TEXT_LEN pour éviter overflow
      // visuel côté composant Figures (qui s'aligne avec les autres cards).
      result = {
        ...template,
        figures: template.figures.map((f) => {
          let label = f.label ?? ''
          if (typeof label === 'string' && label.length > MAX_CARD_TEXT_LEN) {
            label = label.slice(0, MAX_CARD_TEXT_LEN - 3) + '...'
            textTouched = true
          }
          return { ...f, label }
        }),
      }
      break
    case 'timeline':
      result = {
        ...template,
        events: template.events.map((e) => {
          let text = e.text ?? ''
          if (typeof text === 'string' && text.length > MAX_CARD_TEXT_LEN) {
            text = text.slice(0, MAX_CARD_TEXT_LEN - 3) + '...'
            textTouched = true
          }
          return { ...e, text }
        }),
      }
      break
    default: {
      // Exhaustiveness check — TS error si on oublie un kind. Cast pour ne
      // pas planter en runtime sur un kind inattendu : on laisse passer tel
      // quel, la validation Zod finale rejettera proprement.
      const _exhaustive: never = template
      result = template
      void _exhaustive
    }
  }

  if (textTouched) warnings.push(`text_truncated:${sceneId}`)
  if (subtitleTouched) warnings.push(`subtitle_truncated:${sceneId}`)
  return result
}
