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
// Borne par invocation (`limit`)
// ------------------------------
// Edge Functions Supabase ont un IDLE_TIMEOUT à ~150s. Comme un appel Haiku
// par batch de 10 prend ~10-12s, une invocation peut traiter au maximum
// ~10-12 batches = ~100-120 articles avant de risquer le timeout HTTP.
//
// La borne est paramétrique :
//   - body POST `{"limit": N}` (entier > 0). Cappée silencieusement à
//     MAX_BATCH_LIMIT (200) pour rester sous la limite Edge.
//   - défaut : NEWS_SCORE_BATCH_LIMIT env var (parseInt) ou DEFAULT_BATCH_LIMIT
//     (50) — calibré pour le régime stationnaire (~30-50 articles/sem).
//   - body absent ou JSON malformé → défaut. body avec `limit <= 0` ou
//     non-entier → 400 propre.
//
// Pour le backfill initial (volume ponctuel >100), le caller boucle :
//   while (response.has_more) {
//     curl -X POST ... -d '{"limit": 30}'
//   }
// Le has_more renvoyé dans la réponse JSON (ainsi que total_remaining_estimate)
// permet à la CLI de piloter la boucle sans deviner.
//
// Pas d'auto-réinvocation interne. La gestion de la boucle reste côté caller
// (CLI manuel pour backfill, cron pour la suite).
//
// Comportement :
//   1. RPC count_unscored_articles() — total restant (sans charger les
//      lignes), sert à total_remaining_estimate / has_more.
//   2. HEAD count news_scored — already_scored (monitoring).
//   3. RPC get_unscored_articles(limit) — fenêtre triée + filtrée côté DB :
//      NOT EXISTS news_scored, exclude raw_payload->>retracted_at_ingestion
//      = 'true', tri (published_at DESC NULLS LAST → source.type='pubmed'
//      first → ingested_at ASC), LIMIT limit_count. Cf. migration
//      20260518_rpc_get_unscored_articles.sql.
//   4. SELECT ciblé news_scored WHERE dedupe_hash IN (hashes du tour) AND
//      status != 'duplicate' — existing_hashes pour cross-run dedup.
//   5. Cross-source dedup dans la fenêtre : pour un dedupe_hash donné, le
//      1er rencontré gagne (PubMed a la priorité sur RSS pour le même
//      article : DOI fiable + abstract complet). Suivants → INSERT
//      status='duplicate' sans appel LLM.
//   6. Articles uniques regroupés en batches de 10 → appel Haiku par batch.
//   7. Parsing JSON tolérant (3 retries via re-call si malformé). Si échec
//      final, INSERT en status='candidate' score=NULL pour ne pas bloquer
//      le pipeline.
//   8. INSERT news_scored une ligne par article traité.
//
// Logs structurés : run_start, inputs_loaded (avec limit_applied +
// total_remaining_estimate), parse_retry, anthropic_call_failed,
// batch_scored, article_failed, run_complete (avec has_more + tokens cumulés
// + estimation coût USD/EUR).

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

// Borne par invocation (cf. header §"Borne par invocation").
const DEFAULT_BATCH_LIMIT = 50;
// Cap dur pour rester sous IDLE_TIMEOUT 150s même dans le pire cas
// (200 articles / 10 par batch = 20 appels Haiku × 10s = 200s — dépasse
// déjà le timeout, donc 200 est une limite haute volontairement permissive
// pour les runs locaux ; le caller devrait viser 50-80 max).
const MAX_BATCH_LIMIT = 200;

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
  /** Borne effectivement appliquée à cette invocation (après cap). */
  limit_applied: number;
  /**
   * Nombre d'articles non scorés AU MOMENT du SELECT (avant slice à
   * limit_applied). Inclut les futurs duplicates et les rejetés-rétractés.
   * Sert au caller pour piloter le backfill manuel.
   */
  total_remaining_estimate: number;
  /** true si total_remaining_estimate > limit_applied — le caller doit reboucler. */
  has_more: boolean;
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
  /** Total d'articles non scorés AU MOMENT du SELECT (avant slice). */
  total_remaining: number;
}

/**
 * Charge la fenêtre de travail de l'invocation (au plus `limit` articles
 * non scorés) + les hashes de dédup pertinents.
 *
 * Optimisation T6-fix (mai 2026) : les anciens `SELECT * FROM news_raw` et
 * `SELECT * FROM news_scored` sans filtre (jusqu'à 50 000 lignes chacun)
 * faisaient dépasser IDLE_TIMEOUT 150s avant même le 1er appel Haiku. La
 * version actuelle pousse le NOT EXISTS, le tri et le LIMIT côté Postgres
 * via la RPC get_unscored_articles, et ne charge les existing_hashes que
 * pour les dedupe_hash effectivement présents dans la fenêtre (≤ limit).
 *
 * Cf. migration 20260518_rpc_get_unscored_articles.sql.
 */
async function loadInputs(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  limit: number,
): Promise<LoadResult> {
  // 1. Count rapide des articles non scorés (sert à total_remaining_estimate
  //    / has_more). RPC dédiée — évite de scanner la table côté JS.
  const { data: totalRemaining, error: countErr } = await supabase.rpc(
    "count_unscored_articles",
  );
  if (countErr) {
    throw new Error(`count_unscored_articles failed: ${countErr.message}`);
  }

  // 2. Compte already_scored pour les logs de monitoring. HEAD-only count
  //    (pas de transfert de lignes), résolu via l'index PK news_scored.
  const { count: alreadyScoredCount, error: scoredCountErr } = await supabase
    .from("news_scored")
    .select("id", { head: true, count: "exact" });
  if (scoredCountErr) {
    throw new Error(
      `news_scored count failed: ${scoredCountErr.message}`,
    );
  }

  // 3. Fenêtre d'articles non scorés (déjà triée + filtre retracted côté DB).
  const { data: raws, error: rawErr } = await supabase.rpc(
    "get_unscored_articles",
    { limit_count: limit },
  );
  if (rawErr) throw new Error(`get_unscored_articles failed: ${rawErr.message}`);

  const candidates: RawCandidate[] = [];
  // deno-lint-ignore no-explicit-any
  for (const r of (raws ?? []) as any[]) {
    const dedupeHash = await computeDedupeHash(r.title ?? "", r.doi);
    candidates.push({
      id: r.id,
      title: r.title ?? "",
      abstract: r.abstract,
      doi: r.doi,
      journal: r.journal,
      published_at: r.published_at,
      ingested_at: r.ingested_at,
      source_type: r.source_type ?? null,
      is_retracted: false,
      dedupe_hash: dedupeHash,
    });
  }

  // 4. existing_hashes : chargé UNIQUEMENT sur les hashes calculés depuis la
  //    fenêtre (≤ limit lignes). C'est suffisant pour la détection cross-run
  //    car on cherche uniquement à savoir si l'un des candidats du tour a
  //    déjà un dedupe_hash en BDD (status != 'duplicate').
  const existingHashes = new Set<string>();
  if (candidates.length > 0) {
    const hashes = Array.from(new Set(candidates.map((c) => c.dedupe_hash)));
    const { data: existing, error: exErr } = await supabase
      .from("news_scored")
      .select("dedupe_hash")
      .neq("status", "duplicate")
      .in("dedupe_hash", hashes);
    if (exErr) throw new Error(`news_scored hashes fetch failed: ${exErr.message}`);
    // deno-lint-ignore no-explicit-any
    for (const r of (existing ?? []) as any[]) {
      if (r.dedupe_hash) existingHashes.add(r.dedupe_hash);
    }
  }

  return {
    candidates,
    // Retracted est désormais filtré côté DB par la RPC : on garde la clé
    // à 0 pour compat caller (summary non breaking).
    retracted_skipped: 0,
    already_scored: alreadyScoredCount ?? 0,
    existing_hashes: existingHashes,
    total_remaining: Number(totalRemaining ?? 0),
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

async function run(opts: { limit: number }): Promise<RunSummary> {
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
    limit_applied: opts.limit,
    total_remaining_estimate: 0,
    has_more: false,
    errors: [],
  };

  logger.info("run_start", { model, threshold, limit: opts.limit });

  const loaded = await loadInputs(supabase, opts.limit);
  // total_remaining_estimate vient désormais du count Postgres (RPC) — la
  // RPC get_unscored_articles a déjà LIMITé côté DB, donc loaded.candidates
  // est ≤ opts.limit et ne peut plus servir d'estimation totale.
  summary.total_remaining_estimate = loaded.total_remaining;
  summary.has_more = loaded.total_remaining > opts.limit;

  // Plus de slice côté JS : la RPC a déjà appliqué le LIMIT. Le tri étant
  // global (cf. RPC get_unscored_articles), les articles non traités ce
  // tour seront traités au tour suivant — la cohérence cross-source est
  // préservée par existing_hashes BDD rechargé à chaque invocation
  // (cf. header).
  const window = loaded.candidates;
  summary.candidates_loaded = window.length;
  summary.retracted_skipped = loaded.retracted_skipped;
  summary.already_scored = loaded.already_scored;

  logger.info("inputs_loaded", {
    candidates: window.length,
    total_remaining_estimate: summary.total_remaining_estimate,
    limit_applied: summary.limit_applied,
    has_more: summary.has_more,
    already_scored: loaded.already_scored,
    retracted_skipped: loaded.retracted_skipped,
    existing_hashes: loaded.existing_hashes.size,
  });

  // Pré-traitement : isoler les duplicates (cross-source) AVANT l'appel LLM.
  // On scanne dans l'ordre de tri : 1er rencontré pour un hash gagne.
  const seenHashesInRun = new Map<string, string>(); // hash → raw_id gagnant
  const toScore: RawCandidate[] = [];
  const duplicates: { candidate: RawCandidate; winner_raw_id: string }[] = [];

  for (const c of window) {
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

/**
 * Limite par défaut pour cette invocation, lue depuis l'env. Permet au cron
 * (et au caller) de surcharger la valeur sans modifier le code.
 *
 * Si NEWS_SCORE_BATCH_LIMIT est invalide (non-numérique, négatif, hors cap),
 * on log warn et retombe sur DEFAULT_BATCH_LIMIT pour ne pas casser le cron.
 */
function defaultLimitFromEnv(): number {
  const raw = Deno.env.get("NEWS_SCORE_BATCH_LIMIT");
  if (!raw) return DEFAULT_BATCH_LIMIT;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) {
    logger.warn("env_invalid_limit", {
      var: "NEWS_SCORE_BATCH_LIMIT",
      raw,
      fallback: DEFAULT_BATCH_LIMIT,
    });
    return DEFAULT_BATCH_LIMIT;
  }
  return Math.min(n, MAX_BATCH_LIMIT);
}

type ParsedLimit =
  | { ok: true; limit: number; requested: number | null; capped: boolean }
  | { ok: false; error: string };

/**
 * Parse défensif du body POST :
 *   - body absent / vide → default (env var ou DEFAULT_BATCH_LIMIT).
 *   - JSON malformé → fallback default + log warn (ne bloque pas le cron qui
 *     envoie déjà un body valide ; protège contre un curl approximatif).
 *   - {"limit": N} avec N entier > 0 → utilisé, cappé à MAX_BATCH_LIMIT.
 *   - {"limit": N} avec N <= 0, non-entier ou non-numérique → 400.
 */
async function parseLimitFromBody(req: Request): Promise<ParsedLimit> {
  let bodyText = "";
  try {
    bodyText = await req.text();
  } catch (e) {
    return {
      ok: false,
      error: `failed to read body: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!bodyText.trim()) {
    return { ok: true, limit: defaultLimitFromEnv(), requested: null, capped: false };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch (e) {
    logger.warn("body_parse_failed", {
      error: e instanceof Error ? e.message : String(e),
      preview: bodyText.slice(0, 200),
    });
    return { ok: true, limit: defaultLimitFromEnv(), requested: null, capped: false };
  }
  if (!parsed || typeof parsed !== "object") {
    return { ok: true, limit: defaultLimitFromEnv(), requested: null, capped: false };
  }
  const raw = (parsed as Record<string, unknown>).limit;
  if (raw === undefined) {
    return { ok: true, limit: defaultLimitFromEnv(), requested: null, capped: false };
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return { ok: false, error: `limit must be a positive integer (got ${typeof raw})` };
  }
  if (!Number.isInteger(raw) || raw <= 0) {
    return { ok: false, error: `limit must be a positive integer (got ${raw})` };
  }
  const capped = raw > MAX_BATCH_LIMIT;
  return {
    ok: true,
    limit: Math.min(raw, MAX_BATCH_LIMIT),
    requested: raw,
    capped,
  };
}

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const parsed = await parseLimitFromBody(req);
  if (!parsed.ok) {
    return new Response(JSON.stringify({ ok: false, error: parsed.error }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (parsed.capped) {
    logger.warn("limit_capped", {
      requested_limit: parsed.requested,
      max_batch_limit: MAX_BATCH_LIMIT,
      applied: parsed.limit,
    });
  }

  try {
    const result = await run({ limit: parsed.limit });
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
