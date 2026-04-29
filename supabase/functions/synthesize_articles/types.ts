// Types partagés entre les modules de synthesize_articles.
//
// Centralise :
//   - Constants & magic numbers (cap retries, limites batch, prix LLM, etc.)
//   - Listes fermées : types de questions autorisés, valeurs category_editorial
//   - Mappings : points par difficulté, recommended_time par type
//   - Types runtime : article candidat, output Sonnet, schémas JSONB
//     validation_errors / validation_warnings (Phase 0bis)
//
// Aucun import de Deno/Supabase ici (pas d'effet de bord) — fichier 100 % types
// pour rester réutilisable dans les tests futurs.

// ---------------------------------------------------------------------------
// Constants — limites & retries (arbitrages produit A4/A5/A8/A9)
// ---------------------------------------------------------------------------

/** Modèle Sonnet figé (arbitrage A1). */
export const DEFAULT_SONNET_MODEL = "claude-sonnet-4-6";

/** Borne par invocation (arbitrage A5).
 *
 * Rappel leçon Lz1 du Ticket 4 : IDLE_TIMEOUT 150s côté Edge Functions.
 * Sonnet est ~3× plus lent que Haiku → bornes plus conservatrices.
 *   default_limit=8  → ~64s en régime stationnaire
 *   max_limit=15     → ~120s, marge serrée mais acceptable. Si timeout
 *                      en backfill, baisser à 12.
 */
export const DEFAULT_BATCH_LIMIT = 8;
export const MAX_BATCH_LIMIT = 15;

/** Nombre maximum de tentatives Sonnet par article (1 essai + 2 retries).
 *
 * Sert UNIQUEMENT au retry sur tagging hors taxonomy (arbitrage A2). Les
 * autres erreurs (parse JSON, embedding fail, INSERT fail) ne re-tentent
 * pas dans la même invocation — elles passent directement en
 * validation_errors et le cap pipeline (failed_attempts < 2) prend le relais
 * au run suivant.
 */
export const MAX_TAG_RETRIES = 3;

/** Cap retries pipeline — promotion failed → failed_permanent (Phase 0bis).
 *
 * failed_attempts=0 → tentative 1 → fail ⇒ failed_attempts=1, status='failed'
 * failed_attempts=1 → tentative 2 → fail ⇒ failed_attempts=2, status='failed_permanent'
 * failed_attempts=2 → skip au prochain run (sauf force=true qui DELETE et reset).
 */
export const MAX_FAILED_ATTEMPTS = 2;

/** max_tokens output Sonnet pour la synthèse complète + 3-4 questions. */
export const SONNET_MAX_TOKENS = 4096;

/** Distribution des questions générées (arbitrage A7). */
export const QUESTION_COUNT_MIN = 3;
export const QUESTION_COUNT_MAX = 4;

/** Seuil minimum de questions valides pour garder la synthèse (arbitrage A3). */
export const QUESTION_VALID_THRESHOLD = 1;

// ---------------------------------------------------------------------------
// Constants — prix LLM (estimation coût pour run_complete)
// ---------------------------------------------------------------------------
//
// Tarifs publiés Anthropic + OpenAI (USD / 1M tokens). Sert uniquement à
// logger un coût estimé en fin de run pour le suivi budget Phase 1
// (cible Sonnet ~7 €/sem en régime stationnaire, spec v1.3 §9).
// Le coût réel reste mesurable côté consoles Anthropic / OpenAI.

export const SONNET_INPUT_PRICE_USD_PER_MTOK = 3.00;
export const SONNET_OUTPUT_PRICE_USD_PER_MTOK = 15.00;
export const EMBEDDING_PRICE_USD_PER_MTOK = 0.02;
export const USD_TO_EUR = 0.92;

// ---------------------------------------------------------------------------
// Listes fermées (arbitrages A6, A10)
// ---------------------------------------------------------------------------

/** Types de questions autorisés pour les news (arbitrage A6/A10). */
export const QUESTION_TYPES_ALLOWED = ["mcq", "true_false", "checkbox"] as const;
export type QuestionType = typeof QUESTION_TYPES_ALLOWED[number];

/** Valeurs autorisées pour news_syntheses.category_editorial (CHECK BDD). */
export const CATEGORY_EDITORIAL_VALUES = [
  "reglementaire",
  "scientifique",
  "pratique",
  "humour",
] as const;
export type CategoryEditorial = typeof CATEGORY_EDITORIAL_VALUES[number];

// ---------------------------------------------------------------------------
// Mappings — A8 (points/difficulty) et A9 (recommended_time/type)
// ---------------------------------------------------------------------------

/** Points par difficulty (arbitrage A8 — plus léger que spec v1.3). */
export const POINTS_BY_DIFFICULTY: Record<1 | 2 | 3, 5 | 10 | 15> = {
  1: 5,
  2: 10,
  3: 15,
};

/** recommended_time_seconds par type de question (arbitrage A9). */
export const TIME_BY_TYPE: Record<QuestionType, 30 | 20 | 45> = {
  mcq: 30,
  true_false: 20,
  checkbox: 45,
};

// ---------------------------------------------------------------------------
// Stages d'erreur — schéma JSONB validation_errors (Phase 0bis)
// ---------------------------------------------------------------------------

/** Stage atteint lors de l'échec de traitement d'un article. Sert au filtrage
 *  admin (vue Quiz / dashboard) et au debug post-mortem via Supabase Logs. */
export type ValidationStage =
  | "json_parse"          // parse JSON Sonnet impossible après MAX_TAG_RETRIES
  | "tag_validation"      // au moins 1 tag hors taxonomy après MAX_TAG_RETRIES
  | "no_valid_questions"  // toutes les questions invalides (<QUESTION_VALID_THRESHOLD)
  | "embedding"           // appel OpenAI embeddings raté après les retries client
  | "synthesis_insert"    // INSERT news_syntheses raté (DB error)
  | "question_insert"     // INSERT questions raté (rollback applicatif déclenché)
  | "anthropic_call";     // appel Sonnet raté APRÈS retries internes 429/5xx
                          //   (timeout abort, 4xx non retryable, réseau cassé).
                          //   Distinct de json_parse : ici on n'a même pas de
                          //   réponse à parser. Sert à filtrer admin
                          //   "transient API down" vs "Sonnet drift".

/** Schéma standardisé du JSONB validation_errors. */
export interface ValidationErrorPayload {
  stage: ValidationStage;
  reason: string;
  details?: Record<string, unknown>;
  /** Output Sonnet brut tronqué à 2000 chars (utile pour stages tag_validation
   *  / json_parse / no_valid_questions). Optionnel pour les stages purement DB. */
  sonnet_raw?: string;
  timestamp: string; // ISO 8601
}

/** Item du JSONB validation_warnings : 1 ligne par question Sonnet rejetée
 *  alors qu'au moins 1 question valide a été conservée. */
export interface QuestionWarning {
  /** Index dans le quiz array Sonnet (0..3). */
  question_index: number;
  /** Raison du rejet (snake_case, énumération ouverte). */
  reason: string;
  /** Question Sonnet originelle, telle qu'elle a été produite. */
  raw: unknown;
}

// ---------------------------------------------------------------------------
// Listes de référence (chargées au début du run)
// ---------------------------------------------------------------------------

export interface TaxonomyLists {
  /** Slugs de news_taxonomy WHERE type='specialite' AND active=true. */
  specialites: string[];
  /** Slugs de news_taxonomy WHERE type='theme' AND active=true. */
  themes: string[];
  /** Slugs de news_taxonomy WHERE type='niveau_preuve' AND active=true. */
  niveaux_preuve: string[];
  /** DISTINCT formations.category WHERE category IS NOT NULL. */
  formation_categories: string[];
  /** Constantes (cf CATEGORY_EDITORIAL_VALUES). */
  category_editorial: readonly string[];
}

// ---------------------------------------------------------------------------
// Article candidat — sortie de loadCandidates
// ---------------------------------------------------------------------------

/** Une ligne news_scored avec status='selected' + son raw + sa synthèse
 *  existante éventuelle (LEFT JOIN). Sert d'input à processArticle.
 */
export interface SelectedArticle {
  /** news_scored.id (clé d'idempotence : news_syntheses.scored_id pointe ici). */
  scored_id: string;
  /** news_raw.id. */
  raw_id: string;
  /** Métadonnées article. */
  title: string;
  abstract: string | null;
  doi: string | null;
  journal: string | null;
  authors: string[] | null;
  published_at: string | null;
  url: string | null;
  /** Synthèse existante (NULL si jamais tenté). */
  existing_synthesis: ExistingSynthesis | null;
}

export interface ExistingSynthesis {
  id: string;
  status: string;
  failed_attempts: number;
}

// ---------------------------------------------------------------------------
// Output Sonnet — schéma JSON cible (cf prompts.ts)
// ---------------------------------------------------------------------------

/** Une question telle que produite par Sonnet (sera validée + normalisée
 *  avant INSERT en BDD). Format options strict : array plat avec correct. */
export interface SonnetQuizQuestion {
  question_type: string;        // attendu : mcq | true_false | checkbox
  question_text: string;
  options: Array<{ id: string; text: string; correct: boolean }>;
  /** Un seul feedback côté Sonnet ; côté DB sera dupliqué en
   *  feedback_correct === feedback_incorrect (règle v1.3). */
  feedback: string;
  difficulty: number; // attendu : 1 | 2 | 3
  /** Source citée (auteurs + journal + année + DOI). Vérifié non vide. */
  source: string;
}

/** Output complet de Sonnet pour un article. */
export interface SonnetSynthesisOutput {
  // Fiche synthèse (FR)
  summary_fr: string;
  method: string | null;
  key_figures: string[] | null;
  evidence_level: string | null;
  clinical_impact: string | null;
  caveats: string | null;
  // Tagging 3D (vocabulaire fermé taxonomy)
  specialite: string;
  themes: string[];
  niveau_preuve: string;
  keywords_libres: string[];
  // Tagging éditorial v1.3
  category_editorial: string;
  formation_category_match: string | null;
  // Affichage
  display_title: string;
  // Quiz (3-4 questions)
  quiz: SonnetQuizQuestion[];
}

// ---------------------------------------------------------------------------
// Question normalisée — prête à INSERT dans public.questions
// ---------------------------------------------------------------------------

/** Structure exacte de la ligne INSERT dans public.questions pour une
 *  question news. Champs alignés sur la table existante :
 *    - sequence_id     : NULL (jamais formation pour les news)
 *    - news_synthesis_id : rempli par insertSynthAndQuestions au INSERT
 *    - is_daily_quiz_eligible : false EXPLICITE (default true ne s'applique pas)
 *    - question_order  : 1..N (ordre de génération)
 *    - options         : JSONB array plat [{id, text, correct}]
 *    - feedback_correct === feedback_incorrect (règle v1.3)
 *    - points          : 5/10/15 selon difficulty (mapping A8)
 *    - recommended_time_seconds : 30/20/45 selon type (mapping A9)
 */
export interface NormalizedQuestion {
  question_type: QuestionType;
  question_text: string;
  options: Array<{ id: string; text: string; correct: boolean }>;
  feedback_correct: string;
  feedback_incorrect: string;
  difficulty: 1 | 2 | 3;
  points: 5 | 10 | 15;
  recommended_time_seconds: 30 | 20 | 45;
  question_order: number;
  is_daily_quiz_eligible: false;
  sequence_id: null;
}

// ---------------------------------------------------------------------------
// ProcessOutcome — sortie de processArticle (granularité fine pour run summary)
// ---------------------------------------------------------------------------

export type ProcessOutcome =
  | { kind: "succeeded"; warnings_count: number }
  | { kind: "failed"; stage: ValidationStage; promoted_to_permanent: boolean }
  | { kind: "skipped"; reason: "already_synthesized" | "max_attempts_reached" };

/**
 * Wrapper retourné par processArticle. Sépare l'outcome (sémantique business)
 * des tokens consommés (télémétrie cost) pour permettre au caller (le run
 * orchestrator dans synthesize_articles/index.ts) de cumuler les tokens
 * sans toucher au discriminated union ProcessOutcome.
 *
 * Pour les outcomes "skipped" : tokens = { 0, 0, 0 } (rien n'est appelé).
 * Pour "failed" stage='anthropic_call' : sonnet_input/output peuvent être
 *   à 0 ou refléter des essais partiels avant l'échec durable.
 * Pour "succeeded" : tokens incluent l'embedding final.
 */
export interface ProcessReport {
  outcome: ProcessOutcome;
  tokens: {
    /** Cumul input tokens Sonnet sur tous les essais (succès ou fail). */
    sonnet_input: number;
    /** Cumul output tokens Sonnet sur tous les essais. */
    sonnet_output: number;
    /** Tokens d'embedding (text-embedding-3-small, ~display+summary+key_figures).
     *  0 si l'étape n'a pas été atteinte (skip / fail avant étape 3). */
    embedding: number;
  };
}

// ---------------------------------------------------------------------------
// Run summary — payload de retour HTTP + log run_complete
// ---------------------------------------------------------------------------

export interface RunSummary {
  ok: boolean;
  /** Articles candidats AU MOMENT du SELECT (avant slice à limit). */
  total_remaining_estimate: number;
  /** true si total_remaining_estimate > limit_applied. Le caller doit reboucler. */
  has_more: boolean;
  /** Borne effectivement appliquée (après cap MAX_BATCH_LIMIT). */
  limit_applied: number;
  force: boolean;
  /** Articles entrés dans le pipeline (= min(total_remaining, limit_applied)). */
  articles_processed: number;
  articles_succeeded: number;
  articles_failed: number;
  articles_skipped: number;
  promoted_to_permanent: number;
  /** Coûts cumulés Sonnet + OpenAI. */
  tokens_input_sonnet: number;
  tokens_output_sonnet: number;
  tokens_embedding: number;
  estimated_cost_usd: number;
  estimated_cost_eur: number;
  /** Erreurs run-level (chargement taxonomy, env vars manquants, OpenAI
   *  quota global, etc.). Les erreurs par-article sont persistées dans
   *  news_syntheses.validation_errors (Phase 0bis). */
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helpers immuables (utilitaires partagés)
// ---------------------------------------------------------------------------

/**
 * Tronque une string à `max` caractères (pour stockage validation_errors.sonnet_raw
 * sans dépasser ~2 ko JSONB sur le payload entier).
 */
export function truncateForLog(s: string, max = 2000): string {
  if (!s) return "";
  return s.length <= max ? s : `${s.slice(0, max)}…[truncated ${s.length - max}]`;
}

/**
 * Tronque un display_title à `max` caractères côté code, ajoute "…" en fin
 * si tronqué. Coupe sur la dernière espace avant max-1 pour éviter de scinder
 * un mot (best effort, fallback sur slice brut si pas d'espace dans la fin
 * de la zone).
 *
 * Pourquoi côté code : Sonnet à temperature=0 ne sait pas compter les
 * caractères de manière fiable et générait régulièrement des display_title
 * de 60-80 chars malgré une consigne ≤70. Forcer le retry tag sur cette
 * contrainte coûtait ~14 centimes Sonnet par article (3 essais perdus).
 * Truncate côté code = filet de sécurité, plus de fail sur cette règle.
 *
 * Le SYSTEM_PROMPT continue à demander "idéalement 60 chars" pour rester
 * dans la cible éditoriale ; le truncate intervient seulement si Sonnet
 * dépasse. La string retournée est trim() en dessous de `max`.
 */
export function truncateDisplayTitle(s: string, max = 70): string {
  const trimmed = s.trim();
  if (trimmed.length <= max) return trimmed;
  const slice = trimmed.slice(0, max - 1); // -1 pour réserver place du "…"
  const lastSpace = slice.lastIndexOf(" ");
  const safe = lastSpace > max - 20 ? slice.slice(0, lastSpace) : slice;
  return `${safe}…`;
}
