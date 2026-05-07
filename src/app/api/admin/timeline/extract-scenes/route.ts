// Route POST /api/admin/timeline/extract-scenes — POC visualisation audio T5.1.
//
// Déclenche l'extraction structurelle Sonnet pour une formation. Sortie en T5.1
// volontairement minimale (raw_output LLM brut) — la conversion vers une
// `Timeline` Zod-validée + persistance Storage seront branchées en T5.2/T5.3
// dans la même route (ce fichier sera étendu).
//
// Contraintes (cf. handoff §10 Ticket 5 + décisions session) :
//   - Runtime Node.js explicite (PAS Edge — l'extraction prend 20-30s)
//   - maxDuration = 60 (Vercel Hobby/Pro), AbortController côté SDK = 45s
//   - Refus 400 explicite si source_type='news_synthesis' (T8 délègue à
//     buildNewsTimeline déterministe, pas à un LLM)
//   - RBAC super_admin server-side via isSuperAdmin()
//   - Body Zod strict ; query param ?dry_run=true (utilisé en T5.3)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  SONNET_MODEL_T5,
  extractScenesFromScript,
} from '@/lib/timeline/llm-extraction'
import { createClient } from '@/lib/supabase/server'

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
})

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  try {
    // ----- 1. Auth -----
    const supabase = createClient()
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

    // ----- 4. Vérification présence script_text + transcript -----
    if (!body.script_text || !body.transcript) {
      return NextResponse.json(
        {
          error: 'missing_context',
          message:
            'script_text and transcript are required for source_type=formation_sequence (T5.1). The admin UI in T5.3 will populate them server-side from sequences.timeline_url.',
        },
        { status: 400 }
      )
    }

    // ----- 5. Dry-run flag (utilisé en T5.3 pour persister ou non) -----
    const dryRun = req.nextUrl.searchParams.get('dry_run') === 'true'

    // ----- 6. Délégation extraction -----
    const result = await extractScenesFromScript({
      script_text: body.script_text,
      transcript: body.transcript,
      source_id: body.source_id,
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

    return NextResponse.json({
      success: true,
      raw_output: result.raw_output,
      llm_meta: {
        model: SONNET_MODEL_T5,
        input_tokens: result.tokens.input,
        output_tokens: result.tokens.output,
        duration_ms: result.duration_ms,
        scenes_count: result.raw_output.scenes.length,
        concepts_count: result.raw_output.concepts.length,
        attempts: result.attempts,
      },
      warnings: result.warnings,
      // dryRun n'a pas d'effet en T5.1 — la persistance arrive en T5.3.
      dry_run: dryRun,
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
