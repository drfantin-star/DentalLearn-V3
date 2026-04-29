// Appel Sonnet pour synthesize_articles — boucle de retry sur tag_validation.
//
// Une fonction exportée : callSonnetWithRetry.
//
// Boucle 1..maxTagRetries (default MAX_TAG_RETRIES=3, arbitrage A2). Chaque
// essai :
//   1. Construit messages = SYSTEM_PROMPT + buildUserPrompt(article, lists)
//   2. Appel anthropic.messages({ model: claude-sonnet-4-6, ... })
//      Retry réseau 429/5xx déjà géré côté _shared/anthropic.ts (3x backoff
//      exponentiel + Retry-After).
//   3. Cumul tokens (sur TOUS les essais — pour le RunSummary cost).
//   4. Parse JSON strict avec recovery markdown wrap (warning loggé si
//      recovery actif).
//   5. Check top-level structure (clés requises présentes, output objet).
//   6. validateTags(parsed, lists) → si OK return success ; sinon retry.
//
// Sortie :
//   - { ok: true, output, tokens, sonnet_raw, attempts }
//   - { ok: false, stage: 'json_parse' | 'tag_validation', errors[],
//       sonnet_raw (dernier essai tronqué), partial_output (si parse OK
//       mais tags KO — utile à upsertFailedSynthesis), tokens, attempts }
//
// Distinction stages :
//   - json_parse : pas d'output utilisable (parse fail / structure incomplète /
//     réponse vide / appel anthropic raté après ses propres retries internes).
//   - tag_validation : output parseable mais ≥1 tag hors taxonomy après
//     maxTagRetries essais.
//
// Le caller (article_processor/index.ts) utilise cette distinction pour
// peupler ValidationErrorPayload.stage et choisir s'il faut conserver le
// partial_output dans le record fail.
//
// NE PAS appeler validateAndFilterQuestions ici : c'est la responsabilité
// du caller à l'étape 2 (les questions invalides ne déclenchent pas de
// retry Sonnet — elles sont filtrées et tracées en validation_warnings).

import {
  AnthropicClient,
  extractTextContent,
  parseJsonFromText,
} from "../../_shared/anthropic.ts";
import { Logger } from "../../_shared/logger.ts";
import { SYSTEM_PROMPT, buildUserPrompt } from "../prompts.ts";
import { validateTags } from "../validators.ts";
import {
  DEFAULT_SONNET_MODEL,
  MAX_TAG_RETRIES,
  SONNET_MAX_TOKENS,
  truncateForLog,
} from "../types.ts";
import type {
  SelectedArticle,
  SonnetSynthesisOutput,
  TaxonomyLists,
} from "../types.ts";

const logger = new Logger("synthesize_articles.sonnet_call");

// ---------------------------------------------------------------------------
// Types de retour
// ---------------------------------------------------------------------------

export interface SonnetTokens {
  /** Tokens d'input cumulés sur tous les essais (input prompt + system). */
  input: number;
  /** Tokens d'output cumulés sur tous les essais. */
  output: number;
}

export interface SonnetCallSuccess {
  ok: true;
  output: SonnetSynthesisOutput;
  tokens: SonnetTokens;
  /** Réponse Sonnet brute du dernier essai (full, non tronquée). */
  sonnet_raw: string;
  /** Numéro de l'essai qui a réussi (1..maxTagRetries). */
  attempts: number;
}

export interface SonnetCallFailure {
  ok: false;
  /**
   * Stage qui a fait échouer le traitement :
   *   - 'json_parse'      : pas d'output utilisable (parse fail / structure
   *     incomplète / réponse vide après les essais).
   *   - 'tag_validation'  : output parseable mais ≥1 tag hors taxonomy
   *     après maxTagRetries essais.
   *   - 'anthropic_call'  : appel API Sonnet raté APRÈS les retries internes
   *     d'_shared/anthropic.ts (timeout abort, 4xx non retryable, réseau
   *     cassé). Distinct de json_parse : ici on n'a même pas de réponse à
   *     parser. Filtrage admin "transient API down" vs "Sonnet drift".
   */
  stage: "json_parse" | "tag_validation" | "anthropic_call";
  errors: string[];
  /** Réponse Sonnet brute du dernier essai (tronquée à 2000 chars). */
  sonnet_raw: string;
  /** Output parseable du dernier essai (utile pour upsertFailedSynthesis sur
   *  stage='tag_validation'). null sur stage='json_parse' ou 'anthropic_call'. */
  partial_output: SonnetSynthesisOutput | null;
  tokens: SonnetTokens;
  /** Nombre d'essais effectués (≤ maxTagRetries). */
  attempts: number;
}

export type SonnetCallResult = SonnetCallSuccess | SonnetCallFailure;

// ---------------------------------------------------------------------------
// Top-level structure check (avant validateTags)
// ---------------------------------------------------------------------------

/**
 * Clés top-level requises dans l'output Sonnet pour qu'on puisse même tenter
 * validateTags. Ne vérifie PAS les types des valeurs (validateTags s'en
 * charge), juste la présence des clés. Si une clé manque → stage='json_parse'
 * (Sonnet a produit un JSON valide mais incomplet, sémantiquement équivalent
 * à un parse raté du point de vue caller).
 */
const REQUIRED_TOP_LEVEL_KEYS = [
  "summary_fr",
  "specialite",
  "themes",
  "niveau_preuve",
  "category_editorial",
  "display_title",
  "quiz",
] as const;

interface StructureCheck {
  ok: boolean;
  reason?: string;
}

function checkTopLevelStructure(parsed: unknown): StructureCheck {
  if (parsed === null || typeof parsed !== "object") {
    return {
      ok: false,
      reason: `output is not an object (got ${parsed === null ? "null" : typeof parsed})`,
    };
  }
  if (Array.isArray(parsed)) {
    return { ok: false, reason: "output is an array (expected object)" };
  }
  const obj = parsed as Record<string, unknown>;
  const missing: string[] = [];
  for (const k of REQUIRED_TOP_LEVEL_KEYS) {
    if (!(k in obj)) missing.push(k);
  }
  if (missing.length > 0) {
    return {
      ok: false,
      reason: `missing top-level keys: ${missing.join(", ")}`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// JSON parse strict avec recovery markdown wrap
// ---------------------------------------------------------------------------

interface ParseAttempt {
  ok: boolean;
  parsed?: unknown;
  reason?: string;
  /** true si le parse direct a échoué mais parseJsonFromText (extraction
   *  ```json wrap ou accolades équilibrées) a réussi. Sert à logger un
   *  warning "json_recovered_from_wrap" — Sonnet n'est pas censé wrap
   *  malgré la consigne SYSTEM_PROMPT. */
  recovered_from_wrap: boolean;
}

function parseStrictWithRecovery(text: string): ParseAttempt {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, reason: "empty response", recovered_from_wrap: false };
  }

  // 1ère passe : JSON.parse direct (cas nominal — Sonnet respecte la consigne).
  try {
    const parsed = JSON.parse(trimmed);
    return { ok: true, parsed, recovered_from_wrap: false };
  } catch {
    // Fallthrough vers la 2e passe.
  }

  // 2e passe : parseJsonFromText (gère ```json wrap + extraction par accolades
  // équilibrées). Réutilisation du helper de _shared/anthropic.ts pour
  // cohérence avec score_articles.
  const recovered = parseJsonFromText(text);
  if (recovered !== null && recovered !== undefined) {
    return { ok: true, parsed: recovered, recovered_from_wrap: true };
  }

  return {
    ok: false,
    reason: "JSON parse failed (direct + recovery)",
    recovered_from_wrap: false,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Appelle Sonnet jusqu'à `maxTagRetries` fois pour obtenir un output dont
 * tous les tags sont conformes à la taxonomy. Le retry sur tag_validation
 * utilise le même prompt — Sonnet est non-déterministe à temperature=0
 * sur les bords (rare mais possible), un nouvel essai a une chance non
 * négligeable de produire des tags valides.
 *
 * Tokens cumulés sur TOUS les essais (succès et fail) — exposés au caller
 * pour le calcul de coût RunSummary.estimated_cost_*. Un fail à 3 essais
 * coûte donc ~3× plus cher en input qu'un succès au 1er essai.
 */
export async function callSonnetWithRetry(
  anthropic: AnthropicClient,
  article: SelectedArticle,
  lists: TaxonomyLists,
  maxTagRetries: number = MAX_TAG_RETRIES,
): Promise<SonnetCallResult> {
  const userPrompt = buildUserPrompt(article, lists);
  const tokens: SonnetTokens = { input: 0, output: 0 };

  let lastSonnetRaw = "";
  let lastFailure: {
    stage: "json_parse" | "tag_validation" | "anthropic_call";
    errors: string[];
    partial_output: SonnetSynthesisOutput | null;
  } | null = null;
  let attemptsDone = 0;

  for (let attempt = 1; attempt <= maxTagRetries; attempt++) {
    attemptsDone = attempt;

    // ----- 1. Appel Anthropic -----
    let response;
    try {
      response = await anthropic.messages({
        model: DEFAULT_SONNET_MODEL,
        max_tokens: SONNET_MAX_TOKENS,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });
    } catch (e) {
      // anthropic.ts a déjà retry 3× sur 429/5xx avec backoff exponentiel.
      // Si on arrive ici, c'est un échec durable (timeout abort, 4xx non
      // retryable, ou réseau cassé). Pas la peine de reboucler côté tag —
      // on remonte stage='anthropic_call' (sémantique distincte de
      // 'json_parse' : ici on n'a même pas de réponse à parser, c'est un
      // problème API et non un problème Sonnet drift).
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("anthropic_call_failed", {
        scored_id: article.scored_id,
        attempt,
        error: msg,
      });
      lastFailure = {
        stage: "anthropic_call",
        errors: [`anthropic call failed: ${msg}`],
        partial_output: null,
      };
      lastSonnetRaw = "";
      break; // pas de retry — fail durable
    }

    tokens.input += response.usage?.input_tokens ?? 0;
    tokens.output += response.usage?.output_tokens ?? 0;

    // ----- 2. Extraction texte -----
    const text = extractTextContent(response);
    lastSonnetRaw = text;

    if (!text || !text.trim()) {
      logger.warn("empty_sonnet_response", {
        scored_id: article.scored_id,
        attempt,
      });
      lastFailure = {
        stage: "json_parse",
        errors: ["empty response from Sonnet"],
        partial_output: null,
      };
      // Réponse vide est rare mais peut être ponctuelle — retry possible.
      if (attempt < maxTagRetries) continue;
      break;
    }

    // ----- 3. Parse JSON avec recovery -----
    const parseRes = parseStrictWithRecovery(text);
    if (!parseRes.ok) {
      logger.warn("json_parse_failed", {
        scored_id: article.scored_id,
        attempt,
        reason: parseRes.reason,
        text_preview: truncateForLog(text, 200),
      });
      lastFailure = {
        stage: "json_parse",
        errors: [parseRes.reason ?? "JSON parse failed"],
        partial_output: null,
      };
      if (attempt < maxTagRetries) continue;
      break;
    }
    if (parseRes.recovered_from_wrap) {
      logger.warn("json_recovered_from_wrap", {
        scored_id: article.scored_id,
        attempt,
      });
    }

    // ----- 4. Check top-level structure -----
    const struct = checkTopLevelStructure(parseRes.parsed);
    if (!struct.ok) {
      logger.warn("structure_check_failed", {
        scored_id: article.scored_id,
        attempt,
        reason: struct.reason,
      });
      lastFailure = {
        stage: "json_parse",
        errors: [struct.reason ?? "structure check failed"],
        partial_output: null,
      };
      if (attempt < maxTagRetries) continue;
      break;
    }

    // Cast safe : top-level keys vérifiées présentes ; validateTags vérifie
    // les types/valeurs détaillées juste en dessous.
    const output = parseRes.parsed as SonnetSynthesisOutput;

    // ----- 5. Validation tags -----
    const tagRes = validateTags(output, lists);
    if (tagRes.ok) {
      logger.info("sonnet_call_succeeded", {
        scored_id: article.scored_id,
        attempt,
        tokens_input: tokens.input,
        tokens_output: tokens.output,
        recovered_from_wrap: parseRes.recovered_from_wrap,
      });
      return {
        ok: true,
        output,
        tokens,
        sonnet_raw: text,
        attempts: attempt,
      };
    }

    // Tag invalide — log + retry (sauf dernier essai).
    lastFailure = {
      stage: "tag_validation",
      errors: tagRes.errors,
      partial_output: output, // utile à upsertFailedSynthesis (debug admin)
    };
    logger.warn("tag_retry", {
      scored_id: article.scored_id,
      attempt,
      remaining_attempts: maxTagRetries - attempt,
      // Limit log payload — un Sonnet très off pourrait sortir 20+ erreurs.
      errors: tagRes.errors.slice(0, 5),
      total_errors: tagRes.errors.length,
    });
    // Boucle continue pour le prochain essai (même prompt — Sonnet
    // peut produire des tags valides cette fois grâce à la non-determinism).
  }

  // ----- Boucle épuisée — return failure -----
  const fallback = lastFailure ?? {
    stage: "json_parse" as const,
    errors: ["unknown failure (no attempt completed)"],
    partial_output: null,
  };

  logger.error("sonnet_call_exhausted", {
    scored_id: article.scored_id,
    final_stage: fallback.stage,
    error_count: fallback.errors.length,
    attempts: attemptsDone,
    tokens_input: tokens.input,
    tokens_output: tokens.output,
  });

  return {
    ok: false,
    stage: fallback.stage,
    errors: fallback.errors,
    sonnet_raw: truncateForLog(lastSonnetRaw, 2000),
    partial_output: fallback.partial_output,
    tokens,
    attempts: attemptsDone,
  };
}
