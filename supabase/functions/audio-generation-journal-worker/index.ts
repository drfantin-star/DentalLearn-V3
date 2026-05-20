// Edge Function : audio-generation-journal-worker
//
// Contourne le timeout 300 s des Vercel Serverless Functions sur la route
// POST /api/admin/news/journal/[id]/generate-audio. Un journal hebdo
// (3 articles, ~1800 mots, 8-12 min audio) dépassait systématiquement les
// 300 s même sur plan Vercel Pro.
//
// Déclenchée par la route Vercel en fire-and-forget : la route crée un row
// dans `audio_generation_jobs` (status='pending', news_episode_id set),
// puis fire ce worker sans attendre la fin. Ce worker tourne jusqu'à
// ~150 s (IDLE_TIMEOUT Supabase Edge Function), largement suffisant pour
// ElevenLabs + upload Storage + UPDATE.
//
// La page admin polle ensuite GET /api/admin/audio-jobs/[jobId]/status pour
// le résultat. La génération de la timeline (mapping déterministe rapide,
// pas d'ElevenLabs) reste côté Vercel Node via la route
// /api/admin/news/journal/[id]/generate-timeline appelée par l'UI après
// succès audio.
//
// Pipeline strictement aligné sur audio-generation-worker (formations) :
//   - Auth Bearer service_role_key
//   - EdgeRuntime.waitUntil(work) avec fallback @ts-ignore
//   - 202 immédiat
//
// Décision utilisateur : duplication contrôlée des helpers (parse-dialogue,
// chunk-dialogue, elevenlabs, job-tracker) plutôt que mutualisation dans
// _shared/. Zéro risque de régression sur le pipeline formations.

import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";
import { computeScriptStats, parseDialogueScript } from "./parse-dialogue.ts";
import { generateDialogueAudio } from "./elevenlabs.ts";
import {
  markJobCompleted,
  markJobFailed,
  markJobRunning,
} from "./job-tracker.ts";

const logger = new Logger("audio-generation-journal-worker");

const AUDIO_STORAGE_BUCKET = "news-audio";
const COST_PER_1000_CHARS_EUR = 0.05;
// ElevenLabs /v1/text-to-dialogue sert par défaut du mp3_44100_128 (CBR
// 128 kbps). Durée = octets × 8 ÷ bitrate.
const MP3_BITRATE_BPS = 128_000;

interface RequestBody {
  job_id: string;
  episode_id: string;
  script_text: string;
  regenerate?: boolean;
}

async function runWorker(body: RequestBody): Promise<void> {
  const { job_id, episode_id, script_text } = body;
  const isRegenerate = body.regenerate === true;

  logger.info("job_start", {
    job_id,
    episode_id,
    script_chars: script_text.length,
    regenerate: isRegenerate,
  });

  await markJobRunning(job_id);

  const inputs = parseDialogueScript(script_text);
  logger.info("inputs_parsed", { job_id, count: inputs.length });
  if (inputs.length === 0) {
    throw new Error("parseDialogueScript: aucune réplique parsée du script");
  }

  logger.info("elevenlabs_start", { job_id, inputs: inputs.length });
  const result = await generateDialogueAudio({
    inputs,
    speed: 1.1,
  });
  logger.info("elevenlabs_done", {
    job_id,
    total_chunks: result.totalChunks,
    total_chars: result.totalChars,
    audio_bytes: result.audio.byteLength,
  });

  if (result.audio.byteLength === 0) {
    throw new Error("ElevenLabs a retourné un buffer audio vide");
  }

  const supabase = getServiceClient();

  // 1. Upload audio MP3 — journal/{episodeId}.mp3 (upsert : supporte la
  //    régénération sans suppression manuelle).
  const audioPath = `journal/${episode_id}.mp3`;
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

  // 2. Durée audio depuis la taille du MP3 (parité avec
  //    src/lib/news/generate-episode-audio.ts).
  const durationSec = Math.max(
    1,
    Math.round((result.audio.byteLength * 8) / MP3_BITRATE_BPS),
  );

  // 3. Cost
  const stats = computeScriptStats(inputs);
  const charsConsumed = result.totalChars > 0 ? result.totalChars : stats.chars;
  const costEur = (charsConsumed / 1000) * COST_PER_1000_CHARS_EUR;

  // 4. UPDATE news_episodes. En régénération : préserver status /
  //    published_at / validated_by. En génération initiale : passer à
  //    'ready' (preview avant publication, /publish reste séparé).
  const nowIso = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    audio_url: audioUrl,
    duration_s: durationSec,
    updated_at: nowIso,
  };
  if (!isRegenerate) {
    updatePayload.status = "ready";
  }

  const { error: updateErr } = await supabase
    .from("news_episodes")
    .update(updatePayload)
    .eq("id", episode_id);

  if (updateErr) {
    throw new Error(`news_episodes update failed: ${updateErr.message}`);
  }

  // 5. Mark job completed. Pas de timeline_url ici — la timeline (mapping
  //    déterministe rapide, <5 s) est générée par l'UI via la route
  //    /api/admin/news/journal/[id]/generate-timeline après que le polling
  //    voit le job en 'completed'.
  await markJobCompleted(job_id, {
    audio_url: audioUrl,
    duration_sec: durationSec,
    chars_consumed: charsConsumed,
    cost_eur: costEur,
  });

  logger.info("generation_succeeded", {
    job_id,
    episode_id,
    duration_sec: durationSec,
    chars_consumed: charsConsumed,
    total_chunks: result.totalChunks,
    regenerate: isRegenerate,
  });
}

Deno.serve(async (req) => {
  try {
    console.log("[worker] handler entered", {
      method: req.method,
      url: req.url,
    });

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
      typeof body.episode_id !== "string" || body.episode_id.length === 0 ||
      typeof body.script_text !== "string" || body.script_text.length === 0
    ) {
      return new Response(
        JSON.stringify({
          error: "invalid_body",
          message:
            "job_id, episode_id, script_text (non-empty strings) required",
        }),
        { status: 400, headers: { "content-type": "application/json" } },
      );
    }

    // Fire-and-forget : on enregistre l'erreur dans le job, on ne propage rien.
    const work = (async () => {
      try {
        await runWorker(body);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logger.error("worker_failed", {
          job_id: body.job_id,
          episode_id: body.episode_id,
          error: msg,
        });
        await markJobFailed(body.job_id, msg);
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
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    console.error("[worker] handler_crash", { error: msg, stack });
    return new Response(
      JSON.stringify({ error: "handler_crash", message: msg }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
});
