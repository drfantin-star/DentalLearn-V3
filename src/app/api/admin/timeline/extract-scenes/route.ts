// Route POST /api/admin/timeline/extract-scenes — POC visualisation audio.
//
// T5-bis-B (pattern fire-and-forget) :
//   - Voie de PROD (dry_run=false) : la route crée un job en BDD,
//     fire la Supabase Edge Function `extract-scenes-formation` SANS
//     attendre, retourne 202 { jobId } en <1s. La page admin polle
//     /api/admin/timeline/extract-scenes/status?jobId=… pour récupérer le
//     résultat. Compatible Vercel Hobby (la route répond bien sous 10 s).
//   - Voie DRY-RUN (dry_run=true) : conserve le flow synchrone historique
//     (extractScenesFromScript + buildTimelineFromRaw côté Vercel, pas de
//     persistance). RÉSERVÉ AU TEST LOCAL — `maxDuration = 60` n'est suffisant
//     que sur Vercel Pro ; le dry_run en prod Hobby sera coupé à 10 s.
//
// Autres contraintes :
//   - Refus 400 explicite si source_type='news_synthesis' (T8 délègue à
//     buildNewsTimeline déterministe, pas à un LLM)
//   - RBAC super_admin server-side via isSuperAdmin()
//   - Body Zod strict ; query param ?dry_run=true active la voie synchrone

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createJob } from '@/lib/audio-generation/job-tracker'
import {
  SONNET_MODEL_T5,
  buildTimelineFromRaw,
  extractScenesFromScript,
} from '@/lib/timeline/llm-extraction'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Note T5-bis-B : les constantes TIMELINE_STORAGE_BUCKET / TIMELINE_STORAGE_PREFIX
// et le type Timeline ont été supprimés de cette route : la persistance
// Storage est déplacée dans la Supabase Edge Function extract-scenes-formation.

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Body schema — `script_text` et `transcript` sont optionnels (Option A : la
// route peut les lire elle-même côté serveur en T5.3 depuis le timeline_url
// de la séquence). En T5.1 on exige qu'ils soient passés explicitement pour
// pouvoir tester via curl/Postman avant la page admin.
// ---------------------------------------------------------------------------

const TranscriptWordSchema = z.object({
  start_sec: z.number(),
  end_sec: z.number(),
  text: z.string(),
})

const TranscriptSegmentSchema = z.object({
  start_sec: z.number(),
  end_sec: z.number(),
  speaker: z.enum(['sophie', 'martin']),
  text: z.string(),
  words: z.array(TranscriptWordSchema).default([]),
})

const TranscriptInputSchema = z.object({
  segments: z.array(TranscriptSegmentSchema).default([]),
})

const BodySchema = z.object({
  source_type: z.enum(['formation_sequence', 'news_synthesis']),
  source_id: z.string().uuid(),
  script_text: z.string().min(50).optional(),
  transcript: TranscriptInputSchema.optional(),
  /** T5.2 — audio_url + duration_sec sont nécessaires pour construire la
   *  Timeline finale Zod-validée. Optionnels en T5.1 (la route les ignorait) ;
   *  exigés à partir de T5.2 (sinon la route lit le timeline_url de la
   *  séquence côté serveur — branchement T5.3). */
  audio_url: z.string().url().optional(),
  duration_sec: z.number().positive().optional(),
})

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // ----- 1. Auth -----
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

    // ----- 2. Body parse -----
    let bodyJson: unknown
    try {
      bodyJson = await req.json()
    } catch {
      return NextResponse.json(
        { error: 'invalid_json', message: 'Request body is not valid JSON' },
        { status: 400 }
      )
    }
    const parsed = BodySchema.safeParse(bodyJson)
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'invalid_body',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      )
    }
    const body = parsed.data

    // ----- 3. Refus explicite news_synthesis -----
    if (body.source_type === 'news_synthesis') {
      return NextResponse.json(
        {
          error: 'unsupported_source_type',
          message:
            'T5 traite uniquement les formations. Les news passent par T8 (buildNewsTimeline déterministe).',
        },
        { status: 400 }
      )
    }

    // ----- 4. Dry-run flag -----
    const dryRun = req.nextUrl.searchParams.get('dry_run') === 'true'

    // ===================================================================
    // VOIE PROD — fire-and-forget vers Supabase Edge Function (T5-bis-B)
    // ===================================================================
    if (!dryRun) {
      // 4a. Crée un job en BDD AVANT de fire la fonction (l'Edge Function
      // a besoin du job_id pour suivre le statut). `script_text` est un
      // placeholder ici — l'Edge Function reconstitue le vrai depuis le
      // transcript Storage. La colonne reste obligatoire (NOT NULL) sur
      // la table audio_generation_jobs, partagée avec Sprint 4.
      let jobId: string
      try {
        jobId = await createJob({
          sequenceId: body.source_id,
          scriptText:
            '(scene_extraction job — script_text reconstituté côté Edge Function)',
          triggeredBy: user.id,
          withTimestamps: true,
        })
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        console.error(
          JSON.stringify({ event: 'extract_scenes_createjob_failed', error: msg })
        )
        return NextResponse.json(
          { error: 'job_create_failed', message: msg },
          { status: 500 }
        )
      }

      // 4b. Tag du job avec job_type='scene_extraction' (colonne ajoutée par
      // 20260516b_audio_jobs_type.sql). UPDATE séparé pour ne pas modifier
      // createJob (signature partagée avec Sprint 4).
      const admin = createAdminClient()
      const { error: tagErr } = await admin
        .from('audio_generation_jobs')
        .update({ job_type: 'scene_extraction' })
        .eq('id', jobId)
      if (tagErr) {
        // Non bloquant : le job est créé, on continue avec le default
        // 'elevenlabs_generation' qui sera filtré côté admin par UPDATE.
        console.warn(
          JSON.stringify({
            event: 'extract_scenes_jobtype_tag_failed',
            job_id: jobId,
            error: tagErr.message,
          })
        )
      }

      // 4c. Fire-and-forget : on attend la 202 de l'Edge Function (~100ms)
      // puis on retourne immédiatement. L'Edge Function continue son
      // travail via EdgeRuntime.waitUntil() même après cette réponse.
      const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const supaServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
      if (!supaUrl || !supaServiceKey) {
        return NextResponse.json(
          {
            error: 'missing_env',
            message:
              'NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant',
          },
          { status: 500 }
        )
      }

      try {
        const ack = await fetch(
          `${supaUrl}/functions/v1/extract-scenes-formation`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${supaServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              job_id: jobId,
              sequence_id: body.source_id,
            }),
            // Garde-fou : si l'Edge Function ne renvoie pas son ACK 202
            // sous 8s, on coupe et on remonte une erreur claire (mais le
            // job en BDD reste — le worker peut tout de même progresser).
            signal: AbortSignal.timeout(8_000),
          }
        )
        if (!ack.ok && ack.status !== 202) {
          const text = await ack.text().catch(() => '')
          return NextResponse.json(
            {
              error: 'edge_function_rejected',
              status: ack.status,
              message: text.slice(0, 500),
              jobId,
            },
            { status: 502 }
          )
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        return NextResponse.json(
          { error: 'edge_function_unreachable', message: msg, jobId },
          { status: 502 }
        )
      }

      return NextResponse.json(
        {
          success: true,
          async: true,
          jobId,
          status: 'running',
          message:
            'Extraction démarrée en arrière-plan. Polling /api/admin/timeline/extract-scenes/status?jobId=…',
        },
        { status: 202 }
      )
    }

    // ===================================================================
    // VOIE DRY-RUN — flow synchrone historique (test local uniquement,
    // PAS compatible Vercel Hobby — risque de timeout 10s en prod)
    // ===================================================================

    let scriptText = body.script_text
    let transcript = body.transcript
    let audioUrl = body.audio_url
    let durationSec = body.duration_sec
    // §4 handoff — mode dispatch :
    //   - timeline_url non-null : word_index (transcript + audio depuis timeline)
    //   - timeline_url null : approx_sec (script_text + course_media_url depuis BDD)
    let mode: 'word_index' | 'approx_sec' = 'word_index'

    if (!scriptText || !audioUrl || !durationSec || !transcript) {
      const ctx = await loadFormationContext(body.source_id)
      if (!ctx.ok) {
        return NextResponse.json(
          { error: 'missing_context', message: ctx.message },
          { status: 400 }
        )
      }
      mode = ctx.mode
      scriptText = scriptText ?? ctx.script_text
      audioUrl = audioUrl ?? ctx.audio_url
      durationSec = durationSec ?? ctx.duration_sec
      transcript = transcript ?? ctx.transcript
    }

    const result = await extractScenesFromScript({
      script_text: scriptText,
      transcript,
      source_id: body.source_id,
      mode,
      duration_sec: durationSec,
    })

    if (!result.ok) {
      return NextResponse.json(
        {
          success: false,
          stage: result.stage,
          errors: result.errors,
          partial_output: result.partial_output,
          sonnet_raw: result.sonnet_raw,
          llm_meta: {
            model: SONNET_MODEL_T5,
            input_tokens: result.tokens.input,
            output_tokens: result.tokens.output,
            duration_ms: result.duration_ms,
            attempts: result.attempts,
          },
        },
        { status: 422 }
      )
    }

    const builtTimeline = buildTimelineFromRaw({
      raw: result.raw_output,
      transcript,
      source_id: body.source_id,
      audio_url: audioUrl,
      duration_sec: durationSec,
      mode,
    })

    if (!builtTimeline.ok) {
      return NextResponse.json(
        {
          success: false,
          stage: builtTimeline.stage,
          errors: builtTimeline.errors,
          partial_timeline: builtTimeline.partial_timeline,
          warnings: [...result.warnings, ...builtTimeline.warnings],
          llm_meta: {
            model: SONNET_MODEL_T5,
            input_tokens: result.tokens.input,
            output_tokens: result.tokens.output,
            duration_ms: result.duration_ms,
            scenes_count: result.raw_output.scenes.length,
            concepts_count: result.raw_output.concepts.length,
            attempts: result.attempts,
          },
        },
        { status: 422 }
      )
    }

    return NextResponse.json({
      success: true,
      mode,
      timeline: builtTimeline.timeline,
      llm_meta: {
        model: SONNET_MODEL_T5,
        input_tokens: result.tokens.input,
        output_tokens: result.tokens.output,
        duration_ms: result.duration_ms,
        scenes_count: builtTimeline.timeline.scenes.length,
        concepts_count: builtTimeline.timeline.concepts.length,
        attempts: result.attempts,
      },
      warnings: [...result.warnings, ...builtTimeline.warnings],
      dry_run: true,
      persistence: null,
    })
  } catch (e) {
    // Catch top-level — anonymise vers le client mais loggue côté serveur.
    const msg = e instanceof Error ? e.message : String(e)
    // eslint-disable-next-line no-console
    console.error(
      JSON.stringify({
        event: 'extract_scenes_route_error',
        error: msg,
      })
    )
    return NextResponse.json(
      { error: 'internal_error', message: 'Extraction route failed' },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// Helper — chargement du contexte formation depuis le timeline_url existant
// ---------------------------------------------------------------------------

interface FormationContext {
  script_text: string
  audio_url: string
  duration_sec: number
  mode: 'word_index' | 'approx_sec'
  transcript?: z.infer<typeof TranscriptInputSchema>
}

interface LoadOk extends FormationContext {
  ok: true
}

interface LoadFail {
  ok: false
  message: string
}

/**
 * §4 handoff — dispatcher selon la présence de `sequences.timeline_url`.
 *
 * - timeline_url non-null → mode `word_index` : on fetch la timeline existante
 *   (pipeline Python ou upload manuel §9) et on en extrait transcript +
 *   audio + duration_sec ; script_text reconstitué depuis transcript.segments.
 *
 * - timeline_url null → mode `approx_sec` (§1 fallback) : on lit script_text,
 *   course_media_url et course_duration_seconds directement sur la séquence ;
 *   transcript reste indéfini, Sonnet positionne les scènes via trigger_at_sec
 *   proportionnel au script.
 */
async function loadFormationContext(
  sourceId: string
): Promise<LoadOk | LoadFail> {
  const admin = createAdminClient()
  const { data: sequence, error } = await admin
    .from('sequences')
    .select(
      'id, timeline_url, script_text, course_media_url, course_duration_seconds',
    )
    .eq('id', sourceId)
    .maybeSingle()

  if (error) {
    return { ok: false, message: `sequences read failed: ${error.message}` }
  }
  if (!sequence) {
    return { ok: false, message: `sequence ${sourceId} not found` }
  }

  // ---- Mode word_index : timeline_url disponible -----------------------
  if (sequence.timeline_url) {
    let json: unknown
    try {
      const resp = await fetch(sequence.timeline_url, { cache: 'no-store' })
      if (!resp.ok) {
        return {
          ok: false,
          message: `timeline_url fetch failed (HTTP ${resp.status})`,
        }
      }
      json = await resp.json()
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false, message: `timeline_url fetch error: ${msg}` }
    }

    if (!json || typeof json !== 'object') {
      return { ok: false, message: 'timeline_url is not a JSON object' }
    }
    const obj = json as Record<string, unknown>

    const audioUrl = typeof obj.audio_url === 'string' ? obj.audio_url : null
    const durationSec =
      typeof obj.duration_sec === 'number' ? obj.duration_sec : null
    const transcript = obj.transcript

    if (!audioUrl || !durationSec || !transcript) {
      return {
        ok: false,
        message:
          'timeline JSON is missing required fields (audio_url / duration_sec / transcript).',
      }
    }

    const transcriptParsed = TranscriptInputSchema.safeParse(transcript)
    if (!transcriptParsed.success) {
      return {
        ok: false,
        message: `transcript shape invalid: ${transcriptParsed.error.message}`,
      }
    }

    const scriptText = transcriptParsed.data.segments
      .map((seg) => `${seg.speaker.toUpperCase()}: ${seg.text}`)
      .join('\n\n')
      .trim()

    if (scriptText.length < 50) {
      return {
        ok: false,
        message: 'reconstructed script_text too short (< 50 chars)',
      }
    }

    return {
      ok: true,
      mode: 'word_index',
      script_text: scriptText,
      transcript: transcriptParsed.data,
      audio_url: audioUrl,
      duration_sec: durationSec,
    }
  }

  // ---- Mode approx_sec : pas de timeline_url, on lit directement la BDD -
  const scriptText =
    typeof sequence.script_text === 'string' ? sequence.script_text.trim() : ''
  if (!scriptText || scriptText.length < 50) {
    return {
      ok: false,
      message:
        'sequences.script_text is missing or too short (< 50 chars). Uploadez d\'abord un script via le dashboard, ou uploadez une timeline pré-calculée (.json) si la séquence vient du pipeline Python.',
    }
  }
  const audioUrl =
    typeof sequence.course_media_url === 'string'
      ? sequence.course_media_url
      : null
  if (!audioUrl) {
    return {
      ok: false,
      message: 'sequences.course_media_url is missing (no audio generated yet).',
    }
  }
  const durationSec =
    typeof sequence.course_duration_seconds === 'number'
      ? sequence.course_duration_seconds
      : null
  if (!durationSec || durationSec <= 0) {
    return {
      ok: false,
      message:
        'sequences.course_duration_seconds is missing or invalid (no audio duration recorded).',
    }
  }

  return {
    ok: true,
    mode: 'approx_sec',
    script_text: scriptText,
    audio_url: audioUrl,
    duration_sec: durationSec,
  }
}

// T5-bis-B : persistTimelineToStorage / PersistenceReport supprimés.
// La persistance (upload Storage + UPDATE sequences.timeline_url) est
// désormais effectuée par la Supabase Edge Function extract-scenes-formation
// dans la voie de production (fire-and-forget). Le dry_run n'écrit rien par
// définition.
