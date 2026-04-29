// Orchestration processArticle pour synthesize_articles.
//
// Une fonction exportée : processArticle. Implémente la matrice de décision
// 0bis → 5 du Ticket 5 (cf prompt initial Dr Fantin) :
//
//   ÉTAPE 0bis  Skip si !force ET existing.status ∈ {'active', 'failed_permanent'}
//   ÉTAPE 0     Force reset si force=true ET existing → DELETE complet
//   ÉTAPE 1     callSonnetWithRetry (3 essais sur tag_validation)
//   ÉTAPE 2     validateAndFilterQuestions (≥1 valide requis)
//   ÉTAPE 3     embedText OpenAI (text-embedding-3-small)
//   ÉTAPE 4     insertSynthesisAndQuestions (rollback Option α si questions plantent)
//   ÉTAPE 5     UPSERT failure record si fail à n'importe quelle étape
//
// Retourne ProcessReport = { outcome, tokens } :
//   - outcome.kind='succeeded' : warnings_count
//   - outcome.kind='failed' : stage + promoted_to_permanent
//   - outcome.kind='skipped' : reason
//   - tokens : cumul Sonnet (sur tous les essais) + embedding (si appelé)
//
// Aucune exception ne remonte au caller (sauf catastrophe hors scope) :
// les erreurs sont capturées, persistées en validation_errors via
// upsertFailedSynthesis, et restituées comme outcome.kind='failed'.

import { AnthropicClient } from "../../_shared/anthropic.ts";
import { embedText, OpenAIClient } from "../../_shared/openai.ts";
import { Logger } from "../../_shared/logger.ts";
import { validateAndFilterQuestions } from "../validators.ts";
import {
  EMBEDDING_DIMENSIONS,
} from "../../_shared/openai.ts";
import {
  QUESTION_VALID_THRESHOLD,
  truncateForLog,
} from "../types.ts";
import type {
  ProcessOutcome,
  ProcessReport,
  SelectedArticle,
  SonnetSynthesisOutput,
  TaxonomyLists,
  ValidationErrorPayload,
  ValidationStage,
} from "../types.ts";
import {
  deleteSynthesisAndQuestions,
  insertSynthesisAndQuestions,
  upsertFailedSynthesis,
} from "./persist.ts";
import { callSonnetWithRetry } from "./sonnet_call.ts";

const logger = new Logger("synthesize_articles.processor");

// ---------------------------------------------------------------------------
// Deps & options
// ---------------------------------------------------------------------------

export interface ProcessDeps {
  // deno-lint-ignore no-explicit-any
  supabase: any;
  anthropic: AnthropicClient;
  openai: OpenAIClient;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Construit le payload JSONB validation_errors à insérer en BDD. Centralise
 * la création avec timestamp ISO 8601 auto et la troncature du sonnet_raw.
 *
 * Le caller passe un `details` libre qui est mergé tel quel dans le payload.
 * Le sonnet_raw est tronqué à 2000 chars (cf truncateForLog dans types.ts).
 */
function buildErrorPayload(input: {
  stage: ValidationStage;
  reason: string;
  details?: Record<string, unknown>;
  sonnet_raw?: string;
}): ValidationErrorPayload {
  const payload: ValidationErrorPayload = {
    stage: input.stage,
    reason: input.reason,
    details: input.details ?? {},
    timestamp: new Date().toISOString(),
  };
  if (input.sonnet_raw && input.sonnet_raw.length > 0) {
    payload.sonnet_raw = truncateForLog(input.sonnet_raw, 2000);
  }
  return payload;
}

/**
 * Construit le texte à embedder à partir d'un output Sonnet validé.
 * Concaténation : display_title + summary_fr + key_figures (joinés par \n).
 *
 * Filtrage défensif des items vides/non-string dans key_figures (Sonnet
 * peut produire un null en cas de "non renseigné" — cohérent SYSTEM_PROMPT).
 * Le texte vide est impossible ici car validateTags garantit summary_fr ≥100
 * chars et display_title non vide.
 */
function buildEmbeddingText(output: SonnetSynthesisOutput): string {
  const parts: string[] = [
    output.display_title,
    output.summary_fr,
  ];
  if (Array.isArray(output.key_figures)) {
    for (const f of output.key_figures) {
      if (typeof f === "string" && f.trim().length > 0) parts.push(f.trim());
    }
  }
  return parts.join("\n");
}

/**
 * Wrapper autour de upsertFailedSynthesis qui standardise le retour ProcessReport
 * pour les fail. Évite la duplication de boilerplate à chaque fail dans la matrice.
 *
 * Si l'UPSERT lui-même plante (rare — DB error sur la table de traces), on
 * loggue + on remonte un outcome failed avec stage='synthesis_insert' (pas de
 * meilleur stage disponible côté audit) et promoted_to_permanent=false par
 * défaut. Le caller voit l'échec dans RunSummary.errors[] (run-level).
 */
async function persistFailureAndReport(
  deps: ProcessDeps,
  article: SelectedArticle,
  payload: ValidationErrorPayload,
  partialOutput: SonnetSynthesisOutput | null,
  tokens: ProcessReport["tokens"],
): Promise<ProcessReport> {
  try {
    const upsertRes = await upsertFailedSynthesis(
      deps.supabase,
      article,
      payload,
      article.existing_synthesis,
      partialOutput,
    );
    logger.warn("article_failed", {
      scored_id: article.scored_id,
      stage: payload.stage,
      reason: payload.reason,
      failed_attempts: upsertRes.failed_attempts,
      promoted_to_permanent: upsertRes.status === "failed_permanent",
    });
    const outcome: ProcessOutcome = {
      kind: "failed",
      stage: payload.stage,
      promoted_to_permanent: upsertRes.status === "failed_permanent",
    };
    return { outcome, tokens };
  } catch (e) {
    // L'UPSERT lui-même plante — fait extrêmement rare (DB down). On loggue
    // le drame, on remonte malgré tout un outcome failed pour que le caller
    // puisse continuer la boucle des autres articles.
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("article_failed_upsert_error", {
      scored_id: article.scored_id,
      original_stage: payload.stage,
      upsert_error: msg,
    });
    const outcome: ProcessOutcome = {
      kind: "failed",
      stage: payload.stage,
      promoted_to_permanent: false,
    };
    return { outcome, tokens };
  }
}

// ---------------------------------------------------------------------------
// Main : processArticle
// ---------------------------------------------------------------------------

/**
 * Traite un article candidat selon la matrice de décision 0bis → 5 :
 *
 *   ÉTAPE 0bis (skip checks)
 *     - !force ET existing.status='active'           → skipped 'already_synthesized'
 *     - !force ET existing.status='failed_permanent' → skipped 'max_attempts_reached'
 *     - status='failed' avec attempts<2 : déjà filtré par le SELECT du caller,
 *       on tombe en étape 0/1 normalement (retry).
 *
 *   ÉTAPE 0 (force reset)
 *     - force=true ET existing → deleteSynthesisAndQuestions(existing.id),
 *       reset attempts à 0 (existing devient null pour la suite).
 *
 *   ÉTAPE 1 (Sonnet + retry tags)
 *     - callSonnetWithRetry → si fail (json_parse|tag_validation|anthropic_call)
 *       → étape 5 (upsertFailedSynthesis avec partial_output pour debug admin).
 *
 *   ÉTAPE 2 (validate quiz)
 *     - validateAndFilterQuestions(output.quiz)
 *     - valid.length < QUESTION_VALID_THRESHOLD (1) → étape 5
 *       stage='no_valid_questions'. partial_output = output (utile admin).
 *
 *   ÉTAPE 3 (embedding)
 *     - text = display_title + "\n" + summary_fr + "\n" + key_figures.join("\n")
 *     - embedText(client, text) → si throw → étape 5 stage='embedding'.
 *
 *   ÉTAPE 4 (INSERT atomique)
 *     - insertSynthesisAndQuestions → si fail (synthesis_insert|question_insert)
 *       → étape 5 (le rollback Option α de persist.ts a déjà supprimé la synth
 *       fraîchement créée si questions ont planté).
 *
 *   ÉTAPE 5 (succeeded)
 *     - log article_succeeded, return { kind: 'succeeded', warnings_count }.
 *
 * Tokens : sonnet_input/output cumulés sur tous les essais (succès ou fail).
 * embedding : 0 si étape non atteinte, sinon usage.total_tokens du dernier appel.
 */
export async function processArticle(
  deps: ProcessDeps,
  article: SelectedArticle,
  lists: TaxonomyLists,
  force: boolean,
): Promise<ProcessReport> {
  const tokens: ProcessReport["tokens"] = {
    sonnet_input: 0,
    sonnet_output: 0,
    embedding: 0,
  };

  // ----- ÉTAPE 0bis : skip checks -----
  const existing = article.existing_synthesis;
  if (!force && existing) {
    if (existing.status === "active") {
      logger.info("article_skipped_idempotent", {
        scored_id: article.scored_id,
        existing_synth_id: existing.id,
      });
      return {
        outcome: { kind: "skipped", reason: "already_synthesized" },
        tokens,
      };
    }
    if (existing.status === "failed_permanent") {
      logger.info("article_skipped_permanent", {
        scored_id: article.scored_id,
        existing_synth_id: existing.id,
        failed_attempts: existing.failed_attempts,
      });
      return {
        outcome: { kind: "skipped", reason: "max_attempts_reached" },
        tokens,
      };
    }
    // status='failed' avec attempts < MAX_FAILED_ATTEMPTS (2) : retry, on
    // continue. Note : si status='retracted' ou 'deleted' transitait ici,
    // on ferait également retry — c'est volontaire (états administratifs
    // qui ne devraient jamais matcher selected donc cas marginal).
  }

  // ----- ÉTAPE 0 : force reset -----
  if (force && existing) {
    const delRes = await deleteSynthesisAndQuestions(deps.supabase, existing.id);
    if (!delRes.ok) {
      logger.error("article_force_reset_failed", {
        scored_id: article.scored_id,
        existing_synth_id: existing.id,
        error: delRes.error,
      });
      // On ne peut pas continuer proprement — l'INSERT en étape 4 risque de
      // créer un doublon (pas de UNIQUE sur scored_id). On remonte un fail
      // synthesis_insert pour rester dans la matrice, et le caller verra
      // dans RunSummary.errors le détail de la cleanup ratée.
      const payload = buildErrorPayload({
        stage: "synthesis_insert",
        reason: `force reset cleanup failed: ${delRes.error}`,
        details: { existing_synth_id: existing.id },
      });
      return persistFailureAndReport(deps, article, payload, null, tokens);
    }
    logger.info("article_force_reset", {
      scored_id: article.scored_id,
      previous_synth_id: existing.id,
    });
    // L'existing est désormais supprimé en BDD. Pour la matrice fail
    // ultérieure, on bascule l'article.existing_synthesis à null (l'objet
    // local reste cohérent — upsertFailedSynthesis fera donc INSERT et non
    // UPDATE).
    article.existing_synthesis = null;
  }

  // ----- ÉTAPE 1 : Sonnet + retry tags -----
  const sonnetRes = await callSonnetWithRetry(deps.anthropic, article, lists);
  tokens.sonnet_input += sonnetRes.tokens.input;
  tokens.sonnet_output += sonnetRes.tokens.output;

  if (!sonnetRes.ok) {
    const payload = buildErrorPayload({
      stage: sonnetRes.stage,
      reason: sonnetRes.errors.slice(0, 3).join("; "),
      details: {
        attempts: sonnetRes.attempts,
        error_count: sonnetRes.errors.length,
        errors: sonnetRes.errors.slice(0, 10),
      },
      sonnet_raw: sonnetRes.sonnet_raw,
    });
    return persistFailureAndReport(
      deps,
      article,
      payload,
      sonnetRes.partial_output, // null sur json_parse/anthropic_call, output sur tag_validation
      tokens,
    );
  }

  const output = sonnetRes.output;

  // ----- ÉTAPE 2 : validate quiz -----
  const filter = validateAndFilterQuestions(output.quiz);
  if (filter.valid.length < QUESTION_VALID_THRESHOLD) {
    const totalReceived = Array.isArray(output.quiz) ? output.quiz.length : 0;
    const payload = buildErrorPayload({
      stage: "no_valid_questions",
      reason: `${filter.valid.length} valid question(s) out of ${totalReceived}`,
      details: {
        valid_count: filter.valid.length,
        total_received: totalReceived,
        warnings: filter.warnings,
      },
      sonnet_raw: sonnetRes.sonnet_raw,
    });
    return persistFailureAndReport(deps, article, payload, output, tokens);
  }

  // ----- ÉTAPE 3 : embedding -----
  let embedding: number[];
  const embedTextStr = buildEmbeddingText(output);
  try {
    embedding = await embedText(deps.openai, embedTextStr);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("embedding_failed", {
      scored_id: article.scored_id,
      text_length: embedTextStr.length,
      error: msg,
    });
    const payload = buildErrorPayload({
      stage: "embedding",
      reason: `embedText failed: ${msg}`,
      details: {
        text_length: embedTextStr.length,
        expected_dimensions: EMBEDDING_DIMENSIONS,
      },
    });
    return persistFailureAndReport(deps, article, payload, output, tokens);
  }
  // Compteur tokens embedding indicatif : text-embedding-3-small ne renvoie
  // pas l'usage exact via embedText (helper minimaliste). On approxime
  // 1 token ≈ 4 chars (heuristique OpenAI standard). Précis à ±15 % en FR ;
  // suffisant pour le suivi cost run_complete (cible <2 €/run).
  tokens.embedding = Math.ceil(embedTextStr.length / 4);

  // ----- ÉTAPE 4 : INSERT atomique -----
  const insertRes = await insertSynthesisAndQuestions(
    deps.supabase,
    article,
    output,
    filter.valid,
    embedding,
    filter.warnings,
  );
  if (!insertRes.ok) {
    const payload = buildErrorPayload({
      stage: insertRes.stage,
      reason: insertRes.error,
      details: {
        valid_question_count: filter.valid.length,
        warnings_count: filter.warnings.length,
      },
    });
    return persistFailureAndReport(deps, article, payload, output, tokens);
  }

  // ----- ÉTAPE 5 : succeeded -----
  logger.info("article_succeeded", {
    scored_id: article.scored_id,
    synth_id: insertRes.synth_id,
    sonnet_attempts: sonnetRes.attempts,
    valid_question_count: filter.valid.length,
    warnings_count: filter.warnings.length,
    tokens_sonnet_input: tokens.sonnet_input,
    tokens_sonnet_output: tokens.sonnet_output,
    tokens_embedding: tokens.embedding,
  });

  return {
    outcome: {
      kind: "succeeded",
      warnings_count: filter.warnings.length,
    },
    tokens,
  };
}
