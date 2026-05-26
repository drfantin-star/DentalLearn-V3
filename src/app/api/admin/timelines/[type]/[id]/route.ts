/**
 * /api/admin/timelines/[type]/[id] — GET + PUT (POC-T6.1.b).
 *
 * GET  : retourne `{ timeline, versions[], published }` depuis Storage + BDD.
 * PUT  : valide le body via `TimelineSchema` strict, upload une nouvelle
 *        version horodatée dans `audio-timelines/{type}/{source_id}/...`,
 *        UPDATE la colonne `timeline_url` correspondante.
 *
 * Auth super_admin server-side (RBAC T1).
 * Validation Zod stricte (400 + détail si fail).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  TIMELINE_STORAGE_BUCKET,
  buildTimelinePath,
  buildVersionsFolder,
  isoStampForStorage,
  resolveTableAndColumn,
} from '@/lib/timeline/admin-table-resolver'
import { TimelineSchema } from '@/lib/timeline/schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ─── Zod params ───────────────────────────────────────────────────────────

const ParamsSchema = z.object({
  type: z.enum(['formation', 'news']),
  id: z.string().uuid(),
})

const PutBodySchema = z.object({
  timeline: z.unknown(),
})

// ─── Auth helper ──────────────────────────────────────────────────────────

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

// ─── GET ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ type: string; id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const paramsParsed = ParamsSchema.safeParse(await ctx.params)
  if (!paramsParsed.success) {
    return NextResponse.json(
      { error: 'invalid_params', details: paramsParsed.error.flatten() },
      { status: 400 }
    )
  }
  const { type, id } = paramsParsed.data
  const cfg = resolveTableAndColumn(type)

  const admin = createAdminClient()

  // 1. Lecture timeline_url + timeline_published depuis la table source.
  const { data: row, error: rowError } = await admin
    .from(cfg.table)
    .select(`${cfg.column}, ${cfg.publishColumn}`)
    .eq('id', id)
    .maybeSingle()

  if (rowError) {
    return NextResponse.json(
      { error: 'db_read_failed', message: rowError.message },
      { status: 500 }
    )
  }
  if (!row) {
    return NextResponse.json(
      { error: 'not_found', message: `${cfg.table} ${id} not found` },
      { status: 404 }
    )
  }

  const rowAny = row as Record<string, unknown>
  const timelineUrl = (rowAny[cfg.column] as string | null) ?? null
  const published = Boolean(rowAny[cfg.publishColumn] ?? false)

  // 2. Liste des versions dans le dossier (toujours, même si pas de URL).
  const folder = buildVersionsFolder(cfg.folderName, id)
  const { data: files } = await admin.storage
    .from(TIMELINE_STORAGE_BUCKET)
    .list(folder, {
      limit: 100,
      sortBy: { column: 'name', order: 'desc' },
    })
  const versions = (files ?? [])
    .filter((f) => f.name.endsWith('.json'))
    .map((f) => f.name.replace(/\.json$/, ''))

  // 3. Si pas de timeline_url, on retourne timeline:null (cas news pré-T8).
  if (!timelineUrl) {
    return NextResponse.json({
      timeline: null,
      versions,
      published,
    })
  }

  // 4. Fetch + parse Zod du JSON courant.
  let json: unknown
  try {
    const resp = await fetch(timelineUrl, { cache: 'no-store' })
    if (!resp.ok) {
      return NextResponse.json(
        {
          error: 'storage_fetch_failed',
          message: `HTTP ${resp.status} fetching ${timelineUrl}`,
        },
        { status: 502 }
      )
    }
    json = await resp.json()
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json(
      { error: 'storage_fetch_failed', message: msg },
      { status: 502 }
    )
  }

  const parsed = TimelineSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'timeline_invalid_schema',
        details: parsed.error.flatten(),
      },
      { status: 422 }
    )
  }

  return NextResponse.json({
    timeline: parsed.data,
    versions,
    published,
  })
}

// ─── PUT ──────────────────────────────────────────────────────────────────

export async function PUT(
  req: NextRequest,
  ctx: { params: Promise<{ type: string; id: string }> }
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const paramsParsed = ParamsSchema.safeParse(await ctx.params)
  if (!paramsParsed.success) {
    return NextResponse.json(
      { error: 'invalid_params', details: paramsParsed.error.flatten() },
      { status: 400 }
    )
  }
  const { type, id } = paramsParsed.data
  const cfg = resolveTableAndColumn(type)

  // Body parse JSON
  let bodyJson: unknown
  try {
    bodyJson = await req.json()
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'Request body is not valid JSON' },
      { status: 400 }
    )
  }
  const bodyParsed = PutBodySchema.safeParse(bodyJson)
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: bodyParsed.error.flatten() },
      { status: 400 }
    )
  }

  // Validation TimelineSchema strict
  const timelineParsed = TimelineSchema.safeParse(bodyParsed.data.timeline)
  if (!timelineParsed.success) {
    return NextResponse.json(
      {
        error: 'invalid_timeline',
        details: timelineParsed.error.flatten(),
      },
      { status: 400 }
    )
  }
  const timeline = timelineParsed.data

  // Cohérence : source_id du payload doit matcher l'id en URL.
  if (timeline.source_id !== id) {
    return NextResponse.json(
      {
        error: 'source_id_mismatch',
        message: `timeline.source_id="${timeline.source_id}" != URL id="${id}"`,
      },
      { status: 400 }
    )
  }

  // Upload nouvelle version.
  const isoStamp = isoStampForStorage()
  const path = buildTimelinePath(cfg.folderName, id, isoStamp)
  const admin = createAdminClient()

  const json = JSON.stringify(timeline, null, 2)
  const bytes = new TextEncoder().encode(json)

  const { error: upError } = await admin.storage
    .from(TIMELINE_STORAGE_BUCKET)
    .upload(path, bytes, {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: false,
    })

  if (upError) {
    return NextResponse.json(
      { error: 'storage_upload_failed', message: upError.message },
      { status: 500 }
    )
  }

  const { data: publicData } = admin.storage
    .from(TIMELINE_STORAGE_BUCKET)
    .getPublicUrl(path)
  const publicUrl = publicData?.publicUrl ?? null

  if (!publicUrl) {
    return NextResponse.json(
      { error: 'public_url_unavailable' },
      { status: 500 }
    )
  }

  const { error: dbError } = await admin
    .from(cfg.table)
    .update({ [cfg.column]: publicUrl })
    .eq('id', id)

  if (dbError) {
    return NextResponse.json(
      { error: 'db_update_failed', message: dbError.message },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    version: isoStamp,
    url: publicUrl,
  })
}
