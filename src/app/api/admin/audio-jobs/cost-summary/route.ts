/**
 * GET /api/admin/audio-jobs/cost-summary — agrégats coût mois en cours,
 * ventilés par job_type. Délègue à la fonction SQL `audio_jobs_cost_summary()`
 * (créée en T7 step 0 via apply_migration `t7_audio_jobs_cost_summary`).
 *
 * Réponse 200 : { month, by_type, total } (voir CostSummaryResponse).
 */

import { NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { CostSummaryResponse } from '@/types/audio-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

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

export async function GET() {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const admin = createAdminClient()
  const { data, error } = await admin.rpc('audio_jobs_cost_summary')

  if (error) {
    return NextResponse.json(
      { error: 'rpc_failed', message: error.message },
      { status: 500 },
    )
  }

  return NextResponse.json((data ?? null) as CostSummaryResponse | null)
}
