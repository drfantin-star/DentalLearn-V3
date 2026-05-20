// Copie locale de supabase/functions/audio-generation-worker/job-tracker.ts.
// Duplication contrôlée — pipeline journal news isolé.

import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";

const logger = new Logger("audio-generation-journal-worker");

export async function markJobRunning(jobId: string): Promise<void> {
  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();

  const { data: existing, error: fetchErr } = await supabase
    .from("audio_generation_jobs")
    .select("started_at")
    .eq("id", jobId)
    .maybeSingle();

  if (fetchErr) {
    logger.warn("job_running_fetch_failed", {
      job_id: jobId,
      error: fetchErr.message,
    });
  }

  const updates: Record<string, unknown> = {
    status: "running",
    updated_at: nowIso,
  };
  if (!existing?.started_at) {
    updates.started_at = nowIso;
  }

  const { error } = await supabase
    .from("audio_generation_jobs")
    .update(updates)
    .eq("id", jobId);
  if (error) {
    logger.warn("job_running_update_failed", {
      job_id: jobId,
      error: error.message,
    });
  }
}

export async function markJobCompleted(
  jobId: string,
  meta: {
    audio_url: string;
    duration_sec: number;
    chars_consumed: number;
    cost_eur: number;
  },
): Promise<void> {
  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();

  const updates: Record<string, unknown> = {
    status: "completed",
    completed_at: nowIso,
    updated_at: nowIso,
    audio_url: meta.audio_url,
    duration_sec: meta.duration_sec,
    chars_consumed: meta.chars_consumed,
    cost_eur: meta.cost_eur,
  };

  const { error } = await supabase
    .from("audio_generation_jobs")
    .update(updates)
    .eq("id", jobId);
  if (error) {
    logger.warn("job_completed_update_failed", {
      job_id: jobId,
      error: error.message,
    });
  }
}

export async function markJobFailed(
  jobId: string,
  message: string,
): Promise<void> {
  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("audio_generation_jobs")
    .update({
      status: "failed",
      completed_at: nowIso,
      updated_at: nowIso,
      error_log: { message, timestamp: nowIso },
    })
    .eq("id", jobId);
  if (error) {
    logger.error("job_failed_update_failed", {
      job_id: jobId,
      error: error.message,
    });
  }
}
