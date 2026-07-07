/**
 * /api/admin/timelines/enrich-highlights — POST (Lot 1 surbrillance audio).
 *
 * Recalcul rétroactif des bornes de surbrillance (`highlight_at_sec` /
 * `highlight_end_sec`) sur les timelines publiées, via le matching
 * déterministe `enrichTimelineHighlights` (aucun LLM).
 *
 * Body : {
 *   type?: 'formation' | 'news'   // défaut 'formation'
 *   sourceIds?: string[]          // cible des sources précises et FORCE
 *                                 // leur re-traitement (bypass du skip
 *                                 // bon marché par URL — mode recalcul
 *                                 // après édition de scènes). Défaut :
 *                                 // toutes les sources publiées avec
 *                                 // timeline_url non nul
 *   dryRun?: boolean              // défaut TRUE — aucune écriture storage
 *   limit?: number                // défaut 10 — max de timelines ÉCRITES
 *                                 // par appel (ignoré en dry-run)
 * }
 *
 * Mode dry-run (défaut) : rapport par timeline (items matchés / total,
 * échecs détaillés) SANS écrire, sans limite. Mode écriture
 * (`dryRun: false`, après validation du rapport) : même mécanique de
 * versionnage que le PUT /api/admin/timelines/[type]/[id] — nouvelle
 * version horodatée `{type}/{source_id}/{ISO}.json` (`upsert: false`,
 * jamais d'écrasement, l'ancien fichier reste en place) + UPDATE de
 * `timeline_url`.
 *
 * Batching + reprise (correctifs post-504, juillet 2026) : l'écriture des
 * ~66 timelines dépassait `maxDuration = 60` en un seul appel. En mode
 * écriture, au plus `limit` timelines sont écrites par appel (ordre stable
 * par id), et deux niveaux de skip ne consomment pas ce budget :
 *
 *  1. Skip BON MARCHÉ (correctif 3, avant tout fetch) : une source dont
 *     `timeline_url` pointe déjà vers le chemin canonique
 *     `{type}/{source_id}/...` est considérée déjà enrichie
 *     (`already_enriched`). Signal gratuit (la colonne est déjà en main,
 *     zéro téléchargement — c'est le fetch systématique des 64 JSON qui
 *     causait le 504, pas le calcul) et fiable pour ce backfill : toutes
 *     les timelines legacy publiées étaient sur l'ancien chemin `poc/...`,
 *     seuls cette route et le PUT éditeur écrivent le chemin canonique.
 *     Limitation ASSUMÉE (backfill initial, pas un recalcul permanent) :
 *     une timeline sauvée par l'éditeur sans enrichissement serait
 *     faussement skippée — d'où `sourceIds` qui force le re-traitement.
 *  2. Skip par SIGNATURE (correctif 2, après fetch + recalcul) : bornes
 *     recalculées identiques item par item au JSON stocké
 *     (`bounds_unchanged`, ex-`already_enriched`) — pas de nouvelle
 *     version inutile, y compris en mode forcé `sourceIds`.
 *
 * Relancer le même appel converge donc naturellement ;
 * `summary.remaining` indique le nombre de timelines non évaluées faute
 * de budget d'écriture.
 *
 * Auth super_admin server-side (RBAC T1), pattern identique aux routes
 * timelines voisines.
 *
 * ⚠️ Vercel Pro : fetches storage + matching séquentiels par run
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
  // Cible des sources précises ET force leur re-traitement (bypass du skip
  // bon marché par URL canonique — le skip par signature reste actif).
  sourceIds: z.array(z.string().uuid()).optional(),
  dryRun: z.boolean().default(true),
  // Budget d'écriture par appel (mode écriture uniquement). Les timelines
  // skippées (already_enriched / bounds_unchanged) ne le consomment pas.
  limit: z.number().int().min(1).max(200).default(10),
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

// ─── Signature des bornes (détection already_enriched) ────────────────────

/**
 * Signature des bornes de surbrillance d'un tableau de scènes : pour CHAQUE
 * objet rencontré (ordre des tableaux préservé, clés parcourues triées), on
 * émet la paire `highlight_at_sec:highlight_end_sec` (`-` si absente). Les
 * objets sans bornes émettent un placeholder, ce qui garantit l'alignement
 * positionnel item par item entre les deux versions comparées.
 *
 * Pourquoi pas un JSON.stringify global (correctif 2 post-504) : la
 * comparaison stricte échouait systématiquement — Zod reconstruit les objets
 * dans l'ordre des clés du schéma alors que le module ré-appende les bornes
 * en fin d'objet (divergence d'ordre des clés, ex. nodes causal où `id` suit
 * les bornes côté schéma), donc chaque appel réécrivait les mêmes timelines
 * en boucle. On ne compare plus QUE les bornes par item, dans l'ordre —
 * toute métadonnée (horodatage, ordre de clés) est ignorée.
 */
function highlightSignature(scenes: unknown): string {
  const out: string[] = []
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const child of node) walk(child)
      return
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>
      const at = obj.highlight_at_sec
      const end = obj.highlight_end_sec
      out.push(
        `${typeof at === 'number' ? at : '-'}:${typeof end === 'number' ? end : '-'}`
      )
      for (const key of Object.keys(obj).sort()) {
        if (key === 'highlight_at_sec' || key === 'highlight_end_sec') continue
        walk(obj[key])
      }
    }
  }
  walk(scenes)
  return out.join('|')
}

// ─── Rapport par timeline ──────────────────────────────────────────────────

interface TimelineEnrichResult {
  id: string
  title: string | null
  status: 'enriched' | 'skipped' | 'fetch_error' | 'invalid_schema' | 'write_error'
  /**
   * `already_enriched` = URL déjà canonique, skip sans fetch (correctif 3) ;
   * `bounds_unchanged` = bornes recalculées identiques au JSON stocké ;
   * sinon skip du module (ex. `no_word_level_transcript`).
   */
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
  const { type, sourceIds, dryRun, limit } = bodyParsed.data
  const cfg = resolveTableAndColumn(type)
  const admin = createAdminClient()

  // 1. Sources à traiter : publiées avec timeline_url, ou liste explicite.
  //    `title` n'existe que côté sequences — sélection conditionnelle.
  //    Ordre stable par id : la reprise par appels successifs (limit)
  //    parcourt toujours la même séquence.
  const columns =
    cfg.table === 'sequences'
      ? `id, title, ${cfg.column}, ${cfg.publishColumn}`
      : `id, ${cfg.column}, ${cfg.publishColumn}`
  let query = admin
    .from(cfg.table)
    .select(columns)
    .not(cfg.column, 'is', null)
    .order('id', { ascending: true })
  if (sourceIds && sourceIds.length > 0) {
    query = query.in('id', sourceIds)
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
  const forced = new Set(sourceIds ?? [])
  let written = 0
  let remaining = 0
  for (const rowUnknown of rows ?? []) {
    // Le select à colonnes dynamiques empêche l'inférence du type de ligne
    // côté supabase-js — passage par unknown.
    const row = rowUnknown as unknown as Record<string, unknown>
    const id = String(row.id)
    const title = typeof row.title === 'string' ? row.title : null
    const timelineUrl = row[cfg.column] as string | null
    if (!timelineUrl) continue

    // Skip bon marché (correctif 3) : URL déjà sur le chemin canonique
    // `{type}/{id}/...` => timeline déjà enrichie par un appel précédent.
    // AVANT tout téléchargement/recalcul — c'est le fetch systématique des
    // ~64 JSON déjà à jour qui faisait dépasser maxDuration. Bypass via
    // `sourceIds` (recalcul forcé après édition de scènes).
    const canonicalMarker = `/${TIMELINE_STORAGE_BUCKET}/${cfg.folderName}/${id}/`
    if (!dryRun && !forced.has(id) && timelineUrl.includes(canonicalMarker)) {
      results.push({
        id,
        title,
        status: 'skipped',
        skipReason: 'already_enriched',
        itemsTotal: 0,
        itemsMatched: 0,
        failures: [],
      })
      continue
    }

    // Budget d'écriture épuisé : on n'évalue plus les timelines suivantes
    // (pas de fetch inutile), elles restent à traiter au prochain appel.
    if (!dryRun && written >= limit) {
      remaining++
      continue
    }

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

    // Reprise fine : si les bornes du JSON courant sont déjà identiques,
    // item par item, au résultat recalculé, aucune nouvelle version — et le
    // limit n'est pas consommé. Reste utile derrière le skip URL : mode
    // forcé `sourceIds` sans changement réel, ou URL non canonique dont le
    // contenu est déjà à jour.
    if (
      highlightSignature(enrichResult.timeline.scenes) ===
      highlightSignature(parsed.data.scenes)
    ) {
      results.push({ ...base, status: 'skipped', skipReason: 'bounds_unchanged' })
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
    written++
    results.push({ ...base, newVersion: isoStamp, newUrl: publicUrl })
  }

  // 3. Synthèse globale. `written` = nouvelles versions storage créées ;
  //    `remaining` = timelines non évaluées faute de budget d'écriture
  //    (limit) — relancer le même appel jusqu'à remaining = 0.
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
    written,
    remaining,
    itemsTotal: results.reduce((s, r) => s + r.itemsTotal, 0),
    itemsMatched: results.reduce((s, r) => s + r.itemsMatched, 0),
  }

  return NextResponse.json({ summary, results })
}
