/**
 * POST /api/admin/sequences/[id]/audio/generate
 *
 * Phase 1 (synchrone) : valide le script, vérifie l'idempotence, crée un job
 *   en BDD, retourne 202 + jobId immédiatement.
 * Phase 2 (background) : génère l'audio ElevenLabs, upload Storage, archive
 *   l'ancienne entrée dans audio_history, met à jour la sequence.
 */

import { NextRequest, NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'

import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  buildTimelineFromAlignment,
  computeScriptStats,
  createJob,
  generateDialogueAudio,
  parseDialogueScript,
  updateJobStatus,
  uploadAudioMp3,
  uploadTimelineJson,
  validateDialogue,
  type DialogueInput,
} from '@/lib/audio-generation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { AudioHistoryEntry } from '@/types/audio-jobs'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const COST_PER_1000_CHARS_EUR = 0.05

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

    waitUntil(runGenerationJob(jobId, sequenceId, inputs, withTimestamps, scriptText))

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

async function runGenerationJob(
  jobId: string,
  sequenceId: string,
  inputs: DialogueInput[],
  withTimestamps: boolean,
  scriptText: string,
): Promise<void> {
  try {
    await updateJobStatus(jobId, 'running')

    const result = await generateDialogueAudio({
      inputs,
      withTimestamps,
      speed: 1.1,
    })

    const stamp = Date.now()
    const audioPath = `sequences/${sequenceId}/sequence-${stamp}.mp3`
    const { url: audioUrl } = await uploadAudioMp3(result.audio, 'formations', audioPath)

    let timelineUrl: string | null = null
    if (withTimestamps && result.alignment) {
      const timeline = buildTimelineFromAlignment(
        scriptText,
        result,
        audioUrl,
        'formation_sequence',
        sequenceId,
      )
      const timelinePath = `formations/${sequenceId}/timeline-${stamp}.json`
      const uploaded = await uploadTimelineJson(timeline, timelinePath)
      timelineUrl = uploaded.url
    }

    const stats = computeScriptStats(inputs)
    const charsConsumed = result.totalChars > 0 ? result.totalChars : stats.chars
    const costEur = (charsConsumed / 1000) * COST_PER_1000_CHARS_EUR

    const admin = createAdminClient()

    const { data: current, error: readErr } = await admin
      .from('sequences')
      .select(
        'course_media_url, audio_generated_at, audio_chars_consumed, audio_cost_eur, audio_history, timeline_url',
      )
      .eq('id', sequenceId)
      .maybeSingle()

    if (readErr) {
      throw new Error(`sequence read failed: ${readErr.message}`)
    }
    if (!current) {
      throw new Error(`sequence ${sequenceId} disparue avant UPDATE`)
    }

    const existingHistory: AudioHistoryEntry[] = Array.isArray(current.audio_history)
      ? (current.audio_history as AudioHistoryEntry[])
      : []

    const nowIso = new Date().toISOString()
    const newHistory: AudioHistoryEntry[] =
      typeof current.course_media_url === 'string' && current.course_media_url.length > 0
        ? [
            ...existingHistory,
            {
              audio_url: current.course_media_url,
              generated_at:
                typeof current.audio_generated_at === 'string'
                  ? current.audio_generated_at
                  : nowIso,
              replaced_at: nowIso,
              chars:
                typeof current.audio_chars_consumed === 'number'
                  ? current.audio_chars_consumed
                  : 0,
              cost_eur:
                typeof current.audio_cost_eur === 'number'
                  ? current.audio_cost_eur
                  : 0,
            },
          ]
        : existingHistory

    const updatePayload: Record<string, unknown> = {
      course_media_url: audioUrl,
      course_media_type: 'audio',
      course_duration_seconds: Math.round(result.durationSec),
      audio_generated_at: nowIso,
      audio_chars_consumed: charsConsumed,
      audio_cost_eur: costEur,
      audio_history: newHistory,
      updated_at: nowIso,
    }
    if (timelineUrl) {
      updatePayload.timeline_url = timelineUrl
    }

    const { error: updateErr } = await admin
      .from('sequences')
      .update(updatePayload)
      .eq('id', sequenceId)

    if (updateErr) {
      throw new Error(`sequence update failed: ${updateErr.message}`)
    }

    await updateJobStatus(jobId, 'completed', {
      audioUrl,
      timelineUrl: timelineUrl ?? undefined,
      durationSec: Math.round(result.durationSec),
      charsConsumed,
      costEur,
    })
  } catch (error) {
    await updateJobStatus(jobId, 'failed', {
      errorLog: {
        message: error instanceof Error ? error.message : String(error),
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {})
  }
}
