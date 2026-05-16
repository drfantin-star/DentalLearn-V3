// Route POST /api/admin/timeline/extract-scenes — POC visualisation audio T5.1.
//
// Déclenche l'extraction structurelle Sonnet pour une formation. Sortie en T5.1
// volontairement minimale (raw_output LLM brut) — la conversion vers une
// `Timeline` Zod-validée + persistance Storage seront branchées en T5.2/T5.3
// dans la même route (ce fichier sera étendu).
//
// Contraintes (cf. handoff §10 Ticket 5 + décisions session) :
//   - Runtime Node.js explicite (PAS Edge — l'extraction prend 30-45s ;
//     T5-bis-fix3 a évalué la bascule vers Edge / Supabase Functions et
//     conclu que c'était plus coûteux que bénéfique, cf. rapport STOP de
//     fix3 dans l'historique de PR).
//   - maxDuration = 60 — DÉPEND DE VERCEL PRO. Sur Vercel Hobby, les routes
//     Serverless Node.js sont plafonnées à 10s, ce qui coupe systématiquement
//     l'appel Sonnet (30-45s). Cette route ne fonctionne donc qu'en
//     environnement Pro+ (cf. CLAUDE.md "Vercel Pro dependencies").
//   - AbortController côté SDK = 45s (cf. SONNET_CALL_TIMEOUT_MS).
//   - Refus 400 explicite si source_type='news_synthesis' (T8 délègue à
//     buildNewsTimeline déterministe, pas à un LLM)
//   - RBAC super_admin server-side via isSuperAdmin()
//   - Body Zod strict ; query param ?dry_run=true (utilisé en T5.3)

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  SONNET_MODEL_T5,
  buildTimelineFromRaw,
  extractScenesFromScript,
} from '@/lib/timeline/llm-extraction'
import type { Timeline } from '@/lib/timeline/schema'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const TIMELINE_STORAGE_BUCKET = 'audio-timelines'
const TIMELINE_STORAGE_PREFIX = 'poc'

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

    // ----- 4. Récupération contexte (script + transcript + audio + duration) -----
    // Si le caller fournit tout dans le body, on utilise tel quel. Sinon, on
    // lit le timeline_url existant de la séquence côté serveur (Option A spec
    // T5.3). En T5.2, garder les deux chemins ouverts pour permettre les
    // tests curl/Postman avant la page admin.
    let scriptText = body.script_text
    let transcript = body.transcript
    let audioUrl = body.audio_url
    let durationSec = body.duration_sec

    if (!scriptText || !transcript || !audioUrl || !durationSec) {
      const ctx = await loadFormationContextFromTimeline(body.source_id)
      if (!ctx.ok) {
        return NextResponse.json(
          {
            error: 'missing_context',
            message: ctx.message,
          },
          { status: 400 }
        )
      }
      scriptText = scriptText ?? ctx.script_text
      transcript = transcript ?? ctx.transcript
      audioUrl = audioUrl ?? ctx.audio_url
      durationSec = durationSec ?? ctx.duration_sec
    }

    // ----- 5. Dry-run flag (utilisé en T5.3 pour persister ou non) -----
    const dryRun = req.nextUrl.searchParams.get('dry_run') === 'true'

    // ----- 6. Délégation extraction Sonnet -----
    const result = await extractScenesFromScript({
      script_text: scriptText,
      transcript,
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

    // ----- 7. Conversion raw → Timeline Zod-validée (T5.2) -----
    const builtTimeline = buildTimelineFromRaw({
      raw: result.raw_output,
      transcript,
      source_id: body.source_id,
      audio_url: audioUrl,
      duration_sec: durationSec,
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

    // ----- 8. Persistance Storage (mode normal — T5.3) -----
    let persistence: PersistenceReport | null = null
    if (!dryRun) {
      persistence = await persistTimelineToStorage(
        builtTimeline.timeline,
        body.source_id
      )
    }

    return NextResponse.json({
      success: true,
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
      dry_run: dryRun,
      persistence,
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
  transcript: z.infer<typeof TranscriptInputSchema>
  audio_url: string
  duration_sec: number
}

interface LoadOk extends FormationContext {
  ok: true
}

interface LoadFail {
  ok: false
  message: string
}

/**
 * Lit la timeline existante de la séquence (générée par T2 — pipeline Python)
 * et en extrait :
 *   - transcript (segments[].words[]) — réutilisé tel quel
 *   - audio_url + duration_sec — copiés depuis les champs racine
 *   - script_text — reconstitué par concat des segment.text avec marqueurs
 *     speaker (Sonnet a besoin de la voix Sophie/Martin pour différencier
 *     les passages didactiques)
 *
 * Si la séquence n'a pas encore de timeline_url (T2 pas exécuté), retourne
 * une erreur explicite pour que l'admin sache qu'il doit d'abord faire
 * tourner T2 avant T5.
 */
async function loadFormationContextFromTimeline(
  sourceId: string
): Promise<LoadOk | LoadFail> {
  const admin = createAdminClient()
  const { data: sequence, error } = await admin
    .from('sequences')
    .select('id, timeline_url')
    .eq('id', sourceId)
    .maybeSingle()

  if (error) {
    return { ok: false, message: `sequences read failed: ${error.message}` }
  }
  if (!sequence) {
    return { ok: false, message: `sequence ${sourceId} not found` }
  }
  if (!sequence.timeline_url) {
    return {
      ok: false,
      message:
        'sequences.timeline_url is null — run T2 (Python pipeline) first to generate the karaoke timeline.',
    }
  }

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

  // Reconstitution script_text : un bloc par segment, préfixé par le speaker.
  // Format proche du dialogue source (dialogues/sequence_*.txt) — donne au LLM
  // la même structure que les pilotes écrits manuellement.
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
    script_text: scriptText,
    transcript: transcriptParsed.data,
    audio_url: audioUrl,
    duration_sec: durationSec,
  }
}

// ---------------------------------------------------------------------------
// Helper — persistance Storage + UPDATE sequences.timeline_url (T5.3)
// ---------------------------------------------------------------------------

interface PersistenceReport {
  storage_path: string
  storage_url: string | null
  sequence_updated: boolean
  warnings: string[]
}

/**
 * Persiste la Timeline finale au format JSON dans le bucket `audio-timelines`,
 * sous-dossier `poc/`, fichier `${source_id}-${ISO timestamp}.json`. Pattern
 * cohérent avec les timelines T2 actuelles (cf. structure existante du bucket).
 *
 * Met à jour `sequences.timeline_url` avec l'URL publique du nouveau fichier
 * (le bucket est déclaré public en lecture par la migration T1). Le
 * `timeline_published` n'est PAS modifié — seul l'admin via T6 décidera de
 * publier la timeline générée par LLM.
 *
 * Le path est construit avec un timestamp pour ne PAS écraser les versions
 * précédentes (utile pour comparaison admin entre deux runs T5).
 */
async function persistTimelineToStorage(
  timeline: Timeline,
  sourceId: string
): Promise<PersistenceReport> {
  const warnings: string[] = []
  const admin = createAdminClient()
  const isoStamp = new Date().toISOString().replace(/[:.]/g, '-')
  const path = `${TIMELINE_STORAGE_PREFIX}/${sourceId}-${isoStamp}.json`

  const json = JSON.stringify(timeline, null, 2)
  const bytes = new TextEncoder().encode(json)

  const { error: uploadError } = await admin.storage
    .from(TIMELINE_STORAGE_BUCKET)
    .upload(path, bytes, {
      contentType: 'application/json',
      cacheControl: '0',
      upsert: false,
    })

  if (uploadError) {
    warnings.push(`storage_upload_failed:${uploadError.message}`)
    return {
      storage_path: path,
      storage_url: null,
      sequence_updated: false,
      warnings,
    }
  }

  // URL publique — bucket déclaré public par la migration T1 ; getPublicUrl
  // retourne toujours une string même si le bucket est privé (le caller
  // doit faire confiance à la config Storage).
  const { data: publicData } = admin.storage
    .from(TIMELINE_STORAGE_BUCKET)
    .getPublicUrl(path)
  const publicUrl = publicData?.publicUrl ?? null

  // UPDATE sequences.timeline_url (colonne créée par migration T1 —
  // 20260504a_poc_timelines.sql)
  let sequenceUpdated = false
  if (publicUrl) {
    const { error: updateError, data: updateData } = await admin
      .from('sequences')
      .update({ timeline_url: publicUrl })
      .eq('id', sourceId)
      .select('id')
    if (updateError) {
      warnings.push(`sequence_update_failed:${updateError.message}`)
    } else {
      sequenceUpdated = (updateData ?? []).length > 0
    }
  }

  return {
    storage_path: path,
    storage_url: publicUrl,
    sequence_updated: sequenceUpdated,
    warnings,
  }
}
