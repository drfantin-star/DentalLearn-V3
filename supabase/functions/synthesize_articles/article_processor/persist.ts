// Persistence layer pour synthesize_articles — opérations BDD pures isolées.
//
// 3 fonctions exportées :
//   - insertSynthesisAndQuestions : INSERT atomique synth + questions, avec
//     rollback applicatif Option α (DELETE synth si questions plantent).
//   - deleteSynthesisAndQuestions : DELETE questions PUIS synth (ordre
//     critique cf questions_source_check de la migration v1.3 §5.2).
//   - upsertFailedSynthesis : UPDATE par id si existing, sinon INSERT, avec
//     calcul de promotion failed → failed_permanent (cap MAX_FAILED_ATTEMPTS=2).
//
// Audit NOT NULL de news_syntheses (cf 20260423_news_schema.sql lignes 94-124
// + Phase 0bis) :
//   - summary_fr            NOT NULL, pas de DEFAULT  ← seul stub requis
//   - manual_added          NOT NULL DEFAULT false    ← OK
//   - status                NOT NULL DEFAULT 'active' ← override pour fail
//   - created_at            NOT NULL DEFAULT now()    ← OK
//   - failed_attempts       NOT NULL DEFAULT 0        ← override pour fail
// Tout le reste est nullable (specialite, themes, niveau_preuve, embedding,
// etc.) → pour les fail records, on peut laisser NULL si Sonnet n'a pas
// produit de partial output utilisable. Pas besoin de stub taxonomy.
//
// Convention typage : `supabase: any` + deno-lint-ignore (pattern Ticket 4
// score_articles/index.ts) — évite l'import lourd du type SupabaseClient
// du SDK Supabase.

import type {
  ExistingSynthesis,
  NormalizedQuestion,
  QuestionWarning,
  SelectedArticle,
  SonnetSynthesisOutput,
  ValidationErrorPayload,
} from "../types.ts";
import {
  DEFAULT_SONNET_MODEL,
  MAX_FAILED_ATTEMPTS,
  truncateForLog,
} from "../types.ts";

// ---------------------------------------------------------------------------
// Types de retour
// ---------------------------------------------------------------------------

export interface InsertSuccess {
  ok: true;
  synth_id: string;
}

export interface InsertFailure {
  ok: false;
  stage: "synthesis_insert" | "question_insert";
  error: string;
}

export type InsertResult = InsertSuccess | InsertFailure;

export interface UpsertFailureResult {
  /** id de la ligne news_syntheses créée ou mise à jour. */
  synth_id: string;
  /** Statut effectivement persisté (après calcul de promotion). */
  status: "failed" | "failed_permanent";
  /** failed_attempts effectivement persisté. */
  failed_attempts: number;
}

// ---------------------------------------------------------------------------
// 1. INSERT atomique : synth puis questions, avec rollback Option α
// ---------------------------------------------------------------------------

/**
 * Insère 1 ligne news_syntheses (status='active') et N lignes questions
 * liées (news_synthesis_id rempli). En cas d'échec côté questions, rollback
 * applicatif via deleteSynthesisAndQuestions(synth_id) — l'INSERT entier
 * est traité comme une transaction logique (pas de PostgreSQL transaction
 * réelle vu qu'on est sur supabase-js, mais l'effet net est équivalent
 * pour les volumes Phase 1).
 *
 * Tous les champs Sonnet sont passés tels quels (déjà validés par
 * validators.ts en amont). L'embedding est inséré comme number[] —
 * supabase-js sérialise correctement vers le format pgvector.
 */
export async function insertSynthesisAndQuestions(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  article: SelectedArticle,
  output: SonnetSynthesisOutput,
  questions: NormalizedQuestion[],
  embedding: number[],
  warnings: QuestionWarning[],
): Promise<InsertResult> {
  const synthRow = {
    scored_id: article.scored_id,
    raw_id: article.raw_id,
    // Synthèse
    summary_fr: output.summary_fr,
    method: output.method,
    key_figures: output.key_figures,
    evidence_level: output.evidence_level,
    clinical_impact: output.clinical_impact,
    caveats: output.caveats,
    // Tagging 3D
    specialite: output.specialite,
    themes: output.themes,
    niveau_preuve: output.niveau_preuve,
    keywords_libres: output.keywords_libres,
    // Tagging éditorial v1.3
    category_editorial: output.category_editorial,
    formation_category_match: output.formation_category_match,
    display_title: output.display_title,
    // Recherche sémantique
    embedding: embedding,
    // État
    status: "active",
    failed_attempts: 0,
    validation_errors: null,
    validation_warnings: warnings.length > 0 ? warnings : null,
    // Provenance
    manual_added: false,
    llm_model: DEFAULT_SONNET_MODEL,
  };

  // 1. INSERT news_syntheses
  const { data: synthInserted, error: synthErr } = await supabase
    .from("news_syntheses")
    .insert(synthRow)
    .select("id")
    .single();

  if (synthErr || !synthInserted) {
    return {
      ok: false,
      stage: "synthesis_insert",
      error: synthErr?.message ?? "no row returned from synthesis insert",
    };
  }

  const synthId = synthInserted.id as string;

  // 2. INSERT questions (batch). On lie chaque question à la synth fraîche.
  const questionRows = questions.map((q) => ({
    sequence_id: null, // jamais formation pour les news
    news_synthesis_id: synthId,
    question_order: q.question_order,
    question_type: q.question_type,
    question_text: q.question_text,
    options: q.options,
    feedback_correct: q.feedback_correct,
    feedback_incorrect: q.feedback_incorrect,
    points: q.points,
    difficulty: q.difficulty,
    recommended_time_seconds: q.recommended_time_seconds,
    is_daily_quiz_eligible: false, // explicite — default true ne s'applique pas
  }));

  const { error: qErr } = await supabase
    .from("questions")
    .insert(questionRows);

  if (qErr) {
    // Rollback applicatif Option α : on supprime la synth fraîchement créée
    // et toute question éventuellement insérée partiellement (défense en
    // profondeur, supabase-js insert est censé être tout-ou-rien sur un
    // batch mais on reste défensifs).
    await deleteSynthesisAndQuestions(supabase, synthId).catch(() => {
      // Si le rollback fail, on remonte malgré tout l'erreur d'origine —
      // le caller logue les deux côtés via run_summary.errors.
    });
    return {
      ok: false,
      stage: "question_insert",
      error: qErr.message,
    };
  }

  return { ok: true, synth_id: synthId };
}

// ---------------------------------------------------------------------------
// 2. DELETE atomique : questions PUIS synth (ordre critique)
// ---------------------------------------------------------------------------

/**
 * Supprime les questions liées PUIS la synthèse. Ordre critique :
 *
 *   La FK questions.news_synthesis_id a `ON DELETE SET NULL`. Si on
 *   supprimait la synth d'abord, le SET NULL violerait la contrainte
 *   questions_source_check (Phase 0 §5.2) qui exige
 *     (sequence_id IS NOT NULL AND news_synthesis_id IS NULL) OR
 *     (sequence_id IS NULL     AND news_synthesis_id IS NOT NULL)
 *   sur les questions news (sequence_id=NULL + news_synthesis_id qui
 *   passerait à NULL → branch 1 false, branch 2 false → CHECK violée
 *   → DELETE de la synth planterait).
 *
 * Donc on DELETE les questions d'abord (ce qui les fait disparaître,
 * la CHECK n'a plus de sujet à valider), puis la synth.
 *
 * Utilisé par :
 *   - Étape 0 (force=true cleanup) du processArticle
 *   - Rollback Option α de insertSynthesisAndQuestions
 */
export async function deleteSynthesisAndQuestions(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  synthId: string,
): Promise<{ ok: boolean; error?: string }> {
  // 1. DELETE questions liées (peut être 0)
  const { error: qErr } = await supabase
    .from("questions")
    .delete()
    .eq("news_synthesis_id", synthId);
  if (qErr) {
    return { ok: false, error: `delete questions: ${qErr.message}` };
  }

  // 2. DELETE synthèse
  const { error: synthErr } = await supabase
    .from("news_syntheses")
    .delete()
    .eq("id", synthId);
  if (synthErr) {
    return { ok: false, error: `delete synthesis: ${synthErr.message}` };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// 3. UPSERT failure record (UPDATE par id si existing, INSERT sinon)
// ---------------------------------------------------------------------------

/**
 * Persiste un échec de traitement dans news_syntheses. Calcule la promotion
 * failed → failed_permanent selon le cap MAX_FAILED_ATTEMPTS=2 (Phase 0bis) :
 *
 *   previous_attempts=0 → newAttempts=1 → status='failed'
 *   previous_attempts=1 → newAttempts=2 → status='failed_permanent'
 *
 * Stratégie summary_fr (seul NOT NULL sans DEFAULT) :
 *   - Si Sonnet a produit un summary_fr partiel ≥10 chars → on le conserve
 *     préfixé `[FAILED <stage>] ` (utile pour debug admin : on voit ce que
 *     Sonnet a tenté).
 *   - Sinon → placeholder `[FAILED <stage>] <reason tronquée>`.
 *
 * Pas de UNIQUE constraint sur scored_id en BDD → pas de `ON CONFLICT` Postgres.
 * On distingue UPDATE vs INSERT applicativement via `existing` (déjà chargé
 * par le caller dans SelectedArticle.existing_synthesis).
 *
 * Retourne le status + failed_attempts effectivement persistés. Le caller
 * utilise `status === 'failed_permanent'` pour le RunSummary.promoted_to_permanent.
 *
 * Lance une exception si l'UPDATE/INSERT lui-même plante côté BDD — ces
 * erreurs sont fatales pour cet article et seront loggées run-level par
 * le caller dans RunSummary.errors[].
 */
export async function upsertFailedSynthesis(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  article: SelectedArticle,
  errorPayload: ValidationErrorPayload,
  existing: ExistingSynthesis | null,
  /** Output partiel Sonnet si parse a réussi (peut être null sur stage='json_parse'). */
  partialOutput: SonnetSynthesisOutput | null,
): Promise<UpsertFailureResult> {
  const previousAttempts = existing?.failed_attempts ?? 0;
  const newAttempts = previousAttempts + 1;
  const newStatus: "failed" | "failed_permanent" =
    newAttempts >= MAX_FAILED_ATTEMPTS ? "failed_permanent" : "failed";

  // Détermine summary_fr : préserver le partiel Sonnet si disponible et non
  // dégénéré, sinon placeholder. Préfixe [FAILED <stage>] dans tous les cas
  // pour distinguer visuellement en BDD / admin.
  const partialSummary =
    partialOutput?.summary_fr &&
    typeof partialOutput.summary_fr === "string" &&
    partialOutput.summary_fr.trim().length >= 10
      ? partialOutput.summary_fr.trim()
      : null;

  const summaryFr = partialSummary
    ? `[FAILED ${errorPayload.stage}] ${truncateForLog(partialSummary, 1500)}`
    : `[FAILED ${errorPayload.stage}] ${truncateForLog(errorPayload.reason, 500)}`;

  if (existing) {
    // ----- UPDATE par id existant -----
    const updateRow = {
      status: newStatus,
      failed_attempts: newAttempts,
      validation_errors: errorPayload,
      summary_fr: summaryFr,
      llm_model: DEFAULT_SONNET_MODEL,
    };
    const { error: updErr } = await supabase
      .from("news_syntheses")
      .update(updateRow)
      .eq("id", existing.id);
    if (updErr) {
      throw new Error(`upsertFailedSynthesis(update): ${updErr.message}`);
    }
    return {
      synth_id: existing.id,
      status: newStatus,
      failed_attempts: newAttempts,
    };
  }

  // ----- INSERT (pas d'existing) -----
  // Pour les fail records, les colonnes nullable peuvent rester null :
  // specialite/themes/niveau_preuve/keywords_libres/category_editorial/
  // formation_category_match/display_title/embedding sont tous nullable
  // côté schéma. Si on a un partialOutput utilisable, on le conserve pour
  // donner du contexte à l'admin lors du debug post-mortem (notamment
  // utile sur stage='tag_validation' où Sonnet a produit du contenu mais
  // les tags sont hors taxonomy).
  const insertRow = {
    scored_id: article.scored_id,
    raw_id: article.raw_id,
    summary_fr: summaryFr,
    status: newStatus,
    failed_attempts: newAttempts,
    validation_errors: errorPayload,
    llm_model: DEFAULT_SONNET_MODEL,
    manual_added: false,
    // Champs optionnels — copie défensive si Sonnet a produit du partiel
    method: partialOutput?.method ?? null,
    key_figures: partialOutput?.key_figures ?? null,
    evidence_level: partialOutput?.evidence_level ?? null,
    clinical_impact: partialOutput?.clinical_impact ?? null,
    caveats: partialOutput?.caveats ?? null,
    specialite: partialOutput?.specialite ?? null,
    themes: partialOutput?.themes ?? null,
    niveau_preuve: partialOutput?.niveau_preuve ?? null,
    keywords_libres: partialOutput?.keywords_libres ?? null,
    category_editorial: partialOutput?.category_editorial ?? null,
    formation_category_match: partialOutput?.formation_category_match ?? null,
    display_title: partialOutput?.display_title ?? null,
  };

  const { data: inserted, error: insErr } = await supabase
    .from("news_syntheses")
    .insert(insertRow)
    .select("id")
    .single();

  if (insErr || !inserted) {
    throw new Error(
      `upsertFailedSynthesis(insert): ${insErr?.message ?? "no row returned"}`,
    );
  }

  return {
    synth_id: inserted.id as string,
    status: newStatus,
    failed_attempts: newAttempts,
  };
}
