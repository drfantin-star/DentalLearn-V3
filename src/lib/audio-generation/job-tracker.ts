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
  const hasSeq =
    typeof options.sequenceId === 'string' && options.sequenceId.length > 0
  const hasNews =
    typeof options.newsEpisodeId === 'string' &&
    options.newsEpisodeId.length > 0
  if (hasSeq === hasNews) {
    throw new Error(
      'createJob: exactly one of sequenceId or newsEpisodeId required'
    )
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('audio_generation_jobs')
    .insert({
      sequence_id: options.sequenceId ?? null,
      news_episode_id: options.newsEpisodeId ?? null,
      triggered_by: options.triggeredBy,
      script_text: options.scriptText,
      with_timestamps: options.withTimestamps,
      status: 'pending' as AudioJobStatus,
      retry_count: 0,
    })
    .select('id')

  if (error) {
    throw new Error(`createJob: insert failed: ${error.message}`)
  }
  const row = data?.[0]
  if (!row?.id) {
    throw new Error('createJob: insert returned no row')
  }
  return row.id as string
}

/**
 * Met à jour le statut et les métadonnées d'un job.
 *
 * - status='running'   → set started_at = now (toujours réécrit ; le trigger
 *                        updated_at gère le timestamp)
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
  const nowIso = new Date().toISOString()
  const update: Record<string, unknown> = {
    status,
    updated_at: nowIso,
  }
  if (status === 'running') {
    update.started_at = nowIso
  }
  if (status === 'completed' || status === 'failed' || status === 'cancelled') {
    update.completed_at = nowIso
  }
  if (fields) {
    if (fields.audioUrl !== undefined) update.audio_url = fields.audioUrl
    if (fields.timelineUrl !== undefined)
      update.timeline_url = fields.timelineUrl
    if (fields.durationSec !== undefined)
      update.duration_sec = fields.durationSec
    if (fields.charsConsumed !== undefined)
      update.chars_consumed = fields.charsConsumed
    if (fields.costEur !== undefined) update.cost_eur = fields.costEur
    if (fields.errorLog !== undefined) update.error_log = fields.errorLog
    // chunksProcessed / totalChunks volontairement ignorés — pas de colonnes
    // dédiées sur audio_generation_jobs (la progression est suivie autrement
    // côté worker, cf. Sprint 4 T4).
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('audio_generation_jobs')
    .update(update)
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
  const nowIso = new Date().toISOString()
  const tenMinAgoIso = new Date(Date.now() - 10 * 60 * 1000).toISOString()

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('audio_generation_jobs')
    .update({
      status: 'failed' as AudioJobStatus,
      completed_at: nowIso,
      updated_at: nowIso,
      error_log: {
        message: 'Job marked as failed by stale sweep (running > 10 min)',
        timestamp: nowIso,
      },
    })
    .eq('status', 'running')
    .lt('started_at', tenMinAgoIso)
    .select('id')

  if (error) {
    throw new Error(`sweepStaleJobs: update failed: ${error.message}`)
  }
  return data?.length ?? 0
}
