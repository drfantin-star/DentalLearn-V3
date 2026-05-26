/**
 * POST /api/admin/audio-jobs/[id]/retry — relance un job audio failed en
 * créant un NOUVEAU job (préserve l'historique) avec le même script_text,
 * sequence_id / news_episode_id, with_timestamps, job_type, puis fire-and-
 * forget vers l'Edge Function appropriée selon job_type.
 *
 *   - elevenlabs_generation → functions/v1/audio-generation-worker
 *   - scene_extraction      → functions/v1/extract-scenes-formation
 *
 * Réponses :
 *   - 202 { jobId } : nouveau job créé, Edge Function appelée
 *   - 404           : job source introuvable
 *   - 409           : job source pas en status 'failed'
 *   - 422           : retry impossible (script_text manquant, etc.)
 *   - 500           : erreur DB / env manquante
 */

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createJob } from '@/lib/audio-generation/job-tracker'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const { id: sourceJobId } = await params

  const admin = createAdminClient()

  const { data: source, error: readErr } = await admin
    .from('audio_generation_jobs')
    .select(
      'id, status, job_type, sequence_id, news_episode_id, script_text, with_timestamps',
    )
    .eq('id', sourceJobId)
    .maybeSingle()

  if (readErr) {
    return NextResponse.json(
      { error: 'db_read_failed', message: readErr.message },
      { status: 500 },
    )
  }
  if (!source) {
    return NextResponse.json({ error: 'job_not_found' }, { status: 404 })
  }
  if (source.status !== 'failed') {
    return NextResponse.json(
      {
        error: 'invalid_status',
        message: `Retry autorisé uniquement pour les jobs 'failed' (status actuel : ${source.status}).`,
      },
      { status: 409 },
    )
  }

  const sequenceId = source.sequence_id as string | null
  const newsEpisodeId = source.news_episode_id as string | null
  const jobType = (source.job_type ?? 'elevenlabs_generation') as
    | 'elevenlabs_generation'
    | 'scene_extraction'
  const scriptText = (source.script_text as string | null) ?? ''
  const withTimestamps = Boolean(source.with_timestamps)

  // scene_extraction est attaché à une séquence (cf. route extract-scenes).
  if (jobType === 'scene_extraction' && !sequenceId) {
    return NextResponse.json(
      {
        error: 'invalid_source',
        message: 'scene_extraction sans sequence_id — retry impossible.',
      },
      { status: 422 },
    )
  }

  let newJobId: string
  try {
    newJobId = await createJob({
      sequenceId: sequenceId ?? undefined,
      newsEpisodeId: newsEpisodeId ?? undefined,
      scriptText,
      triggeredBy: auth.userId,
      withTimestamps,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: 'job_create_failed', message: msg },
      { status: 500 },
    )
  }

  // Tag job_type si scene_extraction (default de la colonne est elevenlabs).
  if (jobType === 'scene_extraction') {
    const { error: tagErr } = await admin
      .from('audio_generation_jobs')
      .update({ job_type: 'scene_extraction' })
      .eq('id', newJobId)
    if (tagErr) {
      console.warn(
        JSON.stringify({
          event: 'audio_jobs_retry_jobtype_tag_failed',
          job_id: newJobId,
          error: tagErr.message,
        }),
      )
    }
  }

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supaUrl || !serviceKey) {
    return NextResponse.json(
      {
        error: 'missing_env',
        message:
          'NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant',
        jobId: newJobId,
      },
      { status: 500 },
    )
  }

  if (jobType === 'elevenlabs_generation') {
    fetch(`${supaUrl}/functions/v1/audio-generation-worker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        job_id: newJobId,
        sequence_id: sequenceId,
        script_text: scriptText,
        with_timestamps: withTimestamps,
      }),
    }).catch((err) => {
      console.error('[audio-jobs/retry] elevenlabs edge call failed:', err)
    })
  } else {
    fetch(`${supaUrl}/functions/v1/extract-scenes-formation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        job_id: newJobId,
        sequence_id: sequenceId,
      }),
    }).catch((err) => {
      console.error('[audio-jobs/retry] scene_extraction edge call failed:', err)
    })
  }

  return NextResponse.json({ jobId: newJobId }, { status: 202 })
}
