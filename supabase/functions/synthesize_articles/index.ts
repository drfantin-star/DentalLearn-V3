// Edge Function : synthesize_articles
//
// Synthèse + tagging 3D + tagging éditorial v1.3 + display_title + 3-4
// questions quiz + embedding, en un seul appel Sonnet par article sélectionné
// (spec_news_podcast_pipeline_v1_3.md §6.4 + arbitrages produit Ticket 5).
//
// Déclenchement :
//   - cron Supabase (pg_cron + pg_net) → lundi 20h00 UTC (5e job hebdo
//     après check_retractions / ingest_pubmed / ingest_rss / score_articles).
//   - manuel via HTTP POST (re-run, backfill, force=true), réservé service_role.
//
// Body POST (tous champs optionnels) :
//   { "limit": <int 1..15, default 8>, "force": <bool, default false> }
//
// Comportement :
//   1. Auth Bearer SERVICE_ROLE_KEY (sinon 401).
//   2. Charge listes de référence : taxonomy news (3 dimensions),
//      formations.category distinct, category_editorial constants.
//   3. Charge articles candidats :
//        - force=false : status='selected' AND (synth IS NULL OR
//          (synth.status='failed' AND failed_attempts < 2))
//        - force=true  : tous les status='selected' (cleanup étape 0
//          côté processArticle).
//   4. Slice à `limit` après tri scored_at ASC (FIFO — les plus anciens
//      d'abord).
//   5. Boucle await processArticle par article. Chaque article retourne
//      un ProcessReport (outcome + tokens). Cumul tokens + comptage
//      outcomes pour RunSummary final.
//   6. Réponse HTTP 200 avec RunSummary entier (même en échecs partiels —
//      détail dans body + BDD news_syntheses.validation_errors).
//
// Pattern de référence : score_articles/index.ts du Ticket 4 (auth, body
// parsing, secrets, logger, error handling top-level, cap dur sur limit).
//
// Cap dur sur limit : MAX_BATCH_LIMIT=15 (cf types.ts arbitrage A5 +
// leçon Lz1 IDLE_TIMEOUT 150s, Sonnet ~3× plus lent que Haiku).

import { AnthropicClient } from "../_shared/anthropic.ts";
import { OpenAIClient } from "../_shared/openai.ts";
import { Logger } from "../_shared/logger.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { processArticle } from "./article_processor/index.ts";
import {
  CATEGORY_EDITORIAL_VALUES,
  DEFAULT_BATCH_LIMIT,
  EMBEDDING_PRICE_USD_PER_MTOK,
  MAX_BATCH_LIMIT,
  MAX_FAILED_ATTEMPTS,
  SONNET_INPUT_PRICE_USD_PER_MTOK,
  SONNET_OUTPUT_PRICE_USD_PER_MTOK,
  USD_TO_EUR,
} from "./types.ts";
import type {
  ProcessReport,
  RunSummary,
  SelectedArticle,
  TaxonomyLists,
} from "./types.ts";

const logger = new Logger("synthesize_articles");

// ---------------------------------------------------------------------------
// Body parsing — défensif (pattern Ticket 4)
// ---------------------------------------------------------------------------

interface ParsedBody {
  limit: number;
  force: boolean;
}

/**
 * Parse défensif du body POST :
 *   - body absent / vide → defaults.
 *   - JSON malformé → defaults + warn log (ne casse pas le cron qui envoie
 *     un body valide ; protège contre un curl approximatif).
 *   - { "limit": N } avec N entier > 0 → utilisé, cappé à MAX_BATCH_LIMIT.
 *   - { "limit": N } avec N invalide → defaults (ne pas faire planter, le
 *     cron passera quand même).
 *   - { "force": true } → utilisé. Toute autre valeur (1, "true", etc.) → false.
 */
async function parseBody(req: Request): Promise<ParsedBody> {
  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch (e) {
    logger.warn("body_read_failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    return { limit: DEFAULT_BATCH_LIMIT, force: false };
  }
  if (!bodyText.trim()) {
    return { limit: DEFAULT_BATCH_LIMIT, force: false };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch (e) {
    logger.warn("body_parse_failed", {
      error: e instanceof Error ? e.message : String(e),
      preview: bodyText.slice(0, 200),
    });
    return { limit: DEFAULT_BATCH_LIMIT, force: false };
  }

  if (!parsed || typeof parsed !== "object") {
    return { limit: DEFAULT_BATCH_LIMIT, force: false };
  }
  const obj = parsed as Record<string, unknown>;

  // limit
  let limit = DEFAULT_BATCH_LIMIT;
  const rawLimit = obj.limit;
  if (typeof rawLimit === "number" && Number.isInteger(rawLimit) && rawLimit > 0) {
    if (rawLimit > MAX_BATCH_LIMIT) {
      logger.warn("limit_capped", {
        requested: rawLimit,
        applied: MAX_BATCH_LIMIT,
      });
    }
    limit = Math.min(rawLimit, MAX_BATCH_LIMIT);
  } else if (rawLimit !== undefined) {
    logger.warn("body_invalid_limit", {
      raw: rawLimit,
      fallback: DEFAULT_BATCH_LIMIT,
    });
  }

  // force (strict equality avec true — pas de coercion)
  const force = obj.force === true;

  return { limit, force };
}

// ---------------------------------------------------------------------------
// Loading — taxonomy + formations.category
// ---------------------------------------------------------------------------

/**
 * Charge les 3 listes taxonomy news (specialites, themes, niveaux_preuve)
 * en un seul SELECT. Les listes vides sur ≥1 dimension sont une erreur
 * fatale run-level (le pipeline ne peut pas proposer de tags valides à
 * Sonnet) — caller log + return HTTP 500.
 */
async function loadTaxonomy(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<{
  specialites: string[];
  themes: string[];
  niveaux_preuve: string[];
}> {
  const { data, error } = await supabase
    .from("news_taxonomy")
    .select("type, slug")
    .eq("active", true);

  if (error) throw new Error(`loadTaxonomy: ${error.message}`);
  if (!Array.isArray(data)) throw new Error("loadTaxonomy: no data array");

  const specialites: string[] = [];
  const themes: string[] = [];
  const niveaux_preuve: string[] = [];
  // deno-lint-ignore no-explicit-any
  for (const r of data as any[]) {
    if (typeof r?.slug !== "string") continue;
    if (r.type === "specialite") specialites.push(r.slug);
    else if (r.type === "theme") themes.push(r.slug);
    else if (r.type === "niveau_preuve") niveaux_preuve.push(r.slug);
  }
  return { specialites, themes, niveaux_preuve };
}

/**
 * Charge la liste DISTINCT des formations.category non-null. Sert au tag
 * formation_category_match (cf prompts.ts SCHEMA_TEMPLATE).
 *
 * Pas d'erreur fatale si la liste est vide (Sonnet renverra simplement
 * formation_category_match=null systématiquement) — c'est un dégradé
 * acceptable.
 */
async function loadFormationCategories(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("formations")
    .select("category")
    .not("category", "is", null);

  if (error) throw new Error(`loadFormationCategories: ${error.message}`);
  if (!Array.isArray(data)) return [];

  const set = new Set<string>();
  // deno-lint-ignore no-explicit-any
  for (const r of data as any[]) {
    if (typeof r?.category === "string" && r.category.trim()) {
      set.add(r.category.trim());
    }
  }
  return Array.from(set).sort();
}

// ---------------------------------------------------------------------------
// Loading — articles candidats
// ---------------------------------------------------------------------------

interface LoadCandidatesResult {
  /** Articles éligibles selon la matrice 0bis du processArticle, AVANT slice. */
  eligible: SelectedArticle[];
  /** Total éligibles avant slice — sert à RunSummary.total_remaining_estimate. */
  total_remaining_estimate: number;
}

/**
 * Charge tous les news_scored status='selected' avec embed news_raw + LEFT JOIN
 * news_syntheses. Filtrage de la matrice 0bis appliqué côté code (plus simple
 * que via supabase-js sur une condition combinée OR/AND). Pas de RPC requise.
 *
 * Tri : ORDER BY scored_at ASC (FIFO — les articles les plus anciens en file
 * sont traités en premier, évite la famine au backfill).
 */
async function loadCandidates(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  force: boolean,
): Promise<LoadCandidatesResult> {
  // Embed pattern : !inner sur news_raw garantit que l'article a bien un
  // raw associé (sécurité — sinon on ne peut pas envoyer abstract à Sonnet).
  // news_syntheses non-inner : retourne array (0 ou 1 élément) selon
  // l'existence d'une synthèse liée par scored_id.
  const { data, error } = await supabase
    .from("news_scored")
    .select(`
      id,
      raw_id,
      scored_at,
      raw:news_raw!inner(title, abstract, doi, journal, authors, published_at, url),
      syntheses:news_syntheses(id, status, failed_attempts)
    `)
    .eq("status", "selected")
    .order("scored_at", { ascending: true })
    .limit(50_000); // buffer large — on filtre côté code

  if (error) throw new Error(`loadCandidates: ${error.message}`);
  if (!Array.isArray(data)) return { eligible: [], total_remaining_estimate: 0 };

  const eligible: SelectedArticle[] = [];
  // deno-lint-ignore no-explicit-any
  for (const row of data as any[]) {
    const raw = row.raw;
    if (!raw) continue; // sécurité — !inner devrait empêcher ce cas

    const synArr = Array.isArray(row.syntheses) ? row.syntheses : [];
    const syn = synArr[0]; // 0 ou 1 (pas de UNIQUE sur scored_id mais
                            // en pratique le pipeline n'en crée qu'1)

    // Matrice 0bis — filtrage éligibilité
    const isEligible = (() => {
      if (force) return true;
      if (!syn) return true; // jamais tenté
      if (
        syn.status === "failed" &&
        typeof syn.failed_attempts === "number" &&
        syn.failed_attempts < MAX_FAILED_ATTEMPTS
      ) {
        return true; // retry
      }
      return false; // active, failed_permanent, retracted, deleted → skip
    })();

    if (!isEligible) continue;

    eligible.push({
      scored_id: row.id,
      raw_id: row.raw_id,
      title: raw.title ?? "",
      abstract: raw.abstract ?? null,
      doi: raw.doi ?? null,
      journal: raw.journal ?? null,
      authors: Array.isArray(raw.authors) ? raw.authors : null,
      published_at: raw.published_at ?? null,
      url: raw.url ?? null,
      existing_synthesis: syn
        ? {
            id: syn.id,
            status: typeof syn.status === "string" ? syn.status : "failed",
            failed_attempts:
              typeof syn.failed_attempts === "number" ? syn.failed_attempts : 0,
          }
        : null,
    });
  }

  return {
    eligible,
    total_remaining_estimate: eligible.length,
  };
}

// ---------------------------------------------------------------------------
// Cost helpers
// ---------------------------------------------------------------------------

function computeCost(t: ProcessReport["tokens"]): {
  estimated_cost_usd: number;
  estimated_cost_eur: number;
} {
  const usd =
    (t.sonnet_input / 1_000_000) * SONNET_INPUT_PRICE_USD_PER_MTOK +
    (t.sonnet_output / 1_000_000) * SONNET_OUTPUT_PRICE_USD_PER_MTOK +
    (t.embedding / 1_000_000) * EMBEDDING_PRICE_USD_PER_MTOK;
  return {
    estimated_cost_usd: round4(usd),
    estimated_cost_eur: round4(usd * USD_TO_EUR),
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

// ---------------------------------------------------------------------------
// Main run
// ---------------------------------------------------------------------------

async function run(opts: ParsedBody): Promise<RunSummary> {
  const supabase = getServiceClient();

  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY env var is missing");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY env var is missing");

  const anthropic = new AnthropicClient({ apiKey: anthropicKey });
  const openai = new OpenAIClient({ apiKey: openaiKey });

  logger.info("run_start", { limit: opts.limit, force: opts.force });

  // --- Listes de référence ---
  const taxonomy = await loadTaxonomy(supabase);
  if (
    taxonomy.specialites.length === 0 ||
    taxonomy.themes.length === 0 ||
    taxonomy.niveaux_preuve.length === 0
  ) {
    throw new Error(
      `taxonomy empty on at least one dimension: specialites=${taxonomy.specialites.length}, themes=${taxonomy.themes.length}, niveaux_preuve=${taxonomy.niveaux_preuve.length}`,
    );
  }
  const formation_categories = await loadFormationCategories(supabase);
  const lists: TaxonomyLists = {
    specialites: taxonomy.specialites,
    themes: taxonomy.themes,
    niveaux_preuve: taxonomy.niveaux_preuve,
    formation_categories,
    category_editorial: [...CATEGORY_EDITORIAL_VALUES],
  };

  // --- Candidats ---
  const loaded = await loadCandidates(supabase, opts.force);
  const window = loaded.eligible.slice(0, opts.limit);

  logger.info("inputs_loaded", {
    total_remaining_estimate: loaded.total_remaining_estimate,
    limit_applied: opts.limit,
    articles_in_window: window.length,
    has_more: loaded.total_remaining_estimate > opts.limit,
    taxonomy_specialites: taxonomy.specialites.length,
    taxonomy_themes: taxonomy.themes.length,
    taxonomy_niveaux_preuve: taxonomy.niveaux_preuve.length,
    formation_categories: formation_categories.length,
  });

  // --- Boucle articles ---
  let articlesSucceeded = 0;
  let articlesFailed = 0;
  let articlesSkipped = 0;
  let promotedToPermanent = 0;
  const tokensAcc = { sonnet_input: 0, sonnet_output: 0, embedding: 0 };
  const errors: string[] = [];

  for (const article of window) {
    let report: ProcessReport;
    try {
      report = await processArticle(
        { supabase, anthropic, openai },
        article,
        lists,
        opts.force,
      );
    } catch (e) {
      // processArticle est censé ne jamais throw — ce catch est un
      // filet de sécurité (bug imprévu). On compte l'article comme
      // failed run-level et on continue la boucle.
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`processArticle threw on scored_id=${article.scored_id}: ${msg}`);
      logger.error("process_article_uncaught", {
        scored_id: article.scored_id,
        error: msg,
      });
      articlesFailed++;
      continue;
    }

    // Cumul tokens (succès, fail ou skip — skip = {0,0,0})
    tokensAcc.sonnet_input += report.tokens.sonnet_input;
    tokensAcc.sonnet_output += report.tokens.sonnet_output;
    tokensAcc.embedding += report.tokens.embedding;

    // Compteurs outcomes
    switch (report.outcome.kind) {
      case "succeeded":
        articlesSucceeded++;
        break;
      case "failed":
        articlesFailed++;
        if (report.outcome.promoted_to_permanent) promotedToPermanent++;
        break;
      case "skipped":
        articlesSkipped++;
        break;
    }
  }

  // --- RunSummary ---
  const cost = computeCost(tokensAcc);
  const summary: RunSummary = {
    ok: true,
    total_remaining_estimate: loaded.total_remaining_estimate,
    has_more: loaded.total_remaining_estimate > window.length,
    limit_applied: opts.limit,
    force: opts.force,
    articles_processed: window.length,
    articles_succeeded: articlesSucceeded,
    articles_failed: articlesFailed,
    articles_skipped: articlesSkipped,
    promoted_to_permanent: promotedToPermanent,
    tokens_input_sonnet: tokensAcc.sonnet_input,
    tokens_output_sonnet: tokensAcc.sonnet_output,
    tokens_embedding: tokensAcc.embedding,
    estimated_cost_usd: cost.estimated_cost_usd,
    estimated_cost_eur: cost.estimated_cost_eur,
    errors,
  };

  logger.info("run_complete", summary);
  return summary;
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // ----- Auth -----
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  // ----- Parse body -----
  const opts = await parseBody(req);

  // ----- Run -----
  try {
    const result = await run(opts);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    // Filet de sécurité top-level. Les erreurs par-article ne remontent
    // jamais ici (processArticle garantit no-throw, le for-loop catch
    // les exceptions imprévues). Ce catch attrape :
    //   - clé API manquante (ANTHROPIC_API_KEY, OPENAI_API_KEY)
    //   - taxonomy vide sur ≥1 dimension (run impossible)
    //   - erreur DB sur le SELECT loadCandidates
    //   - bug imprévu dans le handler lui-même
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    logger.error("run_failed_top_level", { error: message, stack });
    return new Response(
      JSON.stringify({ ok: false, error: message }),
      {
        status: 500,
        headers: { "content-type": "application/json" },
      },
    );
  }
});
