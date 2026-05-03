import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET — détail complet d'un journal : episode + synthèses liées (jointure
// news_episode_syntheses → news_syntheses → news_raw pour source_url et
// journal_name), triées par position.
// ---------------------------------------------------------------------------

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'id manquant' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    const { data: episode, error: epErr } = await adminSupabase
      .from('news_episodes')
      .select(
        'id, type, title, week_iso, status, audio_url, duration_s, script_md, target_duration_min, editorial_tone, created_at, updated_at, published_at',
      )
      .eq('id', id)
      .eq('type', 'journal')
      .maybeSingle()

    if (epErr) {
      console.error('GET /api/admin/news/journal/[id] episode error:', epErr)
      return NextResponse.json({ error: epErr.message }, { status: 500 })
    }
    if (!episode) {
      return NextResponse.json({ error: 'Journal introuvable' }, { status: 404 })
    }

    const { data: links, error: linksErr } = await adminSupabase
      .from('news_episode_syntheses')
      .select('synthesis_id, position')
      .eq('episode_id', id)
      .order('position', { ascending: true })

    if (linksErr) {
      console.error('GET /api/admin/news/journal/[id] links error:', linksErr)
      return NextResponse.json({ error: linksErr.message }, { status: 500 })
    }

    const synthesisIds = (links ?? []).map((l) => l.synthesis_id as string)
    let syntheses: Array<{
      id: string
      position: number
      display_title: string | null
      specialite: string | null
      summary_fr: string | null
      clinical_impact: string | null
      key_figures: string[] | null
      evidence_level: string | null
      source_url: string | null
      journal_name: string | null
    }> = []

    if (synthesisIds.length > 0) {
      const { data: synRows, error: synErr } = await adminSupabase
        .from('news_syntheses')
        .select(
          'id, raw_id, display_title, specialite, summary_fr, clinical_impact, key_figures, evidence_level',
        )
        .in('id', synthesisIds)

      if (synErr) {
        console.error('GET /api/admin/news/journal/[id] syntheses error:', synErr)
        return NextResponse.json({ error: synErr.message }, { status: 500 })
      }

      const rawIds = Array.from(
        new Set(
          (synRows ?? [])
            .map((s) => (s as { raw_id: string | null }).raw_id)
            .filter((v): v is string => typeof v === 'string'),
        ),
      )
      const sourceByRawId = new Map<
        string,
        { source_url: string | null; journal_name: string | null }
      >()

      if (rawIds.length > 0) {
        const { data: rawRows, error: rawErr } = await adminSupabase
          .from('news_raw')
          .select('id, url, journal')
          .in('id', rawIds)
        if (rawErr) {
          console.error('GET /api/admin/news/journal/[id] raw error:', rawErr)
          return NextResponse.json({ error: rawErr.message }, { status: 500 })
        }
        for (const r of rawRows ?? []) {
          const row = r as { id: string; url: string | null; journal: string | null }
          sourceByRawId.set(row.id, {
            source_url: row.url ?? null,
            journal_name: row.journal ?? null,
          })
        }
      }

      const synById = new Map<string, any>()
      for (const s of synRows ?? []) {
        synById.set((s as { id: string }).id, s)
      }

      syntheses = (links ?? [])
        .map((l) => {
          const sid = l.synthesis_id as string
          const sRow = synById.get(sid)
          if (!sRow) return null
          const src = sRow.raw_id ? sourceByRawId.get(sRow.raw_id) : undefined
          return {
            id: sid,
            position: l.position as number,
            display_title: sRow.display_title ?? null,
            specialite: sRow.specialite ?? null,
            summary_fr: sRow.summary_fr ?? null,
            clinical_impact: sRow.clinical_impact ?? null,
            key_figures: Array.isArray(sRow.key_figures) ? sRow.key_figures : null,
            evidence_level: sRow.evidence_level ?? null,
            source_url: src?.source_url ?? null,
            journal_name: src?.journal_name ?? null,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
        .sort((a, b) => a.position - b.position)
    }

    return NextResponse.json({
      episode,
      syntheses,
    })
  } catch (err) {
    console.error('GET /api/admin/news/journal/[id] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PATCH — change le statut d'un journal.
// Body : { status: 'published' | 'archived' }
// Règles : draft → published OK ; published → archived OK ;
//          archived → * INTERDIT ; published → draft INTERDIT.
// ---------------------------------------------------------------------------

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'id manquant' }, { status: 400 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    const newStatus = body?.status
    if (newStatus !== 'published' && newStatus !== 'archived') {
      return NextResponse.json(
        { error: 'status invalide (attendu : published ou archived)' },
        { status: 400 },
      )
    }

    const adminSupabase = createAdminClient()

    const { data: existing, error: fetchErr } = await adminSupabase
      .from('news_episodes')
      .select('id, type, status, audio_url, script_md')
      .eq('id', id)
      .eq('type', 'journal')
      .maybeSingle()

    if (fetchErr) {
      console.error('PATCH /api/admin/news/journal/[id] fetch error:', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Journal introuvable' }, { status: 404 })
    }

    if (existing.status === 'archived') {
      return NextResponse.json(
        { error: 'Un journal archivé ne peut plus changer de statut' },
        { status: 409 },
      )
    }
    if (newStatus === 'published') {
      if (existing.status === 'published') {
        return NextResponse.json({ error: 'Déjà publié' }, { status: 409 })
      }
      if (!existing.audio_url) {
        return NextResponse.json(
          { error: 'Audio manquant — générer le MP3 avant publication' },
          { status: 409 },
        )
      }
      if (!existing.script_md || existing.script_md.trim().length === 0) {
        return NextResponse.json(
          { error: 'Script vide — générer le script avant publication' },
          { status: 409 },
        )
      }
    }

    const update: Record<string, unknown> = { status: newStatus }
    if (newStatus === 'published') {
      update.published_at = new Date().toISOString()
      update.validated_by = session.user.id
    }

    const { data: updated, error: updErr } = await adminSupabase
      .from('news_episodes')
      .update(update)
      .eq('id', id)
      .select('id, status, published_at, updated_at')
      .single()

    if (updErr) {
      console.error('PATCH /api/admin/news/journal/[id] update error:', updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json(updated)
  } catch (err) {
    console.error('PATCH /api/admin/news/journal/[id] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE — soft delete : passe le statut à 'archived' (ne supprime pas la
// ligne). Refuse si déjà publié (sécurité : un journal publié doit être
// archivé explicitement via PATCH).
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'id manquant' }, { status: 400 })
    }

    const adminSupabase = createAdminClient()

    const { data: existing, error: fetchErr } = await adminSupabase
      .from('news_episodes')
      .select('id, type, status')
      .eq('id', id)
      .eq('type', 'journal')
      .maybeSingle()

    if (fetchErr) {
      console.error('DELETE /api/admin/news/journal/[id] fetch error:', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!existing) {
      return NextResponse.json({ error: 'Journal introuvable' }, { status: 404 })
    }
    if (existing.status === 'published') {
      return NextResponse.json(
        {
          error:
            'Suppression interdite sur un journal publié — utiliser PATCH status=archived',
        },
        { status: 409 },
      )
    }
    if (existing.status === 'archived') {
      return NextResponse.json({ ok: true, status: 'archived' })
    }

    const { error: updErr } = await adminSupabase
      .from('news_episodes')
      .update({ status: 'archived' })
      .eq('id', id)

    if (updErr) {
      console.error('DELETE /api/admin/news/journal/[id] update error:', updErr)
      return NextResponse.json({ error: updErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, status: 'archived' })
  } catch (err) {
    console.error('DELETE /api/admin/news/journal/[id] error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
