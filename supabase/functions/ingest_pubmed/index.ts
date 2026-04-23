// Edge Function : ingest_pubmed
//
// Ingestion hebdomadaire des publications PubMed des 7 derniers jours pour
// chaque source active de type='pubmed' dans news_sources.
//
// Déclenchement :
//   - cron Supabase (pg_cron + pg_net) → lundi 06h00 Europe/Paris
//   - manuel via HTTP POST (pour re-run ad hoc, réservé service_role)
//
// Comportement :
//   1. SELECT des sources actives type='pubmed' + query MeSH.
//   2. Pour chaque source : ESearch (PMIDs) → EFetch (XML) → parse.
//   3. UPSERT dans news_raw avec dedup strict sur (source_id, external_id)
//      via la contrainte news_raw_source_external_uniq (ON CONFLICT DO NOTHING).
//   4. UPDATE news_sources.last_fetched_at à la fin de chaque source.
//   5. Logs structurés : ingested / duplicates / errors par source.
//
// Rate limit NCBI (handoff §4.6) : géré dans NcbiClient (3 req/s sans key,
// 10 req/s avec, backoff exponentiel sur 429/5xx).

import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";
import { ArticleMeta, NcbiClient, extractArticles } from "../_shared/ncbi.ts";

const logger = new Logger("ingest_pubmed");

interface NewsSourceRow {
  id: string;
  name: string;
  query: { term?: string } | null;
}

interface SourceRunResult {
  source_id: string;
  source_name: string;
  pmids_found: number;
  articles_parsed: number;
  rows_inserted: number;
  rows_duplicate: number;
  error: string | null;
}

async function runIngestion(): Promise<{
  ok: boolean;
  sources: SourceRunResult[];
  total_inserted: number;
  total_duplicates: number;
}> {
  const supabase = getServiceClient();

  const email = Deno.env.get("PUBMED_EMAIL");
  if (!email) throw new Error("PUBMED_EMAIL env var is missing");
  const apiKey = Deno.env.get("PUBMED_API_KEY") || undefined;

  const ncbi = new NcbiClient({ email, apiKey });

  const { data: sources, error: srcErr } = await supabase
    .from("news_sources")
    .select("id, name, query")
    .eq("type", "pubmed")
    .eq("active", true);

  if (srcErr) throw new Error(`news_sources query failed: ${srcErr.message}`);

  logger.info("ingestion_start", { sources_count: sources?.length ?? 0 });

  const results: SourceRunResult[] = [];
  let totalInserted = 0;
  let totalDuplicates = 0;

  for (const src of (sources ?? []) as NewsSourceRow[]) {
    const result = await ingestOneSource(supabase, ncbi, src);
    results.push(result);
    totalInserted += result.rows_inserted;
    totalDuplicates += result.rows_duplicate;
    logger.info("source_done", result);
  }

  logger.info("ingestion_end", {
    sources_count: results.length,
    total_inserted: totalInserted,
    total_duplicates: totalDuplicates,
    sources_with_errors: results.filter((r) => r.error).length,
  });

  return {
    ok: true,
    sources: results,
    total_inserted: totalInserted,
    total_duplicates: totalDuplicates,
  };
}

async function ingestOneSource(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  ncbi: NcbiClient,
  src: NewsSourceRow,
): Promise<SourceRunResult> {
  const base: SourceRunResult = {
    source_id: src.id,
    source_name: src.name,
    pmids_found: 0,
    articles_parsed: 0,
    rows_inserted: 0,
    rows_duplicate: 0,
    error: null,
  };

  const term = src.query?.term;
  if (!term) {
    base.error = "query.term missing";
    return base;
  }

  try {
    // Restreindre aux 7 derniers jours (handoff §3 Ticket 2A).
    // Si la source fournit déjà "last 7 days"[DP] on ne double pas.
    const query = term.includes("[DP]")
      ? term
      : `(${term}) AND ("last 7 days"[DP])`;

    const search = await ncbi.eSearch(query, 200);
    base.pmids_found = search.pmids.length;
    if (search.pmids.length === 0) {
      await touchSourceFetched(supabase, src.id);
      return base;
    }

    // EFetch accepte jusqu'à 200 PMID par appel. On découpe par lot.
    const batches = chunk(search.pmids, 200);
    const articles: ArticleMeta[] = [];
    for (const batch of batches) {
      const xml = await ncbi.eFetch(batch);
      articles.push(...extractArticles(xml));
    }
    base.articles_parsed = articles.length;

    for (const a of articles) {
      const { inserted } = await upsertRaw(supabase, src.id, a);
      if (inserted) base.rows_inserted++;
      else base.rows_duplicate++;
    }

    await touchSourceFetched(supabase, src.id);
    return base;
  } catch (e) {
    base.error = e instanceof Error ? e.message : String(e);
    logger.error("source_failed", { source_id: src.id, source_name: src.name, error: base.error });
    return base;
  }
}

async function upsertRaw(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  source_id: string,
  a: ArticleMeta,
): Promise<{ inserted: boolean }> {
  // Dedup strict : (source_id, external_id) UNIQUE.
  // .upsert avec ignoreDuplicates=true + select count : on distingue insert
  // vs no-op en interrogeant d'abord si la ligne existe.
  const { data: existing, error: existErr } = await supabase
    .from("news_raw")
    .select("id")
    .eq("source_id", source_id)
    .eq("external_id", a.pmid)
    .maybeSingle();

  if (existErr) throw new Error(`news_raw dedup check failed: ${existErr.message}`);
  if (existing) return { inserted: false };

  const row = {
    source_id,
    external_id: a.pmid,
    doi: a.doi,
    title: a.title,
    abstract: a.abstract,
    authors: a.authors.length > 0 ? a.authors : null,
    journal: a.journal,
    published_at: a.publishedAt,
    url: `https://pubmed.ncbi.nlm.nih.gov/${a.pmid}/`,
    raw_payload: {
      pmid: a.pmid,
      doi: a.doi,
      retracted_at_ingestion: a.retracted,
    },
  };

  const { error: insErr } = await supabase.from("news_raw").insert(row);
  if (insErr) {
    // Race condition possible : si un autre run a inséré entre le SELECT et
    // l'INSERT, la contrainte UNIQUE produit 23505 → on compte en duplicate.
    if (insErr.code === "23505") return { inserted: false };
    throw new Error(`news_raw insert failed: ${insErr.message}`);
  }
  return { inserted: true };
}

async function touchSourceFetched(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  source_id: string,
): Promise<void> {
  const { error } = await supabase
    .from("news_sources")
    .update({ last_fetched_at: new Date().toISOString() })
    .eq("id", source_id);
  if (error) logger.warn("touch_source_failed", { source_id, error: error.message });
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Auth : seul le service_role peut déclencher manuellement. Le cron pg_net
  // envoie l'Authorization avec la service_role key (cf. migration cron).
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const result = await runIngestion();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("ingestion_failed", { error: message });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
