/**
 * POST /api/admin/sequences/[id]/audio/cancel
 *
 * Annulation "best effort" d'un job audio. Marque le job 'cancelled' en BDD,
 * l'UI cesse de poller. La génération côté ElevenLabs continue jusqu'à la
 * fin (pas de AbortController V1) — Vercel finit par tuer la fonction.
 */

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { updateJobStatus } from '@/lib/audio-generation'
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
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSuperAdmin()
    if (!auth.ok) return auth.response

    const { id: sequenceId } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'invalid_body', message: 'JSON body requis' },
        { status: 400 },
      )
    }

    const jobId =
      body && typeof body === 'object' && 'jobId' in body
        ? (body as { jobId: unknown }).jobId
        : undefined

    if (typeof jobId !== 'string' || jobId.length === 0) {
      return NextResponse.json(
        { error: 'missing_job_id', message: 'jobId requis dans le body' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data: job, error: readErr } = await admin
      .from('audio_generation_jobs')
      .select('id, status')
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

    if (job.status !== 'pending' && job.status !== 'running') {
      return NextResponse.json(
        { error: 'job_not_cancellable', status: job.status },
        { status: 409 },
      )
    }

    await updateJobStatus(jobId, 'cancelled')

    return NextResponse.json({ cancelled: true, jobId })
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
