/**
 * POST /api/admin/sequences/[id]/audio/generate
 *
 * Phase 1 (synchrone) : valide le script, vérifie l'idempotence, crée un job
 *   en BDD, fire la Supabase Edge Function audio-generation-worker en
 *   fire-and-forget, retourne 202 + jobId immédiatement.
 * Phase 2 (background, Edge Function) : génère l'audio ElevenLabs, upload
 *   Storage, archive l'ancienne entrée dans audio_history, met à jour la
 *   sequence, marque le job completed/failed.
 *
 * Avant T5-dette : runGenerationJob tournait via waitUntil dans cette route.
 *   En production Vercel Hobby le timeout 60 s coupait l'appel ElevenLabs et
 *   laissait le job stuck en `running` jusqu'au sweep 10 min.
 * Après T5-dette : la route ne fait que valider + créer le job + fire la
 *   Edge Function. Aucune dépendance Vercel Pro requise pour cette route.
 */

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  createJob,
  parseDialogueScript,
  validateDialogue,
} from '@/lib/audio-generation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSuperAdmin()
    if (!auth.ok) return auth.response

    const { id: sequenceId } = await params

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'invalid_body', message: 'JSON body requis' },
        { status: 400 },
      )
    }

    const scriptText =
      body && typeof body === 'object' && 'scriptText' in body
        ? (body as { scriptText: unknown }).scriptText
        : undefined
    const withTimestamps =
      body && typeof body === 'object' && 'withTimestamps' in body
        ? Boolean((body as { withTimestamps: unknown }).withTimestamps)
        : false

    if (typeof scriptText !== 'string' || scriptText.trim().length === 0) {
      return NextResponse.json(
        { error: 'missing_script', message: 'scriptText requis (non vide)' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

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
      return NextResponse.json(
        { error: 'sequence_not_found' },
        { status: 404 },
      )
    }

    const inputs = parseDialogueScript(scriptText)
    const validationErrors = validateDialogue(inputs)
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'invalid_script', validation_errors: validationErrors },
        { status: 400 },
      )
    }

    // Idempotence : pas de double génération si un job pending/running existe déjà.
    const { data: existingJobs, error: existingErr } = await admin
      .from('audio_generation_jobs')
      .select('id, status')
      .eq('sequence_id', sequenceId)
      .in('status', ['pending', 'running'])
      .limit(1)

    if (existingErr) {
      return NextResponse.json(
        { error: 'db_read_failed', message: existingErr.message },
        { status: 500 },
      )
    }
    if (existingJobs && existingJobs.length > 0) {
      return NextResponse.json(
        { error: 'job_already_running', jobId: existingJobs[0].id },
        { status: 409 },
      )
    }

    const jobId = await createJob({
      sequenceId,
      scriptText,
      triggeredBy: auth.userId,
      withTimestamps,
    })

    // Fire-and-forget vers la Supabase Edge Function. Si l'appel échoue avant
    // d'atteindre la fonction, le job reste en `pending` et sera marqué
    // `failed` par le sweep stale (10 min).
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/audio-generation-worker`
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        job_id: jobId,
        sequence_id: sequenceId,
        script_text: scriptText,
        with_timestamps: withTimestamps,
      }),
    }).catch((err) => {
      console.error('[audio/generate] edge function call failed:', err)
    })

    return NextResponse.json({ jobId }, { status: 202 })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'server_error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
