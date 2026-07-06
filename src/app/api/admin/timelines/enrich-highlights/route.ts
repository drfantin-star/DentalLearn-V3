/**
 * /api/admin/timelines/enrich-highlights — POST (Lot 1 surbrillance audio).
 *
 * Recalcul rétroactif des bornes de surbrillance (`highlight_at_sec` /
 * `highlight_end_sec`) sur les timelines publiées, via le matching
 * déterministe `enrichTimelineHighlights` (aucun LLM).
 *
 * Body : {
 *   type?: 'formation' | 'news'   // défaut 'formation'
 *   ids?: string[]                // défaut : toutes les sources publiées
 *                                 // avec timeline_url non nul
 *   dryRun?: boolean              // défaut TRUE — aucune écriture storage
 * }
 *
 * Mode dry-run (défaut) : rapport par timeline (items matchés / total,
 * échecs détaillés) SANS écrire. Mode écriture (`dryRun: false`, après
 * validation du rapport) : même mécanique de versionnage que le PUT
 * /api/admin/timelines/[type]/[id] — nouvelle version horodatée
 * `{type}/{source_id}/{ISO}.json` (`upsert: false`, jamais d'écrasement,
 * l'ancien fichier reste en place) + UPDATE de `timeline_url`.
 *
 * Auth super_admin server-side (RBAC T1), pattern identique aux routes
 * timelines voisines.
 *
 * ⚠️ Vercel Pro : jusqu'à ~70 fetches storage + matching séquentiels par run
 * (`maxDuration = 60`), même pattern que /api/admin/timeline/extract-scenes.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  TIMELINE_STORAGE_BUCKET,
  buildTimelinePath,
  isoStampForStorage,
  resolveTableAndColumn,
} from '@/lib/timeline/admin-table-resolver'
import {
  enrichTimelineHighlights,
  type HighlightItemReport,
} from '@/lib/timeline/highlight-matching'
import { TimelineSchema } from '@/lib/timeline/schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

// ─── Zod body ─────────────────────────────────────────────────────────────

const BodySchema = z.object({
  type: z.enum(['formation', 'news']).default('formation'),
  ids: z.array(z.string().uuid()).optional(),
  dryRun: z.boolean().default(true),
})

// ─── Auth helper (pattern des routes timelines voisines) ──────────────────

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

// ─── Rapport par timeline ──────────────────────────────────────────────────

interface TimelineEnrichResult {
  id: string
  title: string | null
  status: 'enriched' | 'skipped' | 'fetch_error' | 'invalid_schema' | 'write_error'
  skipReason?: string
  error?: string
  itemsTotal: number
  itemsMatched: number
  failures: HighlightItemReport[]
  /** Renseignés uniquement en mode écriture (dryRun: false). */
  newVersion?: string
  newUrl?: string
}

// ─── POST ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  let bodyJson: unknown
  try {
    bodyJson = await req.json()
  } catch {
    bodyJson = {}
  }
  const bodyParsed = BodySchema.safeParse(bodyJson)
  if (!bodyParsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', details: bodyParsed.error.flatten() },
      { status: 400 }
    )
  }
  const { type, ids, dryRun } = bodyParsed.data
  const cfg = resolveTableAndColumn(type)
  const admin = createAdminClient()

  // 1. Sources à traiter : publiées avec timeline_url, ou liste explicite.
  //    `title` n'existe que côté sequences — sélection conditionnelle.
  const columns =
    cfg.table === 'sequences'
      ? `id, title, ${cfg.column}, ${cfg.publishColumn}`
      : `id, ${cfg.column}, ${cfg.publishColumn}`
  let query = admin
    .from(cfg.table)
    .select(columns)
    .not(cfg.column, 'is', null)
  if (ids && ids.length > 0) {
    query = query.in('id', ids)
  } else {
    query = query.eq(cfg.publishColumn, true)
  }
  const { data: rows, error: rowsError } = await query
  if (rowsError) {
    return NextResponse.json(
      { error: 'db_read_failed', message: rowsError.message },
      { status: 500 }
    )
  }

  // 2. Traitement séquentiel : fetch -> validation Zod -> enrichissement ->
  //    (mode écriture) nouvelle version storage + UPDATE timeline_url.
  const results: TimelineEnrichResult[] = []
  for (const rowUnknown of rows ?? []) {
    // Le select à colonnes dynamiques empêche l'inférence du type de ligne
    // côté supabase-js — passage par unknown.
    const row = rowUnknown as unknown as Record<string, unknown>
    const id = String(row.id)
    const title = typeof row.title === 'string' ? row.title : null
    const timelineUrl = row[cfg.column] as string | null
    if (!timelineUrl) continue

    const base: TimelineEnrichResult = {
      id,
      title,
      status: 'enriched',
      itemsTotal: 0,
      itemsMatched: 0,
      failures: [],
    }

    // Fetch + parse.
    let json: unknown
    try {
      const resp = await fetch(timelineUrl, { cache: 'no-store' })
      if (!resp.ok) {
        results.push({ ...base, status: 'fetch_error', error: `HTTP ${resp.status}` })
        continue
      }
      json = await resp.json()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      results.push({ ...base, status: 'fetch_error', error: msg })
      continue
    }
    const parsed = TimelineSchema.safeParse(json)
    if (!parsed.success) {
      const detail = parsed.error.issues
        .slice(0, 3)
        .map((iss) => `${iss.path.join('.') || '(racine)'} : ${iss.message}`)
        .join(' | ')
      results.push({ ...base, status: 'invalid_schema', error: detail })
      continue
    }

    // Enrichissement déterministe.
    const enrichResult = enrichTimelineHighlights(parsed.data)
    if (enrichResult.skipped) {
      results.push({
        ...base,
        status: 'skipped',
        skipReason: enrichResult.skipReason,
      })
      continue
    }
    base.itemsTotal = enrichResult.items.length
    base.itemsMatched = enrichResult.items.filter((i) => i.matched).length
    base.failures = enrichResult.items.filter((i) => !i.matched)

    if (dryRun) {
      results.push(base)
      continue
    }

    // Mode écriture : nouvelle version horodatée, jamais d'écrasement.
    const isoStamp = isoStampForStorage()
    const path = buildTimelinePath(cfg.folderName, id, isoStamp)
    const bytes = new TextEncoder().encode(
      JSON.stringify(enrichResult.timeline, null, 2)
    )
    const { error: upError } = await admin.storage
      .from(TIMELINE_STORAGE_BUCKET)
      .upload(path, bytes, {
        contentType: 'application/json',
        cacheControl: '0',
        upsert: false,
      })
    if (upError) {
      results.push({ ...base, status: 'write_error', error: upError.message })
      continue
    }
    const { data: publicData } = admin.storage
      .from(TIMELINE_STORAGE_BUCKET)
      .getPublicUrl(path)
    const publicUrl = publicData?.publicUrl ?? null
    if (!publicUrl) {
      results.push({ ...base, status: 'write_error', error: 'public_url_unavailable' })
      continue
    }
    const { error: dbError } = await admin
      .from(cfg.table)
      .update({ [cfg.column]: publicUrl })
      .eq('id', id)
    if (dbError) {
      results.push({ ...base, status: 'write_error', error: dbError.message })
      continue
    }
    results.push({ ...base, newVersion: isoStamp, newUrl: publicUrl })
  }

  // 3. Synthèse globale.
  const summary = {
    dryRun,
    type,
    timelines: results.length,
    enriched: results.filter((r) => r.status === 'enriched').length,
    skipped: results.filter((r) => r.status === 'skipped').length,
    errors: results.filter(
      (r) =>
        r.status === 'fetch_error' ||
        r.status === 'invalid_schema' ||
        r.status === 'write_error'
    ).length,
    itemsTotal: results.reduce((s, r) => s + r.itemsTotal, 0),
    itemsMatched: results.reduce((s, r) => s + r.itemsMatched, 0),
  }

  return NextResponse.json({ summary, results })
}
