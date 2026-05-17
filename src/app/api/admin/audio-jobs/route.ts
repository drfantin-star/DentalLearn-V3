/**
 * GET /api/admin/audio-jobs — liste paginée des jobs audio (formations + news,
 * elevenlabs_generation + scene_extraction). Page de monitoring super_admin
 * T7.
 *
 * Query params :
 *   - status     : pending | running | completed | failed | cancelled (optionnel)
 *   - job_type   : elevenlabs_generation | scene_extraction (optionnel)
 *   - period     : 7d | 30d | all (défaut all)
 *   - page       : 1-based (défaut 1)
 *   - limit      : 1..100 (défaut 20)
 *
 * Réponse 200 :
 *   { jobs: AudioJobListItem[], total, page, limit, total_pages }
 */

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type {
  AudioJobListItem,
  AudioJobStatus,
  AudioJobType,
  AudioJobsListResponse,
} from '@/types/audio-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ALLOWED_STATUSES: AudioJobStatus[] = [
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled',
]
const ALLOWED_TYPES: AudioJobType[] = ['elevenlabs_generation', 'scene_extraction']
const ALLOWED_PERIODS = ['7d', '30d', 'all'] as const

async function requireSuperAdmin(): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const supabase = createClient()
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

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const { searchParams } = request.nextUrl

  const statusRaw = searchParams.get('status')
  const status =
    statusRaw && (ALLOWED_STATUSES as string[]).includes(statusRaw)
      ? (statusRaw as AudioJobStatus)
      : null

  const jobTypeRaw = searchParams.get('job_type')
  const jobType =
    jobTypeRaw && (ALLOWED_TYPES as string[]).includes(jobTypeRaw)
      ? (jobTypeRaw as AudioJobType)
      : null

  const periodRaw = searchParams.get('period')
  const period = (ALLOWED_PERIODS as readonly string[]).includes(periodRaw ?? '')
    ? (periodRaw as (typeof ALLOWED_PERIODS)[number])
    : 'all'

  const pageRaw = Number.parseInt(searchParams.get('page') ?? '1', 10)
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1

  const limitRaw = Number.parseInt(searchParams.get('limit') ?? '20', 10)
  const limit =
    Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20

  const admin = createAdminClient()

  let query = admin
    .from('audio_generation_jobs')
    .select(
      `*,
       sequences:sequence_id ( id, title ),
       news_episodes:news_episode_id ( id, title )`,
      { count: 'exact' },
    )
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status)
  if (jobType) query = query.eq('job_type', jobType)
  if (period !== 'all') {
    const days = period === '7d' ? 7 : 30
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    query = query.gte('created_at', since)
  }

  const offset = (page - 1) * limit
  query = query.range(offset, offset + limit - 1)

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json(
      { error: 'db_read_failed', message: error.message },
      { status: 500 },
    )
  }

  type RowWithJoins = Record<string, unknown> & {
    sequences: { id: string; title: string | null } | null
    news_episodes: { id: string; title: string | null } | null
  }

  const jobs: AudioJobListItem[] = (data ?? []).map((row) => {
    const r = row as RowWithJoins
    const { sequences, news_episodes, ...rest } = r
    return {
      ...(rest as unknown as AudioJobListItem),
      sequence_title: sequences?.title ?? null,
      news_episode_title: news_episodes?.title ?? null,
    }
  })

  const total = count ?? 0
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit)

  const body: AudioJobsListResponse = {
    jobs,
    total,
    page,
    limit,
    total_pages: totalPages,
  }
  return NextResponse.json(body)
}
