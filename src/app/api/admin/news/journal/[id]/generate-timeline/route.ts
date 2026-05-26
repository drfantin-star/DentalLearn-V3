import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { generateAndPersistTimeline } from '@/lib/news-audio'
import type { NewsSynthesisInput } from '@/lib/timeline/build-news-timeline'

// Génération de la timeline d'un journal hebdo (mapping déterministe à partir
// des syntheses + taxonomy labels, pas d'appel LLM). <5 s en pratique —
// largement sous le cap Vercel Hobby 10 s.
//
// Décomposée de l'ancienne route /generate-audio (qui faisait audio+timeline
// dans un seul appel et timeout > 300 s sur Vercel Pro). L'audio passe
// désormais par l'Edge Function audio-generation-journal-worker ; l'UI
// chaîne cette route après que le polling voit le job audio en 'completed'.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const { id: episodeId } = params
    if (!episodeId) {
      return NextResponse.json({ error: 'id manquant' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data: episode, error: fetchErr } = await admin
      .from('news_episodes')
      .select('id, type, audio_url, duration_s, timeline_url')
      .eq('id', episodeId)
      .eq('type', 'journal')
      .maybeSingle()

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!episode) {
      return NextResponse.json({ error: 'Journal introuvable' }, { status: 404 })
    }
    if (!episode.audio_url || !episode.duration_s) {
      return NextResponse.json(
        { error: "L'audio doit être généré avant la timeline" },
        { status: 409 },
      )
    }

    const syntheses = await fetchSynthesesForEpisode(admin, episodeId)
    if (syntheses.length === 0) {
      return NextResponse.json(
        { error: 'Aucune synthèse liée au journal — timeline impossible' },
        { status: 422 },
      )
    }

    const result = await generateAndPersistTimeline({
      supabase: admin,
      episode: {
        id: episode.id as string,
        type: 'journal',
        audio_url: episode.audio_url as string,
        duration_s: episode.duration_s as number,
        existing_timeline_url: (episode.timeline_url as string | null) ?? null,
      },
      syntheses,
    })

    return NextResponse.json({
      timeline_url: result.timeline_url,
      timeline_published: result.timeline_published,
    })
  } catch (err) {
    console.error('POST generate-timeline journal error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur serveur' },
      { status: 500 },
    )
  }
}

async function fetchSynthesesForEpisode(
  supabase: SupabaseClient,
  episodeId: string,
): Promise<NewsSynthesisInput[]> {
  const { data: links, error: linksErr } = await supabase
    .from('news_episode_syntheses')
    .select('synthesis_id, position')
    .eq('episode_id', episodeId)
    .order('position', { ascending: true })

  if (linksErr) throw linksErr
  if (!links || links.length === 0) return []

  const typedLinks = links as Array<{ synthesis_id: unknown; position: unknown }>
  const synthesisIds = typedLinks.map((l) => l.synthesis_id as string)

  const { data: synRows, error: synErr } = await supabase
    .from('news_syntheses')
    .select(
      'id, display_title, summary_fr, specialite, themes, key_figures, method, evidence_level, niveau_preuve, clinical_impact, caveats',
    )
    .in('id', synthesisIds)

  if (synErr) throw synErr

  const synById = new Map<string, NewsSynthesisInput>()
  for (const s of synRows ?? []) {
    const row = s as Record<string, unknown>
    synById.set(row.id as string, {
      id: row.id as string,
      display_title: (row.display_title as string | null) ?? null,
      summary_fr: (row.summary_fr as string | null) ?? null,
      specialite: (row.specialite as string | null) ?? null,
      themes: (row.themes as string[] | null) ?? null,
      key_figures: (row.key_figures as string[] | null) ?? null,
      method: (row.method as string | null) ?? null,
      evidence_level: (row.evidence_level as string | null) ?? null,
      niveau_preuve: (row.niveau_preuve as string | null) ?? null,
      clinical_impact: (row.clinical_impact as string | null) ?? null,
      caveats: (row.caveats as string | null) ?? null,
    })
  }

  return typedLinks.flatMap((l) => {
    const base = synById.get(l.synthesis_id as string)
    return base ? [{ ...base, position: l.position as number }] : []
  })
}
