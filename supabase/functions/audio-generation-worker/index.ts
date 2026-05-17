// Edge Function : audio-generation-worker
//
// T5-dette (Sprint 4). Contourne le timeout 60 s des fonctions serverless
// Vercel Hobby qui coupait `runGenerationJob` au milieu de l'appel ElevenLabs
// (~60 s) et laissait le job stuck en `running` jusqu'au sweep 10 min.
//
// Déclenchée par la route Vercel POST /api/admin/sequences/[id]/audio/generate
// en fire-and-forget : la route crée le job en BDD puis fire ce worker sans
// attendre la fin. Ce worker s'exécute jusqu'à ~150 s (IDLE_TIMEOUT Supabase
// Edge Function), largement suffisant pour ElevenLabs + upload + UPDATE.
// La page admin polle ensuite /api/admin/audio-jobs/[jobId] pour le résultat.
//
// Pattern strictement aligné sur extract-scenes-formation (T5-bis-B) :
//   - Auth Bearer service_role_key
//   - EdgeRuntime.waitUntil(work) avec fallback @ts-ignore
//   - 202 immédiat
//
// Les helpers (parseDialogueScript, splitIntoChunks, generateDialogueAudio,
// buildTimelineFromAlignment) sont des ports Deno fidèles de
// src/lib/audio-generation/*. Toute itération doit être appliquée aux deux
// copies (drift documenté, comme pour le prompt extract-scenes-formation).

import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";
import { computeScriptStats, parseDialogueScript } from "./parse-dialogue.ts";
import { generateDialogueAudio } from "./elevenlabs.ts";
import { buildTimelineFromAlignment } from "./build-timeline.ts";
import {
  markJobCompleted,
  markJobFailed,
  markJobRunning,
} from "./job-tracker.ts";

const logger = new Logger("audio-generation-worker");

const AUDIO_STORAGE_BUCKET = "formations";
const TIMELINE_STORAGE_BUCKET = "audio-timelines";
const COST_PER_1000_CHARS_EUR = 0.05;
// ElevenLabs /v1/text-to-dialogue sert par défaut du mp3_44100_128 (CBR 128
// kbps). On en déduit la durée audio à partir de la taille du buffer concaténé
// (durée = octets × 8 ÷ bitrate). Précision ~1 frame MP3 (~26 ms), largement
// plus exact que l'estimation chars/min côté Next.js qui ignore speed=1.1 et
// surestime de ~38% (cf. D-S4-05).
const MP3_BITRATE_BPS = 128_000;

interface RequestBody {
  job_id: string;
  sequence_id: string;
  script_text: string;
  with_timestamps: boolean;
  // Sprint 4 T6 — fallback durée quand /v1/text-to-dialogue n'expose pas
  // d'alignment (result.durationSec === 0). Calculé côté Next.js via
  // computeScriptStats(chars / 750 chars-per-min × 60).
  estimated_duration_sec?: number;
}

interface AudioHistoryEntry {
  audio_url: string;
  generated_at: string;
  replaced_at: string | null;
  chars: number;
  cost_eur: number;
}

async function runWorker(body: RequestBody): Promise<void> {
  const { job_id, sequence_id, script_text, with_timestamps } = body;
  const estimatedDurationSec = body.estimated_duration_sec;

  await markJobRunning(job_id);

  const inputs = parseDialogueScript(script_text);
  if (inputs.length === 0) {
    throw new Error("parseDialogueScript: aucune réplique parsée du script");
  }

  const result = await generateDialogueAudio({
    inputs,
    withTimestamps: with_timestamps,
    speed: 1.1,
  });

  const supabase = getServiceClient();
  const stamp = Date.now();

  // 1. Upload audio MP3
  const audioPath = `sequences/${sequence_id}/sequence-${stamp}.mp3`;
  const { error: audioUploadErr } = await supabase.storage
    .from(AUDIO_STORAGE_BUCKET)
    .upload(audioPath, result.audio, {
      contentType: "audio/mpeg",
      upsert: true,
    });
  if (audioUploadErr) {
    throw new Error(
      `audio upload failed (${AUDIO_STORAGE_BUCKET}/${audioPath}): ${audioUploadErr.message}`,
    );
  }
  const { data: audioPub } = supabase.storage
    .from(AUDIO_STORAGE_BUCKET)
    .getPublicUrl(audioPath);
  const audioUrl = audioPub?.publicUrl;
  if (!audioUrl) {
    throw new Error("audio getPublicUrl returned no url");
  }

  // 2. Upload timeline JSON si timestamps disponibles
  // Dette D-S4-T5dette-02 : /v1/text-to-dialogue ignore `with_timestamps` côté
  // ElevenLabs. `mergeChunkResults` retourne quand même un objet `alignment`
  // (avec characters/start/end arrays VIDES) — donc `result.alignment` est
  // truthy même sans timestamps réels. Sans le check `.length > 0`, on upload
  // une timeline avec `transcript.segments = []` qui écrase ensuite la
  // timeline Python (T2) déjà présente dans `sequences.timeline_url`.
  let timelineUrl: string | null = null;
  if (
    with_timestamps &&
    result.alignment &&
    result.alignment.characters.length > 0
  ) {
    const timeline = buildTimelineFromAlignment(
      result,
      audioUrl,
      "formation_sequence",
      sequence_id,
    );
    const timelinePath = `formations/${sequence_id}/timeline-${stamp}.json`;
    const timelineBytes = new TextEncoder().encode(
      JSON.stringify(timeline, null, 2),
    );
    const { error: tlUploadErr } = await supabase.storage
      .from(TIMELINE_STORAGE_BUCKET)
      .upload(timelinePath, timelineBytes, {
        contentType: "application/json",
        upsert: true,
      });
    if (tlUploadErr) {
      throw new Error(
        `timeline upload failed (${TIMELINE_STORAGE_BUCKET}/${timelinePath}): ${tlUploadErr.message}`,
      );
    }
    const { data: tlPub } = supabase.storage
      .from(TIMELINE_STORAGE_BUCKET)
      .getPublicUrl(timelinePath);
    timelineUrl = tlPub?.publicUrl ?? null;
    if (!timelineUrl) {
      throw new Error("timeline getPublicUrl returned no url");
    }
  }

  // 3. Cost
  const stats = computeScriptStats(inputs);
  const charsConsumed = result.totalChars > 0 ? result.totalChars : stats.chars;
  const costEur = (charsConsumed / 1000) * COST_PER_1000_CHARS_EUR;

  // 4. Read current sequence pour build audio_history
  const { data: current, error: readErr } = await supabase
    .from("sequences")
    .select(
      "course_media_url, audio_generated_at, audio_chars_consumed, audio_cost_eur, audio_history, timeline_url",
    )
    .eq("id", sequence_id)
    .maybeSingle();

  if (readErr) {
    throw new Error(`sequence read failed: ${readErr.message}`);
  }
  if (!current) {
    throw new Error(`sequence ${sequence_id} disparue avant UPDATE`);
  }

  const existingHistory: AudioHistoryEntry[] = Array.isArray(
      current.audio_history,
    )
    ? (current.audio_history as AudioHistoryEntry[])
    : [];

  const nowIso = new Date().toISOString();
  const newHistory: AudioHistoryEntry[] =
    typeof current.course_media_url === "string" &&
      current.course_media_url.length > 0
      ? [
        ...existingHistory,
        {
          audio_url: current.course_media_url,
          generated_at: typeof current.audio_generated_at === "string"
            ? current.audio_generated_at
            : nowIso,
          replaced_at: nowIso,
          chars: typeof current.audio_chars_consumed === "number"
            ? current.audio_chars_consumed
            : 0,
          cost_eur: typeof current.audio_cost_eur === "number"
            ? current.audio_cost_eur
            : 0,
        },
      ]
      : existingHistory;

  // 5. UPDATE sequence
  // Dette D-S4-T5dette-02 / D-S4-05 : /v1/text-to-dialogue ne retourne pas
  // d'alignment, donc result.durationSec vaut toujours 0. Cascade de fallback :
  //   1. result.durationSec (alignment réel — n'arrive jamais en pratique)
  //   2. taille du MP3 ÷ bitrate (mesure exacte de l'audio généré)
  //   3. estimated_duration_sec passé par la route (estimation chars/min)
  //   4. 0 (dernier recours)
  const durationFromBytes = result.audio.byteLength > 0
    ? Math.round((result.audio.byteLength * 8) / MP3_BITRATE_BPS)
    : 0;
  const durationSec = result.durationSec > 0
    ? Math.round(result.durationSec)
    : durationFromBytes > 0
    ? durationFromBytes
    : typeof estimatedDurationSec === "number" && estimatedDurationSec > 0
    ? Math.round(estimatedDurationSec)
    : 0;
  const updatePayload: Record<string, unknown> = {
    course_media_url: audioUrl,
    course_media_type: "audio",
    course_duration_seconds: durationSec,
    audio_generated_at: nowIso,
    audio_chars_consumed: charsConsumed,
    audio_cost_eur: costEur,
    audio_history: newHistory,
    updated_at: nowIso,
  };
  if (timelineUrl) {
    updatePayload.timeline_url = timelineUrl;
  }

  const { error: updateErr } = await supabase
    .from("sequences")
    .update(updatePayload)
    .eq("id", sequence_id);

  if (updateErr) {
    throw new Error(`sequence update failed: ${updateErr.message}`);
  }

  // 6. Mark job completed
  await markJobCompleted(job_id, {
    audio_url: audioUrl,
    timeline_url: timelineUrl ?? undefined,
    duration_sec: durationSec,
    chars_consumed: charsConsumed,
    cost_eur: costEur,
  });

  logger.info("generation_succeeded", {
    job_id,
    sequence_id,
    duration_sec: durationSec,
    chars_consumed: charsConsumed,
    total_chunks: result.totalChunks,
    has_timeline: timelineUrl !== null,
  });

  // 7. T7 — Chaining vers extract-scenes-formation. On crée un job dédié
  // `scene_extraction` puis on POST fire-and-forget vers l'Edge Function
  // qui transforme la timeline karaoké brute en timeline structurée
  // (scènes + concepts via Sonnet). Le worker audio est déjà completed :
  // aucune erreur de chaining ne doit faire revenir le job en failed.
  // Pas de await sur le fetch — seul le SYN/handshake TCP est borné à 5 s
  // via AbortSignal, l'exécution Sonnet (~30-45 s) court côté Edge Function.
  if (with_timestamps) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
      const ADMIN_USER_ID = "af506ec2-a281-4485-a504-b0633c8d2362";

      const { data: extractJob, error: insertErr } = await supabase
        .from("audio_generation_jobs")
        .insert({
          sequence_id,
          triggered_by: ADMIN_USER_ID,
          script_text,
          with_timestamps: false,
          job_type: "scene_extraction",
          status: "pending",
        })
        .select("id")
        .single();

      if (insertErr || !extractJob) {
        logger.warn("scene_extraction_job_insert_failed", {
          error: insertErr?.message,
          sequence_id,
        });
      } else {
        fetch(`${supabaseUrl}/functions/v1/extract-scenes-formation`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${serviceKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            job_id: extractJob.id,
            sequence_id,
            script_text,
          }),
          signal: AbortSignal.timeout(5_000),
        }).catch((err: unknown) => {
          logger.warn("scene_extraction_fire_failed", {
            error: err instanceof Error ? err.message : String(err),
            sequence_id,
          });
        });

        logger.info("scene_extraction_fired", {
          extract_job_id: extractJob.id,
          sequence_id,
        });
      }
    } catch (err: unknown) {
      logger.warn("scene_extraction_chaining_error", {
        error: err instanceof Error ? err.message : String(err),
        sequence_id,
      });
    }
  }
}

// Sprint 4 T6 — Chaining batch. À la complétion (succès OU échec) d'un job,
// si batch_id est non-null, fire-and-forget le prochain job pending du même
// batch. Une séquence qui échoue n'arrête donc pas la suite du batch.
// Le sweep stale 10 min reste filet de sécurité si même ce chaining manque.
async function chainNextBatchJob(currentJobId: string): Promise<void> {
  const supabase = getServiceClient();

  const { data: current, error: currentErr } = await supabase
    .from("audio_generation_jobs")
    .select("batch_id, batch_index")
    .eq("id", currentJobId)
    .maybeSingle();

  if (currentErr) {
    logger.error("chain_next_batch_job: current read failed", {
      job_id: currentJobId,
      error: currentErr.message,
    });
    return;
  }
  if (!current || !current.batch_id || current.batch_index === null) {
    return; // Mono-séquence : rien à chaîner.
  }

  const { data: next, error: nextErr } = await supabase
    .from("audio_generation_jobs")
    .select("id, sequence_id, script_text, with_timestamps")
    .eq("batch_id", current.batch_id)
    .eq("status", "pending")
    .gt("batch_index", current.batch_index)
    .order("batch_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (nextErr) {
    logger.error("chain_next_batch_job: next read failed", {
      batch_id: current.batch_id,
      error: nextErr.message,
    });
    return;
  }
  if (!next) {
    logger.info("chain_next_batch_job: batch_complete", {
      batch_id: current.batch_id,
      last_index: current.batch_index,
    });
    return;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) {
    logger.error("chain_next_batch_job: missing env", {
      batch_id: current.batch_id,
    });
    return;
  }

  // Récupère estimated_duration_sec stocké côté Next.js dans script_text ?
  // Non : on n'a pas persisté la durée estimée par job. Le worker recalcule
  // localement via computeScriptStats(parseDialogueScript(script_text)).
  // Plutôt que dupliquer ici, on passe undefined : le UPDATE retombera sur
  // result.durationSec ou 0 si pas d'alignment. Acceptable car la route
  // batch-generate, contrairement à la mono-séquence, est la seule à
  // pousser estimated_duration_sec → on le calcule ici aussi côté worker.
  const localInputs = parseDialogueScript(next.script_text);
  const localStats = computeScriptStats(localInputs);
  const nextEstimatedDurationSec = Math.round(
    localStats.estimatedDurationMin * 60,
  );

  const url = `${supabaseUrl}/functions/v1/audio-generation-worker`;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      job_id: next.id,
      sequence_id: next.sequence_id,
      script_text: next.script_text,
      with_timestamps: next.with_timestamps,
      estimated_duration_sec: nextEstimatedDurationSec,
    }),
  }).catch((err) => {
    logger.error("chain_next_batch_job: fetch failed", {
      batch_id: current.batch_id,
      next_job_id: next.id,
      error: err instanceof Error ? err.message : String(err),
    });
  });

  logger.info("chain_next_batch_job: chained", {
    batch_id: current.batch_id,
    next_job_id: next.id,
    next_index: current.batch_index + 1,
  });
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

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(
      JSON.stringify({ error: "invalid_json" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  if (
    !body ||
    typeof body.job_id !== "string" || body.job_id.length === 0 ||
    typeof body.sequence_id !== "string" || body.sequence_id.length === 0 ||
    typeof body.script_text !== "string" || body.script_text.length === 0 ||
    typeof body.with_timestamps !== "boolean"
  ) {
    return new Response(
      JSON.stringify({
        error: "invalid_body",
        message:
          "job_id, sequence_id, script_text (non-empty strings) and with_timestamps (boolean) are required",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  // Fire-and-forget : on enregistre l'erreur dans le job, on ne propage rien.
  // En fin de vie (succès OU échec), tente le chaining du batch suivant. Si
  // chainNextBatchJob échoue, on log mais on ne propage pas — le filet de
  // sécurité reste sweep-stale-audio-jobs (cron 10 min).
  const work = (async () => {
    try {
      await runWorker(body);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("worker_failed", {
        job_id: body.job_id,
        sequence_id: body.sequence_id,
        error: msg,
      });
      await markJobFailed(body.job_id, msg);
    }
    try {
      await chainNextBatchJob(body.job_id);
    } catch (e) {
      logger.error("chain_next_batch_job: unexpected", {
        job_id: body.job_id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  })();

  // @ts-ignore — EdgeRuntime est injecté par le runtime Supabase et n'est
  // pas typé dans Deno standard. Fallback silencieux si absent (dev local).
  if (
    typeof EdgeRuntime !== "undefined" &&
    typeof EdgeRuntime.waitUntil === "function"
  ) {
    // @ts-ignore
    EdgeRuntime.waitUntil(work);
  }

  return new Response(
    JSON.stringify({ ok: true, job_id: body.job_id, status: "running" }),
    { status: 202, headers: { "content-type": "application/json" } },
  );
});
