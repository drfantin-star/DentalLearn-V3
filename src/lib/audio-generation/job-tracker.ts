import { createAdminClient } from '@/lib/supabase/admin'
import type { AudioJobStatus } from '@/types/audio-jobs'
import type { CreateJobOptions, UpdateJobOptions } from './types'

/**
 * Crée un nouveau job en BDD avec status 'pending'.
 * Retourne l'UUID du job créé.
 *
 * Valide la contrainte XOR `exactly_one_target` côté applicatif AVANT l'INSERT
 * pour retourner une erreur plus parlante que le CHECK SQL générique.
 */
export async function createJob(options: CreateJobOptions): Promise<string> {
  const hasSequence = Boolean(options.sequenceId)
  const hasEpisode = Boolean(options.newsEpisodeId)
  if (hasSequence === hasEpisode) {
    throw new Error(
      'createJob: exactly one of sequenceId or newsEpisodeId required'
    )
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('audio_generation_jobs')
    .insert({
      sequence_id: options.sequenceId ?? null,
      news_episode_id: options.newsEpisodeId ?? null,
      triggered_by: options.triggeredBy,
      script_text: options.scriptText,
      with_timestamps: options.withTimestamps,
      status: 'pending',
      retry_count: 0,
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(`createJob: insert failed: ${error.message}`)
  }
  if (!data?.id) {
    throw new Error('createJob: insert returned no id')
  }
  return data.id
}

/**
 * Met à jour le statut et les métadonnées d'un job.
 *
 * - status='running'   → set started_at = now UNIQUEMENT si NULL (préserve
 *                        le premier started_at en cas de re-transition)
 * - status terminal    → set completed_at = now (completed | failed | cancelled)
 * - Les fields optionnels (UpdateJobOptions) sont mappés vers les colonnes
 *   correspondantes ; chunksProcessed/totalChunks sont ignorés (pas en BDD).
 *
 * Throw `Job ${jobId} not found` si aucune ligne n'a été affectée.
 */
export async function updateJobStatus(
  jobId: string,
  status: AudioJobStatus,
  fields?: UpdateJobOptions
): Promise<void> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const updates: Record<string, unknown> = {
    status,
    updated_at: now,
  }

  if (fields?.audioUrl !== undefined) updates.audio_url = fields.audioUrl
  if (fields?.timelineUrl !== undefined) updates.timeline_url = fields.timelineUrl
  if (fields?.durationSec !== undefined) updates.duration_sec = fields.durationSec
  if (fields?.charsConsumed !== undefined) updates.chars_consumed = fields.charsConsumed
  if (fields?.costEur !== undefined) updates.cost_eur = fields.costEur
  if (fields?.errorLog !== undefined) updates.error_log = fields.errorLog

  if (status === 'running') {
    const { data: existing, error: fetchErr } = await supabase
      .from('audio_generation_jobs')
      .select('started_at')
      .eq('id', jobId)
      .maybeSingle()
    if (fetchErr) {
      throw new Error(`updateJobStatus: fetch failed: ${fetchErr.message}`)
    }
    if (!existing) {
      throw new Error(`Job ${jobId} not found`)
    }
    if (!existing.started_at) {
      updates.started_at = now
    }
  }

  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    updates.completed_at = now
  }

  const { data, error } = await supabase
    .from('audio_generation_jobs')
    .update(updates)
    .eq('id', jobId)
    .select('id')

  if (error) {
    throw new Error(`updateJobStatus: update failed: ${error.message}`)
  }
  if (!data || data.length === 0) {
    throw new Error(`Job ${jobId} not found`)
  }
}

/**
 * Marque comme 'failed' les jobs bloqués en status 'running' depuis > 10 min.
 * Appelé par le cron Edge Function sweep-stale-audio-jobs.
 * Retourne le nombre de jobs marqués.
 */
export async function sweepStaleJobs(): Promise<number> {
  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('audio_generation_jobs')
    .update({
      status: 'failed',
      completed_at: now,
      updated_at: now,
      error_log: {
        message: 'Job marked as failed by stale sweep (running > 10 min)',
        timestamp: now,
      },
    })
    .eq('status', 'running')
    .lt('started_at', tenMinAgo)
    .select('id')

  if (error) {
    throw new Error(`sweepStaleJobs: update failed: ${error.message}`)
  }
  return data?.length ?? 0
}
