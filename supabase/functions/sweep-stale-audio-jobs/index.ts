// Edge Function : sweep-stale-audio-jobs
//
// Appelée par pg_cron toutes les 5 minutes. Marque comme 'failed' les jobs
// `audio_generation_jobs` bloqués en status 'running' depuis plus de 10 min.
//
// Logique inline (réimplémentation de src/lib/audio-generation/job-tracker.ts
// sweepStaleJobs) : les Edge Functions Deno ne peuvent pas importer le code
// Next.js de src/lib.
//
// verify_jwt : false — appelée par pg_cron via net.http_post avec la
// service_role_key en Authorization Bearer. Le flag se passe au déploiement :
//   supabase functions deploy sweep-stale-audio-jobs --no-verify-jwt \
//     --use-api --project-ref dxybsuhfkwuemapqrvgz

import { createClient } from "@supabase/supabase-js";

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

Deno.serve(async (_req) => {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url) throw new Error("SUPABASE_URL env var is missing");
    if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY env var is missing");

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const now = new Date().toISOString();
    const staleBefore = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

    const { data, error } = await supabase
      .from("audio_generation_jobs")
      .update({
        status: "failed",
        completed_at: now,
        updated_at: now,
        error_log: {
          message: "Job marked as failed by stale sweep (running > 10 min)",
          timestamp: now,
        },
      })
      .eq("status", "running")
      .lt("started_at", staleBefore)
      .select("id");

    if (error) {
      throw new Error(`sweep update failed: ${error.message}`);
    }

    const swept = data?.length ?? 0;
    console.log(`Swept ${swept} stale audio jobs`);

    return new Response(JSON.stringify({ swept }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("sweep-stale-audio-jobs failed", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
});
