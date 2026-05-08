/**
 * scripts/migrate_timelines_storage.ts — POC-T6.1.a
 *
 * Migration idempotente du Storage pour passer du pattern legacy
 *   audio-timelines/poc/{source_id}-{ISO}.json
 * vers le nouveau pattern hiérarchique (décision D2 BLOC 1) :
 *   audio-timelines/{type}/{source_id}/{ISO}.json
 * où `type ∈ {formation, news}` selon la table source.
 *
 * Stratégie :
 *  - On NE supprime PAS les anciens fichiers (zéro risque de perte).
 *  - On ré-uploade chaque timeline trouvée dans la BDD vers le nouveau
 *    chemin, puis on UPDATE la colonne `timeline_url` correspondante.
 *  - Si l'URL en base pointe déjà vers le nouveau pattern (présence du
 *    segment `/{type}/`), on skip — d'où l'idempotence : 2 exécutions
 *    consécutives ne dupliquent rien.
 *
 * Usage :
 *   npx tsx scripts/migrate_timelines_storage.ts --dry-run   # défaut
 *   npx tsx scripts/migrate_timelines_storage.ts --execute   # applique
 *
 * Variables d'environnement requises (chargées depuis .env.local) :
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── Constantes ───────────────────────────────────────────────────────────

const BUCKET = 'audio-timelines'
const LEGACY_PREFIX_SEGMENT = '/poc/'

type SourceType = 'formation' | 'news'

interface TableConfig {
  table: 'sequences' | 'news_syntheses'
  type: SourceType
  idColumn: string
  urlColumn: 'timeline_url'
}

const TABLES: TableConfig[] = [
  {
    table: 'sequences',
    type: 'formation',
    idColumn: 'id',
    urlColumn: 'timeline_url',
  },
  {
    table: 'news_syntheses',
    type: 'news',
    idColumn: 'id',
    urlColumn: 'timeline_url',
  },
]

// ─── Chargement .env.local ────────────────────────────────────────────────

function loadEnv(): { url: string; serviceKey: string } {
  // Lecture manuelle pour éviter d'ajouter `dotenv` en dépendance.
  const envPath = resolve(process.cwd(), '.env.local')
  let raw = ''
  try {
    raw = readFileSync(envPath, 'utf8')
  } catch {
    // Pas de .env.local — on s'appuie sur process.env directement.
  }

  const fromFile: Record<string, string> = {}
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    fromFile[key] = value
  }

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? fromFile.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? fromFile.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (checked process.env and .env.local).'
    )
  }
  return { url, serviceKey }
}

// ─── Extraction du path Storage depuis une publicUrl ──────────────────────

/**
 * Une publicUrl Supabase ressemble à :
 *   https://<proj>.supabase.co/storage/v1/object/public/audio-timelines/poc/uuid-2026-05-08T12-56-44-142Z.json
 * On extrait `poc/uuid-...json` (i.e. le path à l'intérieur du bucket).
 */
function extractStoragePath(publicUrl: string): string | null {
  const marker = `/object/public/${BUCKET}/`
  const idx = publicUrl.indexOf(marker)
  if (idx < 0) return null
  return publicUrl.slice(idx + marker.length)
}

/**
 * Reconstruit la portion ISO timestamp depuis l'ancien path
 *   poc/{source_id}-{ISO}.json → "{ISO}"
 * où ISO = "2026-05-08T12-56-44-142Z" (déjà safe, les ":" remplacés par "-")
 */
function extractIsoFromLegacyPath(
  legacyPath: string,
  sourceId: string
): string | null {
  // legacyPath = "poc/<source_id>-<ISO>.json"
  const filename = legacyPath.split('/').pop() ?? ''
  if (!filename.endsWith('.json')) return null
  const stem = filename.slice(0, -'.json'.length)
  const prefix = `${sourceId}-`
  if (!stem.startsWith(prefix)) {
    // Cas exotique : le fichier ne commence pas par l'id. On retombe sur
    // un timestamp courant pour ne pas bloquer la migration.
    return null
  }
  return stem.slice(prefix.length)
}

// ─── Migration d'une ligne ────────────────────────────────────────────────

interface MigrateRowResult {
  status: 'migrated' | 'skipped' | 'error'
  reason?: string
  oldPath?: string
  newPath?: string
  newUrl?: string
}

async function migrateRow(
  admin: SupabaseClient,
  cfg: TableConfig,
  row: { id: string; timeline_url: string },
  options: { execute: boolean }
): Promise<MigrateRowResult> {
  const oldPath = extractStoragePath(row.timeline_url)
  if (!oldPath) {
    return {
      status: 'skipped',
      reason: 'timeline_url not parseable as Supabase public URL',
    }
  }

  // Idempotence : si le path contient déjà /{type}/ comme premier segment,
  // on considère que c'est déjà migré.
  const firstSegment = oldPath.split('/')[0]
  if (firstSegment === cfg.type) {
    return { status: 'skipped', reason: 'already on new pattern' }
  }
  // On ne migre que les paths legacy du dossier "poc/".
  if (`/${oldPath}`.indexOf(LEGACY_PREFIX_SEGMENT) !== 0) {
    return {
      status: 'skipped',
      reason: `unknown legacy prefix: ${firstSegment}`,
    }
  }

  // Téléchargement du fichier existant depuis le Storage.
  const { data: blob, error: dlError } = await admin.storage
    .from(BUCKET)
    .download(oldPath)
  if (dlError || !blob) {
    return {
      status: 'error',
      reason: `download failed: ${dlError?.message ?? 'no blob'}`,
      oldPath,
    }
  }
  const buffer = Buffer.from(await blob.arrayBuffer())

  // Calcul du nouveau path.
  const iso =
    extractIsoFromLegacyPath(oldPath, row.id) ??
    new Date().toISOString().replace(/[:.]/g, '-')
  const newPath = `${cfg.type}/${row.id}/${iso}.json`

  if (!options.execute) {
    return {
      status: 'migrated',
      reason: 'dry-run (no upload, no DB update)',
      oldPath,
      newPath,
    }
  }

  // Upload (upsert:false — si le fichier existe déjà à la nouvelle adresse,
  // on saute proprement et on UPDATE quand même la colonne pour pointer
  // vers le nouveau path s'il pointait encore vers l'ancien).
  const { error: upError } = await admin.storage
    .from(BUCKET)
    .upload(newPath, buffer, {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: false,
    })

  // 23505/duplicate équivalent côté Storage : message contient "exists".
  const alreadyExists =
    upError && /exists|duplicate/i.test(upError.message ?? '')
  if (upError && !alreadyExists) {
    return {
      status: 'error',
      reason: `upload failed: ${upError.message}`,
      oldPath,
      newPath,
    }
  }

  // URL publique du nouveau fichier.
  const { data: publicData } = admin.storage
    .from(BUCKET)
    .getPublicUrl(newPath)
  const newUrl = publicData?.publicUrl ?? null
  if (!newUrl) {
    return {
      status: 'error',
      reason: 'getPublicUrl returned null',
      oldPath,
      newPath,
    }
  }

  // UPDATE de la colonne timeline_url.
  const { error: dbError } = await admin
    .from(cfg.table)
    .update({ [cfg.urlColumn]: newUrl })
    .eq(cfg.idColumn, row.id)
  if (dbError) {
    return {
      status: 'error',
      reason: `db update failed: ${dbError.message}`,
      oldPath,
      newPath,
      newUrl,
    }
  }

  return {
    status: 'migrated',
    oldPath,
    newPath,
    newUrl,
    reason: alreadyExists ? 'storage file already existed (re-pointed db)' : undefined,
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const execute = args.includes('--execute')
  const dryRun = !execute

  const { url, serviceKey } = loadEnv()
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // eslint-disable-next-line no-console
  console.log(
    `\n=== Storage migration (BLOC 1 / D2) — mode: ${dryRun ? 'DRY-RUN' : 'EXECUTE'}\n`
  )

  let migrated = 0
  let skipped = 0
  let errors = 0

  for (const cfg of TABLES) {
    // eslint-disable-next-line no-console
    console.log(`--- Table: ${cfg.table} (type=${cfg.type})`)
    const { data: rows, error } = await admin
      .from(cfg.table)
      .select('id, timeline_url')
      .not(cfg.urlColumn, 'is', null)

    if (error) {
      // eslint-disable-next-line no-console
      console.error(`  ! select failed: ${error.message}`)
      errors += 1
      continue
    }

    const list = (rows ?? []) as unknown as Array<{
      id: string
      timeline_url: string
    }>
    if (list.length === 0) {
      // eslint-disable-next-line no-console
      console.log('  (no rows with timeline_url)')
      continue
    }

    for (const row of list) {
      const result = await migrateRow(admin, cfg, row, { execute })
      const tag =
        result.status === 'migrated'
          ? '✓ MIGRATED'
          : result.status === 'skipped'
            ? '· skipped'
            : '✗ ERROR'
      // eslint-disable-next-line no-console
      console.log(
        `  ${tag} ${cfg.table}/${row.id}` +
          (result.oldPath ? `\n      from: ${result.oldPath}` : '') +
          (result.newPath ? `\n      to:   ${result.newPath}` : '') +
          (result.reason ? `\n      note: ${result.reason}` : '')
      )
      if (result.status === 'migrated') migrated += 1
      else if (result.status === 'skipped') skipped += 1
      else errors += 1
    }
  }

  // eslint-disable-next-line no-console
  console.log(
    `\n=== Summary: ${JSON.stringify({ migrated, skipped, errors, dry_run: dryRun })}\n`
  )

  if (dryRun) {
    // eslint-disable-next-line no-console
    console.log(
      "Aucune écriture effectuée. Relance avec --execute pour appliquer."
    )
  }

  process.exit(errors > 0 ? 1 : 0)
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('FATAL', e)
  process.exit(2)
})
