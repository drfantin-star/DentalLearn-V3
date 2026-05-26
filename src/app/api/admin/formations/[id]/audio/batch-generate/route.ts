/**
 * POST /api/admin/formations/[id]/audio/batch-generate
 *
 * Sprint 4 T6 — Génération audio batch multi-séquences.
 *
 * Phase 1 (synchrone) :
 *   - Lit les sequences de la formation
 *   - Mappe nom_fichier → sequence_number (regex /^0*(\d+)/)
 *   - Parse + valide chaque script (parseDialogueScript + validateDialogue)
 *   - Vérifie idempotence (refuse si une sequence cible a déjà un job
 *     pending ou running ; les failed/cancelled/completed ne bloquent pas)
 *   - INSERT les N jobs en BDD (status=pending, batch_id partagé, batch_index 0..N-1)
 *   - Fire-and-forget Edge Function audio-generation-worker pour batch_index=0
 *     UNIQUEMENT. Le worker chaîne ensuite séquentiellement les suivants
 *     (cf. chainNextBatchJob dans index.ts).
 *
 * Phase 2 (background, chaîne d'Edge Functions worker) :
 *   - Chaque job → ElevenLabs → upload MP3 → UPDATE sequence → mark completed
 *   - À la complétion (succès OU échec), worker fire le pending suivant du batch
 *
 * Polling UI : GET /api/admin/formations/[id]/audio/batch-status?batchId=...
 */

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  computeScriptStats,
  createJob,
  parseDialogueScript,
  validateDialogue,
} from '@/lib/audio-generation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Parsing de N scripts peut dépasser 10 s sur Hobby — Vercel Pro déjà requis
// pour /api/admin/timeline/extract-scenes. Conforme à CLAUDE.md.
export const maxDuration = 30

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

// Extrait le numéro de séquence depuis le nom de fichier. Accepte zéros de
// padding (01_, 02_…) et toute extension. Retourne null si pas de digits
// au début du nom.
function extractSequenceNumberFromFilename(filename: string): number | null {
  const match = filename.match(/^0*(\d+)/)
  if (!match) return null
  const n = parseInt(match[1], 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

interface ParsedScriptFile {
  filename: string
  sequenceNumber: number
  sequenceId: string
  sequenceTitle: string
  scriptText: string
  estimatedDurationSec: number
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireSuperAdmin()
    if (!auth.ok) return auth.response

    const { id: formationId } = await params

    let formData: FormData
    try {
      formData = await request.formData()
    } catch {
      return NextResponse.json(
        {
          error: 'invalid_body',
          message: 'multipart/form-data requis (champ "scripts" répété)',
        },
        { status: 400 },
      )
    }

    const files = formData.getAll('scripts').filter((v): v is File =>
      v instanceof File,
    )
    if (files.length === 0) {
      return NextResponse.json(
        {
          error: 'no_files',
          message: 'Au moins un fichier .txt requis (champ "scripts").',
        },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    // 1. Récupère les sequences de la formation
    const { data: sequences, error: seqError } = await admin
      .from('sequences')
      .select('id, sequence_number, title')
      .eq('formation_id', formationId)
      .order('sequence_number', { ascending: true })

    if (seqError) {
      return NextResponse.json(
        { error: 'db_read_failed', message: seqError.message },
        { status: 500 },
      )
    }
    if (!sequences || sequences.length === 0) {
      return NextResponse.json(
        {
          error: 'no_sequences',
          message: 'Cette formation n\'a aucune séquence.',
        },
        { status: 404 },
      )
    }

    const sequencesByNumber = new Map<
      number,
      { id: string; sequence_number: number; title: string }
    >()
    for (const s of sequences) {
      sequencesByNumber.set(s.sequence_number, s)
    }

    // 2. Mapping nom_fichier → sequence_number + parse + validation
    const parsed: ParsedScriptFile[] = []
    const usedSequenceNumbers = new Set<number>()
    const fileErrors: Array<{ filename: string; error: string }> = []

    for (const file of files) {
      const filename = file.name
      const num = extractSequenceNumberFromFilename(filename)
      if (num === null) {
        fileErrors.push({
          filename,
          error:
            'Nom de fichier sans numéro de séquence. Format attendu : "01_xxx.txt".',
        })
        continue
      }
      if (usedSequenceNumbers.has(num)) {
        fileErrors.push({
          filename,
          error: `Numéro de séquence ${num} en doublon dans l'upload.`,
        })
        continue
      }
      const sequence = sequencesByNumber.get(num)
      if (!sequence) {
        fileErrors.push({
          filename,
          error: `Aucune séquence ${num} dans cette formation.`,
        })
        continue
      }
      const text = await file.text()
      const inputs = parseDialogueScript(text)
      const validationErrors = validateDialogue(inputs)
      if (validationErrors.length > 0) {
        fileErrors.push({
          filename,
          error: validationErrors.join(' • '),
        })
        continue
      }
      const stats = computeScriptStats(inputs)
      usedSequenceNumbers.add(num)
      parsed.push({
        filename,
        sequenceNumber: num,
        sequenceId: sequence.id,
        sequenceTitle: sequence.title,
        scriptText: text,
        estimatedDurationSec: Math.round(stats.estimatedDurationMin * 60),
      })
    }

    if (fileErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'invalid_files',
          file_errors: fileErrors,
          message: 'Un ou plusieurs fichiers sont invalides. Aucun job créé.',
        },
        { status: 400 },
      )
    }

    // 3. Idempotence : refuse si une sequence cible a déjà un job pending/running.
    //    Les jobs failed/cancelled/completed ne bloquent pas — un batch
    //    précédent qui a planté peut être relancé après correction sans
    //    nettoyage manuel.
    const sequenceIds = parsed.map((p) => p.sequenceId)
    const { data: existingJobs, error: existingErr } = await admin
      .from('audio_generation_jobs')
      .select('id, sequence_id, batch_id, status')
      .in('sequence_id', sequenceIds)
      .in('status', ['pending', 'running'])

    if (existingErr) {
      return NextResponse.json(
        { error: 'db_read_failed', message: existingErr.message },
        { status: 500 },
      )
    }
    if (existingJobs && existingJobs.length > 0) {
      const existingBatchId = existingJobs.find((j) => j.batch_id)?.batch_id
      return NextResponse.json(
        {
          error: 'job_already_running',
          message:
            'Au moins une séquence du batch a déjà un job en cours. Attendez sa fin ou utilisez batch-status.',
          existing_batch_id: existingBatchId ?? null,
          existing_job_ids: existingJobs.map((j) => j.id),
        },
        { status: 409 },
      )
    }

    // 4. Ordonne par sequence_number ASC pour batch_index 0..N-1 stable
    parsed.sort((a, b) => a.sequenceNumber - b.sequenceNumber)

    // 5. Crée le batch_id partagé et INSERT les N jobs
    const batchId = crypto.randomUUID()
    const createdJobs: Array<{
      jobId: string
      sequenceId: string
      sequenceNumber: number
      sequenceTitle: string
      batchIndex: number
      estimatedDurationSec: number
      scriptText: string
    }> = []

    for (let i = 0; i < parsed.length; i++) {
      const p = parsed[i]
      const jobId = await createJob({
        sequenceId: p.sequenceId,
        scriptText: p.scriptText,
        triggeredBy: auth.userId,
        withTimestamps: true,
        batchId,
        batchIndex: i,
      })
      createdJobs.push({
        jobId,
        sequenceId: p.sequenceId,
        sequenceNumber: p.sequenceNumber,
        sequenceTitle: p.sequenceTitle,
        batchIndex: i,
        estimatedDurationSec: p.estimatedDurationSec,
        scriptText: p.scriptText,
      })
    }

    // 6. Fire-and-forget worker pour batch_index = 0 UNIQUEMENT.
    //    Le worker chaîne ensuite séquentiellement (chainNextBatchJob).
    const firstJob = createdJobs[0]
    const edgeFunctionUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/audio-generation-worker`
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        job_id: firstJob.jobId,
        sequence_id: firstJob.sequenceId,
        script_text: firstJob.scriptText,
        with_timestamps: true,
        estimated_duration_sec: firstJob.estimatedDurationSec,
      }),
    }).catch((err) => {
      console.error('[audio/batch-generate] edge function call failed:', err)
    })

    return NextResponse.json(
      {
        batchId,
        jobs: createdJobs.map((j) => ({
          jobId: j.jobId,
          sequenceId: j.sequenceId,
          sequenceNumber: j.sequenceNumber,
          sequenceTitle: j.sequenceTitle,
          batchIndex: j.batchIndex,
        })),
      },
      { status: 202 },
    )
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
