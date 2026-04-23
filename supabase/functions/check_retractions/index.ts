// Edge Function : check_retractions
//
// Surveillance hebdomadaire des rétractations PubMed (spec §7ter.4).
// Tourne AVANT ingest_pubmed le lundi matin (05h30 vs 06h00 Europe/Paris).
//
// Logique (arbitrée produit — voir échange Ticket 2) :
//
//   Input = PMID (news_raw.external_id) de toute publication PubMed qui :
//     - soit est en Knowledge Base active (news_syntheses.status='active'
//       et news_syntheses.raw_id liée à un news_sources.type='pubmed'),
//     - soit est citée dans un épisode publié (news_episode_items →
//       news_episodes.status='published', via synthesis_id → raw_id).
//
//   Pour chaque PMID dont PubMed renvoie le flag
//   <PublicationType>Retracted Publication</PublicationType> :
//
//     1. TOUJOURS — marquer les synthèses correspondantes :
//        UPDATE news_syntheses
//           SET status='retracted', retracted_at=now()
//         WHERE raw_id IN (SELECT id FROM news_raw
//                          WHERE external_id=PMID AND source is pubmed)
//           AND status='active';
//        (Le filtre status='active' rend l'UPDATE idempotent — un deuxième
//         run n'écrase pas retracted_at d'une synthèse déjà rétractée.)
//        Le déplacement Google Drive vers /_retracted/ sera déclenché par
//        le Ticket 6 via trigger applicatif sur le changement de status.
//
//     2. CONDITIONNEL — si la synthèse (nouvellement rétractée) apparaît
//        dans un news_episode_items dont l'épisode parent a
//        status='published' :
//
//        INSERT INTO news_corrections (
//          episode_id,
//          severity = '3_critique',
//          nature   = 'retraction',     -- colonne `text NOT NULL`, aucun
//                                        -- CHECK/enum côté BDD (cf. Ticket 1
//                                        -- schéma) → valeur libre documentée
//          faulty_script_snapshot = {
//            synthesis_id, raw_id, episode_item_id,
//            pmid, doi, title, source:'pubmed', detected_at
//          }
//        )
//        Idempotence (précision D) : INSERT seulement si aucune ligne
//        news_corrections existante avec
//          - faulty_script_snapshot->>synthesis_id = <synth>
//          - episode_id = <episode>
//          - correction_applied_at IS NULL
//        Cas improbable (rétraction → dé-rétraction → re-rétraction) : une
//        correction précédente déjà appliquée (correction_applied_at NOT NULL)
//        laisse passer un nouvel INSERT.
//
//     3. SINON (article seulement en KB, jamais cité dans un épisode
//        publié) : rien de plus que l'étape 1. Personne à corriger.

import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";
import { ArticleMeta, NcbiClient, extractArticles } from "../_shared/ncbi.ts";

const logger = new Logger("check_retractions");

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RawRef {
  id: string;            // news_raw.id
  external_id: string;   // PubMed PMID
  doi: string | null;
  title: string;
}

interface RetractedSynthesis {
  id: string;
  raw_id: string;
}

interface EpisodeItemRef {
  id: string;            // news_episode_items.id
  episode_id: string;
}

interface RunResult {
  ok: boolean;
  pmids_checked: number;
  pmids_retracted: number;
  syntheses_retracted: number;
  corrections_created: number;
  corrections_dedup: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Candidates loader
// ---------------------------------------------------------------------------

/**
 * Charge l'ensemble des news_raw à vérifier :
 *   A. raw liés à une synthèse status='active' (KB)
 *   B. raw cités dans un épisode status='published' (via synthesis→episode_items)
 * Filtre ensuite par source.type='pubmed' + external_id non-null.
 * Retourne les RawRef uniques, indexés par PMID pour lookup rapide.
 */
async function loadCandidates(
  // deno-lint-ignore no-explicit-any
  supabase: any,
): Promise<Map<string, RawRef>> {
  // --- A. KB active ---------------------------------------------------------
  const { data: kbSyn, error: kbErr } = await supabase
    .from("news_syntheses")
    .select("raw_id")
    .eq("status", "active")
    .not("raw_id", "is", null);
  if (kbErr) throw new Error(`load KB syntheses failed: ${kbErr.message}`);

  // --- B. Synthèses citées dans un épisode publié --------------------------
  const { data: pubItems, error: pubErr } = await supabase
    .from("news_episode_items")
    .select("synthesis_id, episode:news_episodes!inner(status)")
    .not("synthesis_id", "is", null)
    .eq("episode.status", "published");
  if (pubErr) throw new Error(`load published items failed: ${pubErr.message}`);

  // deno-lint-ignore no-explicit-any
  const publishedSynIds = Array.from(new Set((pubItems ?? []).map((r: any) => r.synthesis_id)));

  let pubSyn: { raw_id: string }[] = [];
  if (publishedSynIds.length > 0) {
    const { data, error } = await supabase
      .from("news_syntheses")
      .select("raw_id")
      .in("id", publishedSynIds)
      .not("raw_id", "is", null);
    if (error) throw new Error(`load published syntheses failed: ${error.message}`);
    pubSyn = data ?? [];
  }

  const rawIds = new Set<string>();
  // deno-lint-ignore no-explicit-any
  for (const r of (kbSyn ?? []) as any[]) rawIds.add(r.raw_id);
  for (const r of pubSyn) rawIds.add(r.raw_id);

  if (rawIds.size === 0) return new Map();

  // --- C. Détails raw (external_id, source.type, doi, title) ---------------
  const { data: raws, error: rawErr } = await supabase
    .from("news_raw")
    .select("id, external_id, doi, title, source:news_sources!inner(type)")
    .in("id", Array.from(rawIds))
    .not("external_id", "is", null)
    .eq("source.type", "pubmed");
  if (rawErr) throw new Error(`load raw details failed: ${rawErr.message}`);

  const byPmid = new Map<string, RawRef>();
  // deno-lint-ignore no-explicit-any
  for (const r of (raws ?? []) as any[]) {
    if (!byPmid.has(r.external_id)) {
      byPmid.set(r.external_id, {
        id: r.id,
        external_id: r.external_id,
        doi: r.doi,
        title: r.title,
      });
    }
  }
  return byPmid;
}

// ---------------------------------------------------------------------------
// Retraction actions (per PMID)
// ---------------------------------------------------------------------------

async function retractSyntheses(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  pmid: string,
): Promise<RetractedSynthesis[]> {
  // Étape 1 — UPDATE idempotent : ne touche que les synthèses encore 'active'.
  // raw_id filter : on passe par les news_raw pubmed correspondant au PMID.
  const { data: rawMatches, error: rawErr } = await supabase
    .from("news_raw")
    .select("id, source:news_sources!inner(type)")
    .eq("external_id", pmid)
    .eq("source.type", "pubmed");
  if (rawErr) throw new Error(`lookup raw for PMID ${pmid}: ${rawErr.message}`);
  // deno-lint-ignore no-explicit-any
  const rawIds = ((rawMatches ?? []) as any[]).map((r) => r.id);
  if (rawIds.length === 0) return [];

  const { data: updated, error: updErr } = await supabase
    .from("news_syntheses")
    .update({
      status: "retracted",
      retracted_at: new Date().toISOString(),
    })
    .in("raw_id", rawIds)
    .eq("status", "active")
    .select("id, raw_id");

  if (updErr) throw new Error(`retract syntheses for PMID ${pmid}: ${updErr.message}`);
  return (updated ?? []) as RetractedSynthesis[];
}

async function findPublishedEpisodeItems(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  synthesis_id: string,
): Promise<EpisodeItemRef[]> {
  const { data, error } = await supabase
    .from("news_episode_items")
    .select("id, episode_id, episode:news_episodes!inner(status)")
    .eq("synthesis_id", synthesis_id)
    .eq("episode.status", "published");
  if (error) throw new Error(`lookup episode_items for synth ${synthesis_id}: ${error.message}`);
  // deno-lint-ignore no-explicit-any
  return ((data ?? []) as any[]).map((r) => ({ id: r.id, episode_id: r.episode_id }));
}

/**
 * INSERT news_corrections avec idempotence (précision D) :
 *   - pas d'insert si une ligne existe avec
 *       faulty_script_snapshot->>synthesis_id = synth_id
 *       AND episode_id = episode_id
 *       AND correction_applied_at IS NULL
 * Retourne true si un INSERT a été effectué, false si dédupliqué.
 */
async function insertCorrectionIfAbsent(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  params: {
    synthesis_id: string;
    raw_id: string;
    episode_id: string;
    episode_item_id: string;
    pmid: string;
    doi: string | null;
    title: string;
  },
): Promise<boolean> {
  const { data: existing, error: existErr } = await supabase
    .from("news_corrections")
    .select("id")
    .eq("episode_id", params.episode_id)
    .eq("faulty_script_snapshot->>synthesis_id", params.synthesis_id)
    .is("correction_applied_at", null)
    .limit(1);
  if (existErr) throw new Error(`correction dedup check failed: ${existErr.message}`);
  if (existing && existing.length > 0) return false;

  const snapshot = {
    synthesis_id: params.synthesis_id,
    raw_id: params.raw_id,
    episode_item_id: params.episode_item_id,
    pmid: params.pmid,
    doi: params.doi,
    title: params.title,
    source: "pubmed",
    detected_at: new Date().toISOString(),
  };

  const { error: insErr } = await supabase.from("news_corrections").insert({
    episode_id: params.episode_id,
    severity: "3_critique",
    nature: "retraction",
    faulty_script_snapshot: snapshot,
  });
  if (insErr) throw new Error(`insert correction failed: ${insErr.message}`);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runCheck(): Promise<RunResult> {
  const supabase = getServiceClient();

  const email = Deno.env.get("PUBMED_EMAIL");
  if (!email) throw new Error("PUBMED_EMAIL env var is missing");
  const apiKey = Deno.env.get("PUBMED_API_KEY") || undefined;
  const ncbi = new NcbiClient({ email, apiKey });

  const byPmid = await loadCandidates(supabase);
  const pmids = Array.from(byPmid.keys());
  logger.info("check_start", { pmids_count: pmids.length });

  const result: RunResult = {
    ok: true,
    pmids_checked: pmids.length,
    pmids_retracted: 0,
    syntheses_retracted: 0,
    corrections_created: 0,
    corrections_dedup: 0,
    errors: [],
  };

  if (pmids.length === 0) {
    logger.info("check_end", result);
    return result;
  }

  // EFetch par lots de 200 (NCBI guideline).
  for (const batch of chunk(pmids, 200)) {
    let articles: ArticleMeta[];
    try {
      const xml = await ncbi.eFetch(batch);
      articles = extractArticles(xml);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("efetch_batch_failed", { batch_size: batch.length, error: msg });
      result.errors.push(`efetch batch: ${msg}`);
      continue;
    }

    for (const article of articles) {
      if (!article.retracted) continue;
      result.pmids_retracted++;

      const raw = byPmid.get(article.pmid);
      // raw devrait toujours être présent (l'article vient de nos candidates)
      // ; garde défensive.
      if (!raw) continue;

      try {
        const retracted = await retractSyntheses(supabase, article.pmid);
        result.syntheses_retracted += retracted.length;

        for (const synth of retracted) {
          const items = await findPublishedEpisodeItems(supabase, synth.id);
          for (const item of items) {
            const inserted = await insertCorrectionIfAbsent(supabase, {
              synthesis_id: synth.id,
              raw_id: synth.raw_id,
              episode_id: item.episode_id,
              episode_item_id: item.id,
              pmid: article.pmid,
              doi: raw.doi,
              title: raw.title,
            });
            if (inserted) result.corrections_created++;
            else result.corrections_dedup++;
          }
        }

        logger.info("retraction_handled", {
          pmid: article.pmid,
          syntheses_affected: retracted.map((s) => s.id),
          corrections_created: result.corrections_created,
          corrections_dedup: result.corrections_dedup,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("retraction_failed", { pmid: article.pmid, error: msg });
        result.errors.push(`pmid ${article.pmid}: ${msg}`);
      }
    }
  }

  logger.info("check_end", result);
  return result;
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
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  try {
    const result = await runCheck();
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error("check_failed", { error: message });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
