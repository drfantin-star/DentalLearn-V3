/**
 * DELETE /api/admin/sequences/[id]/timeline — suppression manuelle d'une
 * timeline obsolète depuis le bloc admin « Audio du cours ».
 *
 * Purge complète :
 *   1. Auth super_admin (RBAC T1)
 *   2. Liste + suppression de TOUS les fichiers `.json` du dossier Storage
 *      `audio-timelines/formation/{id}/` (y compris versions historiques)
 *   3. UPDATE sequences SET timeline_url = NULL, timeline_published = false
 *
 * Le badge « Timeline disponible » et le lien « Extraire les scènes » se
 * basent sur la colonne `sequences.timeline_url` : la remise à NULL les fait
 * disparaître.
 */

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  TIMELINE_STORAGE_BUCKET,
  buildVersionsFolder,
} from '@/lib/timeline/admin-table-resolver'
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

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireSuperAdmin()
  if (!auth.ok) return auth.response

  const { id: sequenceId } = await params

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    sequenceId,
  )) {
    return NextResponse.json(
      { error: 'invalid_sequence_id', message: 'sequence id must be a UUID' },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // 1. Liste des fichiers JSON du dossier (toutes les versions historiques).
  const folder = buildVersionsFolder('formation', sequenceId)
  const { data: files, error: listError } = await admin.storage
    .from(TIMELINE_STORAGE_BUCKET)
    .list(folder, { limit: 100 })
  if (listError) {
    return NextResponse.json(
      { error: 'storage_list_failed', message: listError.message },
      { status: 500 },
    )
  }

  // 2. Suppression Storage (seulement s'il reste des fichiers à purger).
  const paths = (files ?? [])
    .filter((f) => f.name.endsWith('.json'))
    .map((f) => `${folder}/${f.name}`)
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage
      .from(TIMELINE_STORAGE_BUCKET)
      .remove(paths)
    if (removeError) {
      return NextResponse.json(
        { error: 'storage_delete_failed', message: removeError.message },
        { status: 500 },
      )
    }
  }

  // 3. Remise à zéro de la colonne (source de vérité du badge) + flag publication.
  const { error: updError } = await admin
    .from('sequences')
    .update({ timeline_url: null, timeline_published: false })
    .eq('id', sequenceId)
  if (updError) {
    return NextResponse.json(
      { error: 'db_update_failed', message: updError.message },
      { status: 500 },
    )
  }

  return NextResponse.json({ success: true, deleted_files: paths.length })
}
