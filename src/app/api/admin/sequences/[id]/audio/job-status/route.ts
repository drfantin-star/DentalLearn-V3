/**
 * GET /api/admin/sequences/[id]/audio/job-status?jobId=...
 *
 * Endpoint de polling pour suivre l'avancement d'un job audio.
 * V1 : progress non granulaire (toujours { 0, 0 }) — l'UI affiche un spinner
 * pendant status='running'. V2 : granularité chunks via error_log temporaire.
 */

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  AudioJobErrorLog,
  AudioJobStatus,
  AudioJobStatusResponse,
} from '@/types/audio-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireSuperAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'unauthorized' }, { status: 401 }),
    }
  }
  if (!(await isSuperAdmin(user.id))) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'forbidden' }, { status: 403 }),
    }
  }
  return { ok: true, userId: user.id }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSuperAdmin()
    if (!auth.ok) return auth.response

    const { id: sequenceId } = await params
    const jobId = request.nextUrl.searchParams.get('jobId')
    if (!jobId) {
      return NextResponse.json(
        { error: 'missing_job_id', message: 'jobId query param requis' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: job, error: readErr } = await admin
      .from('audio_generation_jobs')
      .select(
        'id, status, audio_url, timeline_url, duration_sec, chars_consumed, cost_eur, error_log',
      )
      .eq('id', jobId)
      .eq('sequence_id', sequenceId)
      .maybeSingle()

    if (readErr) {
      return NextResponse.json(
        { error: 'db_read_failed', message: readErr.message },
        { status: 500 },
      )
    }
    if (!job) {
      return NextResponse.json({ error: 'job_not_found' }, { status: 404 })
    }

    const response: AudioJobStatusResponse = {
      jobId: job.id as string,
      status: job.status as AudioJobStatus,
      progress: { chunks_processed: 0, total_chunks: 0 },
      audio_url: (job.audio_url as string | null) ?? undefined,
      timeline_url: (job.timeline_url as string | null) ?? undefined,
      duration_sec: (job.duration_sec as number | null) ?? undefined,
      chars_consumed: (job.chars_consumed as number | null) ?? undefined,
      cost_eur: (job.cost_eur as number | null) ?? undefined,
      error: (job.error_log as AudioJobErrorLog | null) ?? undefined,
    }

    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json(
      {
        error: 'server_error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
