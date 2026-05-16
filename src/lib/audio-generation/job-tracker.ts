import type { AudioJobStatus } from '@/types/audio-jobs'
import type { CreateJobOptions, UpdateJobOptions } from './types'

/**
 * Crée un nouveau job en BDD avec status 'pending'.
 * Retourne l'UUID du job créé.
 */
export async function createJob(_options: CreateJobOptions): Promise<string> {
  throw new Error('Not implemented — Sprint 4 T3')
}

/**
 * Met à jour le statut et les métadonnées d'un job.
 */
export async function updateJobStatus(
  _jobId: string,
  _status: AudioJobStatus,
  _fields?: UpdateJobOptions
): Promise<void> {
  throw new Error('Not implemented — Sprint 4 T3')
}

/**
 * Marque comme 'failed' les jobs bloqués en status 'running' depuis > 10 min.
 * Appelé par le cron Edge Function sweep-stale-audio-jobs.
 * Retourne le nombre de jobs marqués.
 */
export async function sweepStaleJobs(): Promise<number> {
  throw new Error('Not implemented — Sprint 4 T3')
}
