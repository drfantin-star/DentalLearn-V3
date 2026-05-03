import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { JournalEpisode, JournalSynthesisProjection } from '@/types/news'

export const dynamic = 'force-dynamic'

// GET /api/news/journal/current
// Retourne le dernier journal publié (status='published', type='journal',
// trié par created_at desc), avec ses synthèses liées triées par position.
// Pas d'auth utilisateur explicite : on utilise createAdminClient pour
// bypasser RLS — même pattern que /api/news/syntheses (contenu public
// post-publication, mais distribué via une API serveur pour ne pas
// exposer service_role côté client).
//
// 404 si aucun journal publié n'est trouvé.

export async function GET() {
  try {
    const adminSupabase = createAdminClient()

    const { data: episode, error: epErr } = await adminSupabase
      .from('news_episodes')
      .select('id, week_iso, audio_url, duration_s, status, created_at, published_at')
      .eq('type', 'journal')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (epErr) {
      console.error('GET /api/news/journal/current episode error:', epErr)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
    if (!episode || !episode.audio_url) {
      return NextResponse.json(null, { status: 404 })
    }

    // ----- Synthèses liées -----
    const { data: links, error: linksErr } = await adminSupabase
      .from('news_episode_syntheses')
      .select('synthesis_id, position')
      .eq('episode_id', episode.id)
      .order('position', { ascending: true })

    if (linksErr) {
      console.error('GET /api/news/journal/current links error:', linksErr)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }

    let syntheses: JournalSynthesisProjection[] = []

    if (links && links.length > 0) {
      const synIds = links.map((l) => l.synthesis_id as string)

      const { data: synRows, error: synErr } = await adminSupabase
        .from('news_syntheses')
        .select(
          'id, raw_id, display_title, specialite, summary_fr, clinical_impact, key_figures, evidence_level',
        )
        .in('id', synIds)

      if (synErr) {
        console.error('GET /api/news/journal/current syntheses error:', synErr)
        return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
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
          console.error('GET /api/news/journal/current raw error:', rawErr)
          return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
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

      syntheses = links
        .map((l) => {
          const s = synById.get(l.synthesis_id as string)
          if (!s) return null
          const src = s.raw_id ? sourceByRawId.get(s.raw_id) : undefined
          return {
            position: l.position as number,
            display_title: s.display_title ?? null,
            specialite: s.specialite ?? null,
            summary_fr: s.summary_fr ?? null,
            clinical_impact: s.clinical_impact ?? null,
            key_figures: Array.isArray(s.key_figures) ? s.key_figures : null,
            evidence_level: s.evidence_level ?? null,
            source_url: src?.source_url ?? null,
            journal_name: src?.journal_name ?? null,
          } satisfies JournalSynthesisProjection
        })
        .filter((x): x is JournalSynthesisProjection => x !== null)
        .sort((a, b) => a.position - b.position)
    }

    const response: JournalEpisode = {
      id: episode.id as string,
      week_iso: (episode.week_iso as string) ?? '',
      audio_url: episode.audio_url as string,
      duration_s: (episode.duration_s as number) ?? 0,
      status: 'published',
      created_at: episode.created_at as string,
      published_at: (episode.published_at as string | null) ?? null,
      syntheses,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error('GET /api/news/journal/current error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
