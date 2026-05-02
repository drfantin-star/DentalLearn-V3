import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  validateScriptFormat,
  type ScriptFormat,
  type ScriptNarrator,
} from '@/lib/news-audio'

const TERMINAL_STATUSES = new Set(['archived', 'published'])
const ALLOWED_TARGET_STATUSES = new Set(['draft', 'ready'])

// PATCH: édition du script et/ou statut d'un épisode (workflow draft ↔ ready).
//
// Body :
//   { script_md?: string, status?: 'draft' | 'ready' }
//
// Règles :
//   - status courant ∈ {archived, published} → 409 (édition interdite)
//   - status cible doit être draft ou ready (published réservé à
//     /generate-audio, archived réservé à la régénération côté
//     /generate-script)
//   - Transitions autorisées : draft↔draft, draft→ready, ready→draft, ready→ready
//   - Si script_md fourni : validateScriptFormat selon (format, narrator)
//     courants — 422 si invalide
//   - PATCH partiel : seuls les champs fournis sont mis à jour
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: episodeId } = await params

    // ----- 1. Auth admin -----
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // ----- 2. Body validation -----
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    const hasScript = 'script_md' in body
    const hasStatus = 'status' in body

    if (!hasScript && !hasStatus) {
      return NextResponse.json(
        { error: 'Aucun champ à mettre à jour (script_md ou status requis)' },
        { status: 400 },
      )
    }

    if (hasScript && (typeof body.script_md !== 'string' || body.script_md.trim().length === 0)) {
      return NextResponse.json(
        { error: 'script_md doit être une string non vide' },
        { status: 400 },
      )
    }

    if (hasStatus && !ALLOWED_TARGET_STATUSES.has(body.status)) {
      return NextResponse.json(
        { error: 'status invalide (autorisé : draft, ready)' },
        { status: 400 },
      )
    }

    const adminSupabase = createAdminClient()

    // ----- 3. Fetch episode courant -----
    const { data: episode, error: fetchError } = await adminSupabase
      .from('news_episodes')
      .select('id, status, format, narrator')
      .eq('id', episodeId)
      .maybeSingle()

    if (fetchError) {
      console.error('Erreur lecture épisode:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!episode) {
      return NextResponse.json({ error: 'Épisode introuvable' }, { status: 404 })
    }

    if (TERMINAL_STATUSES.has(episode.status)) {
      return NextResponse.json(
        {
          error: `Édition interdite : épisode en statut '${episode.status}'`,
        },
        { status: 409 },
      )
    }

    // ----- 4. Validation script_md -----
    if (hasScript) {
      const fmt = (episode.format ?? 'dialogue') as ScriptFormat
      const narr = (episode.narrator ?? undefined) as ScriptNarrator | undefined
      const validation = validateScriptFormat(body.script_md, fmt, narr)
      if (!validation.valid) {
        return NextResponse.json(
          {
            error: 'Script non conforme au format attendu',
            validation_errors: validation.errors,
          },
          { status: 422 },
        )
      }
    }

    // ----- 5. UPDATE partiel -----
    const update: Record<string, unknown> = {}
    if (hasScript) update.script_md = body.script_md
    if (hasStatus) update.status = body.status

    const { data: updated, error: updateError } = await adminSupabase
      .from('news_episodes')
      .update(update)
      .eq('id', episodeId)
      .select()
      .single()

    if (updateError) {
      console.error('Erreur UPDATE news_episodes:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ episode: updated })
  } catch (error) {
    console.error('Erreur API admin/news/episodes/[id] PATCH:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
