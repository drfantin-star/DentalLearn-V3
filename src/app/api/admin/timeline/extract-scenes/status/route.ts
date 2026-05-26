// Route GET /api/admin/timeline/extract-scenes/status?jobId=<uuid>
//
// Endpoint de polling pour la page admin /admin/poc/extract-scenes (T5-bis-B
// pattern fire-and-forget). Lit l'état du job d'extraction de scènes dans
// audio_generation_jobs et expose au client un sous-ensemble minimal :
//   - status         : 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
//   - timeline_url   : URL publique de la Timeline générée (si status='completed')
//   - error_log      : { message, ... } (si status='failed' OU métadonnées sur
//                      'completed' — la Edge Function loggue les compteurs là)
//   - started_at / completed_at / created_at
//
// RBAC : super_admin only (même politique que la route POST principale).
// Runtime nodejs (lecture simple, <100ms).

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    // ----- Auth -----
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    }
    if (!(await isSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 })
    }

    // ----- Param -----
    const jobId = req.nextUrl.searchParams.get('jobId')
    if (!jobId || jobId.length === 0) {
      return NextResponse.json(
        { error: 'missing_param', message: 'jobId is required' },
        { status: 400 }
      )
    }

    // ----- Read job -----
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('audio_generation_jobs')
      .select(
        'id, status, job_type, sequence_id, timeline_url, error_log, started_at, completed_at, created_at, updated_at'
      )
      .eq('id', jobId)
      .maybeSingle()

    if (error) {
      return NextResponse.json(
        { error: 'read_failed', message: error.message },
        { status: 500 }
      )
    }
    if (!data) {
      return NextResponse.json(
        { error: 'job_not_found', jobId },
        { status: 404 }
      )
    }

    return NextResponse.json({
      jobId: data.id,
      status: data.status,
      job_type: data.job_type ?? null,
      sequence_id: data.sequence_id,
      timeline_url: data.timeline_url ?? null,
      error_log: data.error_log ?? null,
      started_at: data.started_at,
      completed_at: data.completed_at,
      created_at: data.created_at,
      updated_at: data.updated_at,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(
      JSON.stringify({ event: 'extract_scenes_status_error', error: msg })
    )
    return NextResponse.json(
      { error: 'internal_error', message: 'status route failed' },
      { status: 500 }
    )
  }
}
