/**
 * GET /api/admin/formations/[id]/audio/batch-status?batchId=...
 *
 * Sprint 4 T6 — Endpoint de polling agrégé pour le batch audio.
 * Retourne l'état de TOUS les jobs partageant le batch_id, joints aux
 * sequences pour récupérer sequence_number et title. Read-only, pas de
 * side-effect.
 */

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  AudioJobErrorLog,
  AudioJobStatus,
  BatchStatusJobItem,
  BatchStatusResponse,
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

interface JoinedRow {
  id: string
  sequence_id: string
  batch_index: number
  status: AudioJobStatus
  audio_url: string | null
  duration_sec: number | null
  chars_consumed: number | null
  cost_eur: number | null
  error_log: AudioJobErrorLog | null
  sequences: {
    sequence_number: number
    title: string
    formation_id: string
  } | null
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSuperAdmin()
    if (!auth.ok) return auth.response

    const { id: formationId } = await params
    const batchId = request.nextUrl.searchParams.get('batchId')
    if (!batchId) {
      return NextResponse.json(
        { error: 'missing_batch_id', message: 'Query param "batchId" requis.' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('audio_generation_jobs')
      .select(
        `id, sequence_id, batch_index, status, audio_url, duration_sec,
         chars_consumed, cost_eur, error_log,
         sequences:sequence_id ( sequence_number, title, formation_id )`,
      )
      .eq('batch_id', batchId)
      .order('batch_index', { ascending: true })

    if (error) {
      return NextResponse.json(
        { error: 'db_read_failed', message: error.message },
        { status: 500 },
      )
    }
    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'batch_not_found' },
        { status: 404 },
      )
    }

    const rows = data as unknown as JoinedRow[]

    // Defensive : refuse si le batch_id correspond à une autre formation
    // (l'admin a obtenu l'URL d'un autre client sans token).
    const otherFormation = rows.find(
      (r) => r.sequences?.formation_id && r.sequences.formation_id !== formationId,
    )
    if (otherFormation) {
      return NextResponse.json(
        { error: 'batch_formation_mismatch' },
        { status: 403 },
      )
    }

    const counts = {
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0,
      cancelled: 0,
    }
    const jobs: BatchStatusJobItem[] = rows.map((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1
      return {
        jobId: r.id,
        sequenceId: r.sequence_id,
        sequenceNumber: r.sequences?.sequence_number ?? 0,
        sequenceTitle: r.sequences?.title ?? '',
        batchIndex: r.batch_index,
        status: r.status,
        audioUrl: r.audio_url ?? undefined,
        durationSec: r.duration_sec ?? undefined,
        charsConsumed: r.chars_consumed ?? undefined,
        costEur: r.cost_eur ?? undefined,
        error: r.error_log ?? undefined,
      }
    })

    const response: BatchStatusResponse = {
      batchId,
      formationId,
      totalJobs: rows.length,
      counts,
      jobs,
    }

    return NextResponse.json(response, { status: 200 })
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
