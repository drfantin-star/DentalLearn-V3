/**
 * POST /api/admin/sequences/[id]/timeline/upload — §9 handoff 19 mai 2026.
 *
 * Upload manuel d'un `.timeline.json` (produit par le pipeline Python local
 * generate_audio_PHASE_2B.py) pour une séquence historique qui possède un
 * audio mais pas de `timeline_url`. Débloque la chaîne timeline word-index
 * sans dépendre de l'extraction ElevenLabs (qui ignore with_timestamps sur
 * /v1/text-to-dialogue — cf. CLAUDE.md / D-S4-T5dette-02).
 *
 * Flow :
 *   1. Auth super_admin (RBAC T1)
 *   2. Lit le fichier JSON depuis multipart/form-data champ "file"
 *   3. Valide via TimelineSchema.safeParse (strict)
 *   4. Vérifie cohérence `timeline.source_id` == URL `id`
 *   5. Upload bucket `audio-timelines` path `formation/{id}/{ISO}.json`
 *   6. UPDATE sequences.timeline_url = publicUrl
 */

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  TIMELINE_STORAGE_BUCKET,
  buildTimelinePath,
  isoStampForStorage,
} from '@/lib/timeline/admin-table-resolver'
import { TimelineSchema } from '@/lib/timeline/schema'
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

export async function POST(
  request: NextRequest,
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

  let formData: FormData
  try {
    formData = await request.formData()
  } catch (e) {
    return NextResponse.json(
      {
        error: 'invalid_form_data',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 400 },
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'missing_file', message: 'champ "file" requis (multipart)' },
      { status: 400 },
    )
  }

  // Lecture + parse JSON
  let jsonText: string
  try {
    jsonText = await file.text()
  } catch (e) {
    return NextResponse.json(
      {
        error: 'file_read_failed',
        message: e instanceof Error ? e.message : String(e),
      },
      { status: 400 },
    )
  }

  let json: unknown
  try {
    json = JSON.parse(jsonText)
  } catch (e) {
    return NextResponse.json(
      {
        error: 'invalid_json',
        message: e instanceof Error ? e.message : 'not valid JSON',
      },
      { status: 400 },
    )
  }

  const parsed = TimelineSchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'invalid_timeline_schema',
        details: parsed.error.flatten(),
      },
      { status: 400 },
    )
  }
  const timeline = parsed.data

  // Cohérence : la timeline doit correspondre à la séquence ciblée.
  if (timeline.source_id !== sequenceId) {
    return NextResponse.json(
      {
        error: 'source_id_mismatch',
        message: `timeline.source_id="${timeline.source_id}" != URL id="${sequenceId}"`,
      },
      { status: 400 },
    )
  }
  if (timeline.source_type !== 'formation_sequence') {
    return NextResponse.json(
      {
        error: 'invalid_source_type',
        message: `timeline.source_type must be "formation_sequence" (got "${timeline.source_type}")`,
      },
      { status: 400 },
    )
  }

  const admin = createAdminClient()

  // Vérifie que la séquence existe.
  const { data: sequence, error: seqError } = await admin
    .from('sequences')
    .select('id')
    .eq('id', sequenceId)
    .maybeSingle()
  if (seqError) {
    return NextResponse.json(
      { error: 'db_read_failed', message: seqError.message },
      { status: 500 },
    )
  }
  if (!sequence) {
    return NextResponse.json({ error: 'sequence_not_found' }, { status: 404 })
  }

  // Upload Storage — `formation/{id}/{ISO}.json`, upsert=false pour préserver
  // l'historique (les versions précédentes restent listables via VersionsPanel).
  const isoStamp = isoStampForStorage()
  const path = buildTimelinePath('formation', sequenceId, isoStamp)
  const bytes = new TextEncoder().encode(JSON.stringify(timeline, null, 2))

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
      { status: 500 },
    )
  }

  const { data: publicData } = admin.storage
    .from(TIMELINE_STORAGE_BUCKET)
    .getPublicUrl(path)
  const publicUrl = publicData?.publicUrl ?? null
  if (!publicUrl) {
    return NextResponse.json(
      { error: 'public_url_unavailable' },
      { status: 500 },
    )
  }

  const { error: updError } = await admin
    .from('sequences')
    .update({ timeline_url: publicUrl })
    .eq('id', sequenceId)
  if (updError) {
    return NextResponse.json(
      { error: 'db_update_failed', message: updError.message },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    timeline_url: publicUrl,
  })
}
