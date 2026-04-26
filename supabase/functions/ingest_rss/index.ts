// Edge Function : ingest_rss
//
// Ingestion hebdomadaire des sources RSS / Atom actives dans news_sources.
// Phase 1 : 4 sources pilotes (Cochrane Oral Health, British Dental Journal,
// HAS — Recommandations, L'Information Dentaire via rss.app).
//
// Déclenchement :
//   - cron Supabase (pg_cron + pg_net) → lundi 04h30 UTC = 06h30 Europe/Paris été
//     (cohérent avec la cadence ingest_pubmed 04h00 UTC, +30 min de marge).
//   - manuel via HTTP POST (re-run ad hoc, réservé service_role).
//
// Comportement :
//   1. SELECT des sources actives type='rss' dans news_sources.
//   2. Pour chaque source :
//      a. Monitoring "silent source" (warn si MAX(news_raw.ingested_at) > 14j et
//         last_fetched_at non NULL — i.e. jamais sur un 1er run).
//      b. fetch (timeout 15s, retry exp 3x sur 5xx/network).
//      c. parse (RSS 2.0 / Atom auto-detect, deno-dom-wasm en text/html).
//      d. INSERT news_raw avec dedup strict (source_id, external_id) via
//         le pattern SELECT puis INSERT + fallback 23505 d'ingest_pubmed.
//      e. UPDATE news_sources.last_fetched_at en cas de succès uniquement
//         (alignement avec ingest_pubmed).
//   3. Toute erreur sur 1 source (timeout, 4xx, 5xx, parse) est loggée et la
//      fonction continue avec les autres sources (ne pas crasher la run entière).
//
// Reference :
//   - Pattern _shared/ncbi.ts (lib pure) reproduit dans _shared/rss.ts.
//   - Colonnes news_raw : cf. RECAP_TICKET_2_NOTES.md §1.
//
// =============================================================================
// AJOUTER UNE NOUVELLE SOURCE RSS EN 5 MINUTES
// =============================================================================
// 1. Identifier l'URL du flux et le format (RSS 2.0 ou Atom 1.0). En cas de
//    doute, ouvrir l'URL dans un navigateur : `<rss>` = RSS 2.0, `<feed>` = Atom.
// 2. Insérer une ligne dans news_sources via SQL Editor :
//
//    INSERT INTO public.news_sources (name, type, url, query, spe_tags, active, notes)
//    VALUES (
//      'Nom Affiché',
//      'rss',
//      'https://exemple.com/feed.xml',
//      '{"feed_url":"https://exemple.com/feed.xml","format":"rss2","accept_types":["article"]}'::jsonb,
//      ARRAY['endo','paro'],   -- slugs de news_taxonomy type=specialite
//      true,
//      'Notes éventuelles : dépendance tierce, fragilité, monitoring spécifique.'
//    )
//    ON CONFLICT (name) DO NOTHING;
//
// 3. Aucun deploy n'est nécessaire — la fonction lit dynamiquement les sources
//    actives à chaque run. Le prochain cron (lundi 04h30 UTC) ingèrera la source.
//    Pour un test immédiat : déclencher manuellement via POST authentifié
//    service_role.
// 4. Vérifier après 1er run :
//    SELECT count(*) FROM news_raw WHERE source_id =
//      (SELECT id FROM news_sources WHERE name = 'Nom Affiché');
// =============================================================================

import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";
import { fetchFeed, parseFeed, RssItem } from "../_shared/rss.ts";

const logger = new Logger("ingest_rss");

const SILENT_SOURCE_THRESHOLD_DAYS = 14;

interface NewsSourceRow {
  id: string;
  name: string;
  url: string | null;
  query: { feed_url?: string; format?: string } | null;
  last_fetched_at: string | null;
}

interface SourceRunResult {
  source_id: string;
  source_name: string;
  feed_format: "rss2" | "atom" | null;
  items_parsed: number;
  items_skipped: number;
  rows_inserted: number;
  rows_duplicate: number;
  silent_source: boolean;
  error: string | null;
}

async function runIngestion(): Promise<{
  ok: boolean;
  sources: SourceRunResult[];
  total_inserted: number;
  total_duplicates: number;
}> {
  const supabase = getServiceClient();

  const { data: sources, error: srcErr } = await supabase
    .from("news_sources")
    .select("id, name, url, query, last_fetched_at")
    .eq("type", "rss")
    .eq("active", true);

  if (srcErr) throw new Error(`news_sources query failed: ${srcErr.message}`);

  logger.info("ingestion_start", { sources_count: sources?.length ?? 0 });

  const results: SourceRunResult[] = [];
  let totalInserted = 0;
  let totalDuplicates = 0;

  for (const src of (sources ?? []) as NewsSourceRow[]) {
    const result = await ingestOneSource(supabase, src);
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
    silent_sources: results.filter((r) => r.silent_source).length,
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
  src: NewsSourceRow,
): Promise<SourceRunResult> {
  const base: SourceRunResult = {
    source_id: src.id,
    source_name: src.name,
    feed_format: null,
    items_parsed: 0,
    items_skipped: 0,
    rows_inserted: 0,
    rows_duplicate: 0,
    silent_source: false,
    error: null,
  };

  const feedUrl = src.query?.feed_url ?? src.url ?? null;
  if (!feedUrl) {
    base.error = "feed_url missing (query.feed_url and url both null)";
    logger.error("source_failed", { source_id: src.id, source_name: src.name, error: base.error });
    return base;
  }

  // Monitoring "silent source" — log only en Phase 1 (handoff §3 Ticket 3 +
  // décision produit "pas d'email Phase 1"). On ne déclenche le warn que
  // pour les sources déjà fetchées au moins une fois (last_fetched_at non
  // NULL) afin de ne pas alerter au tout 1er run.
  if (src.last_fetched_at) {
    const silent = await checkSilentSource(supabase, src.id);
    if (silent.is_silent) {
      base.silent_source = true;
      logger.warn("silent_source", {
        source_id: src.id,
        source_name: src.name,
        last_ingested_at: silent.last_ingested_at,
        days_silent: silent.days_silent,
        threshold_days: SILENT_SOURCE_THRESHOLD_DAYS,
      });
    }
  }

  try {
    const xml = await fetchFeed(feedUrl);
    const parsed = await parseFeed(xml);
    base.feed_format = parsed.format;
    base.items_parsed = parsed.items.length;
    base.items_skipped = parsed.skipped;

    if (parsed.format === null) {
      base.error = "feed_format_unknown (no <rss> nor <feed> root detected)";
      logger.error("parse_failed", {
        source_id: src.id,
        source_name: src.name,
        error: base.error,
      });
      return base;
    }

    for (const item of parsed.items) {
      const { inserted } = await upsertRaw(supabase, src.id, src.name, item);
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

interface SilentCheck {
  is_silent: boolean;
  last_ingested_at: string | null;
  days_silent: number | null;
}

async function checkSilentSource(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  source_id: string,
): Promise<SilentCheck> {
  const { data, error } = await supabase
    .from("news_raw")
    .select("ingested_at")
    .eq("source_id", source_id)
    .order("ingested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    logger.warn("silent_check_failed", { source_id, error: error.message });
    return { is_silent: false, last_ingested_at: null, days_silent: null };
  }
  if (!data) {
    return {
      is_silent: true,
      last_ingested_at: null,
      days_silent: null,
    };
  }
  const last = new Date(data.ingested_at).getTime();
  const days = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
  return {
    is_silent: days > SILENT_SOURCE_THRESHOLD_DAYS,
    last_ingested_at: data.ingested_at,
    days_silent: days,
  };
}

async function upsertRaw(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  source_id: string,
  source_name: string,
  item: RssItem,
): Promise<{ inserted: boolean }> {
  // Dedup strict : (source_id, external_id) UNIQUE.
  // Pattern SELECT puis INSERT + fallback 23505 (ingest_pubmed.upsertRaw).
  const { data: existing, error: existErr } = await supabase
    .from("news_raw")
    .select("id")
    .eq("source_id", source_id)
    .eq("external_id", item.external_id)
    .maybeSingle();

  if (existErr) throw new Error(`news_raw dedup check failed: ${existErr.message}`);
  if (existing) return { inserted: false };

  // title est NOT NULL côté schema. Si le flux n'a pas fourni de titre, on
  // utilise un fallback explicite plutôt qu'échouer la ligne — la traçabilité
  // forensique reste assurée par raw_payload.
  const title = item.title && item.title.length > 0
    ? item.title
    : "[sans titre]";

  const row = {
    source_id,
    external_id: item.external_id,
    doi: null,
    title,
    abstract: item.description,
    authors: item.authors.length > 0 ? item.authors : null,
    journal: source_name,
    published_at: item.published_at,
    url: item.link,
    raw_payload: {
      feed_format: item.feed_format,
      raw_guid: item.raw_guid,
      raw_link: item.raw_link,
      raw_pub_date: item.raw_pub_date,
      external_id_source: item.external_id_source,
    },
  };

  const { error: insErr } = await supabase.from("news_raw").insert(row);
  if (insErr) {
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
