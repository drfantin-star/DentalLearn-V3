/**
 * /api/admin/timelines/[type]/[id]/publish — POST (POC-T6.1.b).
 *
 * Bascule le flag `timeline_published` (sequences|news_syntheses) entre
 * brouillon et publié. Auth super_admin server-side.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { resolveTableAndColumn } from '@/lib/timeline/admin-table-resolver'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const ParamsSchema = z.object({
  type: z.enum(['formation', 'news']),
  id: z.string().uuid(),
})

const BodySchema = z.object({
  published: z.boolean(),
})

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; id: string }> }
) {
  // Auth
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

  // Params
  const paramsParsed = ParamsSchema.safeParse(await ctx.params)
  if (!paramsParsed.success) {
    return NextResponse.json(
      { error: 'invalid_params', details: paramsParsed.error.flatten() },
      { status: 400 }
    )
  }
  const { type, id } = paramsParsed.data
  const cfg = resolveTableAndColumn(type)

  // Body
  let bodyJson: unknown
  try {
    bodyJson = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_json' },
      { status: 400 }
    )
  }
  const bodyParsed = BodySchema.safeParse(bodyJson)
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: bodyParsed.error.flatten() },
      { status: 400 }
    )
  }

  const admin = createAdminClient()
  const { error: dbError } = await admin
    .from(cfg.table)
    .update({ [cfg.publishColumn]: bodyParsed.data.published })
    .eq('id', id)

  if (dbError) {
    return NextResponse.json(
      { error: 'db_update_failed', message: dbError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    published: bodyParsed.data.published,
  })
}
