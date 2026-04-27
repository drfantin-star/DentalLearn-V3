// Edge Function : score_articles
//
// Filtrage LLM Claude Haiku des articles bruts (spec v1.3 §6.3, handoff v1.2 §3
// Ticket 4). Sortie minimale par article :
//   - relevance_score (0-1)
//   - reasoning (texte court FR)
//   - dedupe_hash (SHA256 titre normalisé + DOI)
//   - status : 'candidate' | 'selected' (>= seuil) | 'duplicate'
//
// Le tagging 3 dimensions (specialite/themes/niveau_preuve) est volontairement
// repoussé au Ticket 5 (Sonnet single-call synthesize_articles, arbitrage v1.3
// §6.3+§6.4). news_scored.spe_tags reste donc NULL en sortie de ce ticket.
//
// Déclenchement :
//   - cron Supabase (pg_cron + pg_net) → lundi 14h00 UTC (spec v1.3 §4.4),
//     après ingest_pubmed (04h00 UTC) et ingest_rss (04h30 UTC).
//   - manuel via HTTP POST (re-run / backfill, réservé service_role).
//
// Comportement :
//   1. Charger l'ensemble des hash dedupe_hash déjà présents en news_scored
//      (status != 'duplicate') — sert au cross-source dedup.
//   2. Charger l'ensemble des raw_id déjà scorés (idempotence : un re-run
//      ne re-scorera aucun article).
//   3. SELECT news_raw avec embed news_sources(type), exclure les articles
//      déjà rétractés à l'ingestion (raw_payload->>retracted_at_ingestion=true,
//      cf. Ticket 2). Économie d'appels Haiku — ils seraient écartés en aval.
//   4. Tri : published_at DESC NULLS LAST → source.type='pubmed' first →
//      ingested_at ASC. Pour un dedupe_hash donné, le 1er rencontré gagne
//      (PubMed a la priorité sur RSS pour le même article : DOI fiable +
//      abstract complet). Suivants → INSERT status='duplicate' sans appel LLM.
//   5. Articles uniques regroupés en batches de 10 → appel Haiku par batch.
//   6. Parsing JSON tolérant (3 retries via re-call si malformé). Si échec
//      final, INSERT en status='candidate' score=NULL pour ne pas bloquer
//      le pipeline.
//   7. INSERT news_scored une ligne par article traité.
//
// Logs structurés : run_start, batch_scored, article_failed, parse_retry,
// run_complete (compteurs candidate/selected/duplicate/failed/skipped_retracted
// + tokens cumulés + estimation coût USD/EUR).

import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";
import {
  AnthropicClient,
  AnthropicResponse,
  extractTextContent,
  parseJsonFromText,
} from "../_shared/anthropic.ts";

const logger = new Logger("score_articles");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";
const DEFAULT_THRESHOLD = 0.70;
const BATCH_SIZE = 10;
const MAX_PARSE_RETRIES = 3;
const MAX_OUTPUT_TOKENS = 2048;

// Prix indicatifs Haiku 4.5 (USD/MTok, à ajuster si Anthropic met à jour
// ses tarifs). Sert uniquement à logger un coût estimé en fin de run pour
// le suivi budget Phase 1 (cible Haiku <2 €/sem en régime stationnaire,
// spec v1.3 §9). Le coût réel reste mesurable côté console Anthropic.
const PRICE_INPUT_PER_MTOK_USD = 1.00;
const PRICE_OUTPUT_PER_MTOK_USD = 5.00;
const USD_TO_EUR = 0.92;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawCandidate {
  id: string;
  title: string;
  abstract: string | null;
  doi: string | null;
  journal: string | null;
  published_at: string | null;
  ingested_at: string;
  source_type: string | null;
  is_retracted: boolean;
  dedupe_hash: string;
}

interface ScoreResult {
  /** raw_id (correspond à RawCandidate.id) */
  id: string;
  score: number;
  reasoning: string;
}

interface RunSummary {
  ok: boolean;
  candidates_loaded: number;
  retracted_skipped: number;
  already_scored: number;
  duplicate_inserted: number;
  candidate_inserted: number;
  selected_inserted: number;
  parse_failed: number;
  batches_called: number;
  parse_retries: number;
  tokens_input: number;
  tokens_output: number;
  estimated_cost_usd: number;
  estimated_cost_eur: number;
  threshold: number;
  model: string;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Hash & normalisation
// ---------------------------------------------------------------------------

/**
 * Normalisation du titre pour le hash de dédoublonnage cross-source.
 * Décomposition NFKD + suppression des diacritiques (PubMed et RSS peuvent
 * différer sur les accents) + lowercase + suppression ponctuation + collapse
 * whitespace.
 */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * dedupe_hash = SHA256( normalize(title) | doi_lowercase_or_empty )
 * Le séparateur '|' évite les collisions entre titre+doi et titre+rien.
 */
export async function computeDedupeHash(
  title: string,
  doi: string | null,
): Promise<string> {
  const doiPart = (doi ?? "").trim().toLowerCase();
  return await sha256Hex(`${normalizeTitle(title)}|${doiPart}`);
}

// ---------------------------------------------------------------------------
// Loading
// ---------------------------------------------------------------------------

interface LoadResult {
  candidates: RawCandidate[];
  retracted_skipped: number;
  already_scored: number;
  existing_hashes: Set<string>;
}

async function loadInputs(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<LoadResult> {
  // 1. Hash déjà présents en news_scored (status != 'duplicate') — utilisés
  //    pour basculer en duplicate les nouveaux articles cross-source.
  const { data: existingScored, error: exErr } = await supabase
    .from("news_scored")
    .select("raw_id, dedupe_hash, status")
    .limit(50_000);
  if (exErr) throw new Error(`news_scored fetch failed: ${exErr.message}`);

  const alreadyScoredIds = new Set<string>();
  const existingHashes = new Set<string>();
  // deno-lint-ignore no-explicit-any
  for (const r of (existingScored ?? []) as any[]) {
    if (r.raw_id) alreadyScoredIds.add(r.raw_id);
    if (r.dedupe_hash && r.status !== "duplicate") {
      existingHashes.add(r.dedupe_hash);
    }
  }

  // 2. Articles bruts à considérer.
  const { data: raws, error: rawErr } = await supabase
    .from("news_raw")
    .select(
      "id, title, abstract, doi, journal, published_at, ingested_at, raw_payload, source:news_sources(type)",
    )
    .limit(50_000);
  if (rawErr) throw new Error(`news_raw fetch failed: ${rawErr.message}`);

  let retractedSkipped = 0;
  const candidates: RawCandidate[] = [];

  // deno-lint-ignore no-explicit-any
  for (const r of (raws ?? []) as any[]) {
    if (alreadyScoredIds.has(r.id)) continue;

    const isRetracted = Boolean(
      r.raw_payload &&
        typeof r.raw_payload === "object" &&
        r.raw_payload.retracted_at_ingestion === true,
    );
    if (isRetracted) {
      retractedSkipped++;
      logger.info("article_skipped_retracted", {
        raw_id: r.id,
        external_id: r.raw_payload?.pmid ?? null,
      });
      continue;
    }

    const dedupeHash = await computeDedupeHash(r.title ?? "", r.doi);
    // PostgREST embed FK to-one : selon la version, retourne objet ou array.
    // On normalise défensivement pour éviter de manquer la priorité PubMed
    // au tri de dédoublonnage.
    const srcRaw = r.source;
    const sourceType = Array.isArray(srcRaw)
      ? (srcRaw[0]?.type ?? null)
      : (srcRaw?.type ?? null);
    candidates.push({
      id: r.id,
      title: r.title ?? "",
      abstract: r.abstract,
      doi: r.doi,
      journal: r.journal,
      published_at: r.published_at,
      ingested_at: r.ingested_at,
      source_type: sourceType,
      is_retracted: false,
      dedupe_hash: dedupeHash,
    });
  }

  // 3. Tri imposé par Dr Fantin (cross-source dedup déterministe) :
  //    a. published_at DESC NULLS LAST  (les plus récents d'abord)
  //    b. source.type = 'pubmed' avant les autres (DOI fiable, abstract complet)
  //    c. ingested_at ASC               (égalité résolue par le 1er ingéré)
  candidates.sort((a, b) => {
    const ap = a.published_at ?? "";
    const bp = b.published_at ?? "";
    if (ap !== bp) {
      if (!ap) return 1;
      if (!bp) return -1;
      return ap < bp ? 1 : -1;
    }
    const aIsPubmed = a.source_type === "pubmed" ? 1 : 0;
    const bIsPubmed = b.source_type === "pubmed" ? 1 : 0;
    if (aIsPubmed !== bIsPubmed) return bIsPubmed - aIsPubmed;
    return a.ingested_at < b.ingested_at ? -1 : a.ingested_at > b.ingested_at ? 1 : 0;
  });

  return {
    candidates,
    retracted_skipped: retractedSkipped,
    already_scored: alreadyScoredIds.size,
    existing_hashes: existingHashes,
  };
}

// ---------------------------------------------------------------------------
// Prompt building
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT =
  `Tu es un veilleur scientifique pour Dentalschool, plateforme de formation\n` +
  `continue des chirurgiens-dentistes francophones. Pour chaque article fourni,\n` +
  `tu produis un score de pertinence et une justification courte en français.\n\n` +
  `CRITÈRES DE PERTINENCE (score plus élevé) :\n` +
  `- Pertinent pour la pratique clinique du chirurgien-dentiste.\n` +
  `- Niveau de preuve solide (méta-analyse, RCT, cohorte large, recommandation\n` +
  `  officielle HAS / société savante).\n` +
  `- Sujet d'actualité ou impact pratique direct.\n` +
  `- Spécialités couvertes : endodontie, parodontologie, chirurgie orale,\n` +
  `  implantologie, dentisterie restauratrice et esthétique, prothèse,\n` +
  `  pédodontie, orthodontie, occlusodontie, gérodontologie, santé publique\n` +
  `  dentaire, prévention, actualité professionnelle (réglementaire, syndicats,\n` +
  `  DPC).\n\n` +
  `CRITÈRES DE NON-PERTINENCE (score plus bas) :\n` +
  `- Recherche fondamentale sans application clinique évidente.\n` +
  `- Case report isolé sans portée pédagogique générale.\n` +
  `- Sujet hors champ dentaire.\n` +
  `- Texte trop court ou abstract manquant pour juger sereinement → score\n` +
  `  modéré (~0.30-0.50) et reasoning explicitant l'incertitude.\n\n` +
  `RÈGLES STRICTES :\n` +
  `- Ne jamais inventer une donnée scientifique. Évaluer uniquement sur ce que\n` +
  `  dit le texte source.\n` +
  `- Score sur l'échelle 0.00 à 1.00, deux décimales.\n` +
  `- reasoning : 1 à 2 phrases courtes en français, sans citation directe.\n` +
  `- Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après,\n` +
  `  sans bloc Markdown, conforme au format demandé.\n`;

function buildBatchPrompt(articles: RawCandidate[]): string {
  const blocks = articles.map((a, idx) => {
    const abstractLine = a.abstract && a.abstract.trim().length > 0
      ? a.abstract.trim()
      : "(non renseigné dans la source)";
    return [
      `[Article ${idx + 1}]`,
      `id: ${a.id}`,
      `titre: ${a.title}`,
      `revue: ${a.journal ?? "non renseigné"}`,
      `date: ${a.published_at ?? "non renseigné"}`,
      `abstract: ${abstractLine}`,
    ].join("\n");
  }).join("\n\n");

  return [
    `Voici ${articles.length} article(s) à évaluer. Renvoie un objet JSON conforme au format suivant, avec une entrée par article (même ordre que ci-dessous, en utilisant l'id fourni) :`,
    "",
    `{`,
    `  "results": [`,
    `    { "id": "<id fourni>", "score": 0.00, "reasoning": "Explication courte en français." },`,
    `    ...`,
    `  ]`,
    `}`,
    "",
    blocks,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Scoring batch
// ---------------------------------------------------------------------------

interface BatchOutcome {
  /** Map raw_id → score (présent uniquement si parse réussi pour cet id). */
  scores: Map<string, ScoreResult>;
  /** Nombre de tentatives effectuées (1 = succès au 1er coup). */
  attempts: number;
  parse_failed: boolean;
  tokens_input: number;
  tokens_output: number;
}

async function scoreBatch(
  anthropic: AnthropicClient,
  model: string,
  batch: RawCandidate[],
): Promise<BatchOutcome> {
  const expectedIds = new Set(batch.map((a) => a.id));
  const userPrompt = buildBatchPrompt(batch);

  let attempts = 0;
  let tokensIn = 0;
  let tokensOut = 0;
  let lastError: string | null = null;

  while (attempts < MAX_PARSE_RETRIES) {
    attempts++;
    let res: AnthropicResponse;
    try {
      res = await anthropic.messages({
        model,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
        max_tokens: MAX_OUTPUT_TOKENS,
        temperature: 0,
      });
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
      logger.error("anthropic_call_failed", {
        attempt: attempts,
        batch_size: batch.length,
        error: lastError,
      });
      // Erreur d'appel (réseau / 4xx non retryable / 429 après max retries
      // côté client). On retente l'appel jusqu'à MAX_PARSE_RETRIES.
      continue;
    }

    tokensIn += res.usage?.input_tokens ?? 0;
    tokensOut += res.usage?.output_tokens ?? 0;

    const text = extractTextContent(res);
    const parsed = parseJsonFromText<{ results?: ScoreResult[] }>(text);
    if (!parsed || !Array.isArray(parsed.results)) {
      lastError = `parse failed (no results array)`;
      logger.warn("parse_retry", {
        attempt: attempts,
        batch_size: batch.length,
        text_preview: text.slice(0, 200),
      });
      continue;
    }

    // Construction de la map id → résultat, validation par article.
    const scores = new Map<string, ScoreResult>();
    for (const r of parsed.results) {
      if (!r || typeof r.id !== "string" || !expectedIds.has(r.id)) continue;
      const score = typeof r.score === "number"
        ? r.score
        : parseFloat(String(r.score));
      if (!Number.isFinite(score)) continue;
      const clamped = Math.max(0, Math.min(1, score));
      const reasoning = typeof r.reasoning === "string" && r.reasoning.length > 0
        ? r.reasoning.slice(0, 1000)
        : "(reasoning manquant)";
      scores.set(r.id, { id: r.id, score: clamped, reasoning });
    }

    if (scores.size === batch.length) {
      return {
        scores,
        attempts,
        parse_failed: false,
        tokens_input: tokensIn,
        tokens_output: tokensOut,
      };
    }

    lastError = `parsed ${scores.size}/${batch.length} expected`;
    logger.warn("parse_retry", {
      attempt: attempts,
      batch_size: batch.length,
      parsed_count: scores.size,
      reason: lastError,
    });
    // Si on a au moins quelques résultats partiels, on les garde sur la
    // dernière itération (cf. fallback ci-dessous).
    if (attempts >= MAX_PARSE_RETRIES) {
      return {
        scores,
        attempts,
        parse_failed: true,
        tokens_input: tokensIn,
        tokens_output: tokensOut,
      };
    }
  }

  logger.error("batch_failed", {
    batch_size: batch.length,
    attempts,
    last_error: lastError,
  });
  return {
    scores: new Map(),
    attempts,
    parse_failed: true,
    tokens_input: tokensIn,
    tokens_output: tokensOut,
  };
}

// ---------------------------------------------------------------------------
// Insertion
// ---------------------------------------------------------------------------

interface InsertRow {
  raw_id: string;
  relevance_score: number | null;
  reasoning: string | null;
  dedupe_hash: string | null;
  status: "candidate" | "selected" | "duplicate";
  llm_model: string | null;
  spe_tags: null;
}

async function insertScored(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  row: InsertRow,
): Promise<{ inserted: boolean; error?: string }> {
  const { error } = await supabase.from("news_scored").insert(row);
  if (!error) return { inserted: true };

  // Conflit possible sur news_scored_dedupe_hash_uniq (UNIQUE partial sur
  // dedupe_hash WHERE status != 'duplicate'). Cas rare : course condition
  // entre 2 runs concurrents. On bascule en duplicate pour ne pas perdre
  // l'article.
  if (error.code === "23505") {
    const fallback = {
      ...row,
      status: "duplicate" as const,
      relevance_score: null,
      reasoning: row.reasoning
        ? `[fallback dedup race] ${row.reasoning}`
        : "[fallback dedup race]",
    };
    const { error: err2 } = await supabase.from("news_scored").insert(fallback);
    if (!err2) return { inserted: true };
    return { inserted: false, error: err2.message };
  }
  return { inserted: false, error: error.message };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<RunSummary> {
  const supabase = getServiceClient();
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY env var is missing");
  const anthropic = new AnthropicClient({ apiKey });

  const model = Deno.env.get("NEWS_HAIKU_MODEL") || DEFAULT_MODEL;
  const thresholdRaw = Deno.env.get("NEWS_SCORE_THRESHOLD");
  const threshold = thresholdRaw ? parseFloat(thresholdRaw) : DEFAULT_THRESHOLD;
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error(`NEWS_SCORE_THRESHOLD invalide: ${thresholdRaw}`);
  }

  const summary: RunSummary = {
    ok: true,
    candidates_loaded: 0,
    retracted_skipped: 0,
    already_scored: 0,
    duplicate_inserted: 0,
    candidate_inserted: 0,
    selected_inserted: 0,
    parse_failed: 0,
    batches_called: 0,
    parse_retries: 0,
    tokens_input: 0,
    tokens_output: 0,
    estimated_cost_usd: 0,
    estimated_cost_eur: 0,
    threshold,
    model,
    errors: [],
  };

  logger.info("run_start", { model, threshold });

  const loaded = await loadInputs(supabase);
  summary.candidates_loaded = loaded.candidates.length;
  summary.retracted_skipped = loaded.retracted_skipped;
  summary.already_scored = loaded.already_scored;

  logger.info("inputs_loaded", {
    candidates: loaded.candidates.length,
    already_scored: loaded.already_scored,
    retracted_skipped: loaded.retracted_skipped,
    existing_hashes: loaded.existing_hashes.size,
  });

  // Pré-traitement : isoler les duplicates (cross-source) AVANT l'appel LLM.
  // On scanne dans l'ordre de tri : 1er rencontré pour un hash gagne.
  const seenHashesInRun = new Map<string, string>(); // hash → raw_id gagnant
  const toScore: RawCandidate[] = [];
  const duplicates: { candidate: RawCandidate; winner_raw_id: string }[] = [];

  for (const c of loaded.candidates) {
    const winner = seenHashesInRun.get(c.dedupe_hash);
    if (winner) {
      duplicates.push({ candidate: c, winner_raw_id: winner });
      continue;
    }
    if (loaded.existing_hashes.has(c.dedupe_hash)) {
      // Déjà présent en BDD via un run précédent → status duplicate, pas de
      // pointeur raw_id (le gagnant historique est en BDD). On stocke un
      // pseudo-pointer qui reste informatif côté admin.
      duplicates.push({ candidate: c, winner_raw_id: "(historical run)" });
      continue;
    }
    seenHashesInRun.set(c.dedupe_hash, c.id);
    toScore.push(c);
  }

  // Insertion des duplicates en premier (sans appel LLM).
  for (const dup of duplicates) {
    const ins = await insertScored(supabase, {
      raw_id: dup.candidate.id,
      relevance_score: null,
      reasoning: `Doublon cross-source de raw_id ${dup.winner_raw_id}`,
      dedupe_hash: dup.candidate.dedupe_hash,
      status: "duplicate",
      llm_model: null,
      spe_tags: null,
    });
    if (ins.inserted) summary.duplicate_inserted++;
    else {
      summary.errors.push(`duplicate insert failed (raw_id ${dup.candidate.id}): ${ins.error}`);
      logger.error("article_failed", {
        raw_id: dup.candidate.id,
        stage: "duplicate_insert",
        error: ins.error,
      });
    }
  }

  // Scoring par batches.
  for (let i = 0; i < toScore.length; i += BATCH_SIZE) {
    const batch = toScore.slice(i, i + BATCH_SIZE);
    summary.batches_called++;
    const outcome = await scoreBatch(anthropic, model, batch);
    summary.parse_retries += Math.max(0, outcome.attempts - 1);
    summary.tokens_input += outcome.tokens_input;
    summary.tokens_output += outcome.tokens_output;

    let batchSelected = 0;
    let batchCandidate = 0;
    let batchFailed = 0;

    for (const article of batch) {
      const score = outcome.scores.get(article.id);
      if (score) {
        const status: "candidate" | "selected" =
          score.score >= threshold ? "selected" : "candidate";
        const ins = await insertScored(supabase, {
          raw_id: article.id,
          relevance_score: roundScore(score.score),
          reasoning: score.reasoning,
          dedupe_hash: article.dedupe_hash,
          status,
          llm_model: model,
          spe_tags: null,
        });
        if (ins.inserted) {
          if (status === "selected") {
            batchSelected++;
            summary.selected_inserted++;
          } else {
            batchCandidate++;
            summary.candidate_inserted++;
          }
        } else {
          batchFailed++;
          summary.errors.push(`scored insert failed (raw_id ${article.id}): ${ins.error}`);
          logger.error("article_failed", {
            raw_id: article.id,
            stage: "scored_insert",
            error: ins.error,
          });
        }
      } else {
        // Article non scoré (parse failed après max retries) → fallback
        // candidate score=NULL, le pipeline n'est pas bloqué.
        const ins = await insertScored(supabase, {
          raw_id: article.id,
          relevance_score: null,
          reasoning: "LLM parsing failed after max retries",
          dedupe_hash: article.dedupe_hash,
          status: "candidate",
          llm_model: model,
          spe_tags: null,
        });
        if (ins.inserted) {
          summary.parse_failed++;
          summary.candidate_inserted++;
          batchCandidate++;
          logger.warn("article_failed", {
            raw_id: article.id,
            stage: "llm_parse",
            fallback: "candidate_null",
          });
        } else {
          batchFailed++;
          summary.errors.push(`fallback insert failed (raw_id ${article.id}): ${ins.error}`);
          logger.error("article_failed", {
            raw_id: article.id,
            stage: "fallback_insert",
            error: ins.error,
          });
        }
      }
    }

    logger.info("batch_scored", {
      batch_index: Math.floor(i / BATCH_SIZE),
      batch_size: batch.length,
      attempts: outcome.attempts,
      parse_failed: outcome.parse_failed,
      selected: batchSelected,
      candidate: batchCandidate,
      insert_failed: batchFailed,
      tokens_input: outcome.tokens_input,
      tokens_output: outcome.tokens_output,
    });
  }

  const costUsd =
    (summary.tokens_input / 1_000_000) * PRICE_INPUT_PER_MTOK_USD +
    (summary.tokens_output / 1_000_000) * PRICE_OUTPUT_PER_MTOK_USD;
  summary.estimated_cost_usd = round4(costUsd);
  summary.estimated_cost_eur = round4(costUsd * USD_TO_EUR);

  logger.info("run_complete", summary);
  return summary;
}

function roundScore(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const result = await run();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("run_failed", { error: message });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
