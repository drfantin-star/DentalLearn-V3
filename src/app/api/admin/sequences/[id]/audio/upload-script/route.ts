/**
 * POST /api/admin/sequences/[id]/audio/upload-script
 *
 * Valide un script dialogue Sophie/Martin et retourne ses stats.
 * AUCUNE écriture en BDD — utilisé par l'UI avant /generate pour confirmation.
 */

import { NextRequest, NextResponse } from 'next/server'

import { isSuperAdmin } from '@/lib/auth/rbac'
import {
  computeScriptStats,
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
        {
          error: 'invalid_script',
          validation_errors: validationErrors,
        },
        { status: 400 },
      )
    }

    const stats = computeScriptStats(inputs)
    const preview = inputs.slice(0, 3).map((i) => ({
      speaker: i.speaker,
      text: i.text.slice(0, 80),
    }))

    return NextResponse.json({
      valid: true,
      repliques: stats.repliques,
      chars: stats.chars,
      estimatedDurationMin: stats.estimatedDurationMin,
      estimatedCostEur: stats.estimatedCostEur,
      preview,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: 'parse_error',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
