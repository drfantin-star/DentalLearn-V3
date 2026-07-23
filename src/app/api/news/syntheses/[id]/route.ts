import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getInvalidEpisodeIds } from '@/lib/news/episodeValidation'
import type {
  NewsDetail,
  NewsDetailResponse,
  NewsEpisode,
  NewsSource,
} from '@/types/news'

export const dynamic = 'force-dynamic'

const NEWS_DETAIL_COLUMNS = [
  'id',
  'display_title',
  'specialite',
  'category_editorial',
  'formation_category_match',
  'published_at',
  'cover_image_url',
  'summary_fr',
  'clinical_impact',
  'key_figures',
  'evidence_level',
  'caveats',
  'method',
  'themes',
  'raw_id',
].join(', ')

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Paramètre `id` manquant' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verrou editorial : une synthese non validee par le comite renvoie 404
    // (via maybeSingle -> null -> Not found), pas une page vide.
    const { data: synthesisRow, error: synthesisError } = await supabase
      .from('news_syntheses')
      .select(NEWS_DETAIL_COLUMNS)
      .eq('id', id)
      .eq('status', 'active')
      .eq('is_editorially_validated', true)
      .maybeSingle()

    if (synthesisError) {
      console.error('news/syntheses[id] synthesis error:', synthesisError)
      return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
    }
    if (!synthesisRow) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const row = synthesisRow as unknown as Record<string, unknown>
    const rawId = row.raw_id as string | null

    const { raw_id: _rawId, ...synthesisFields } = row
    const synthesis = synthesisFields as unknown as NewsDetail

    let source: NewsSource | null = null
    if (rawId) {
      const { data: rawRow, error: rawError } = await supabase
        .from('news_raw')
        .select('doi, url, journal')
        .eq('id', rawId)
        .maybeSingle()

      if (rawError) {
        console.error('news/syntheses[id] raw error:', rawError)
      } else if (rawRow) {
        source = {
          doi: (rawRow.doi as string | null) ?? null,
          source_url: (rawRow.url as string | null) ?? null,
          journal_name: (rawRow.journal as string | null) ?? null,
        }
      }
    }

    let episode: NewsEpisode | null = null
    // La table de liaison insight/digest est news_episode_items, dont la
    // colonne d'ordre est `order_idx` (PAS `position`, qui n'existe que sur
    // news_episode_syntheses côté journal). On la remappe vers le champ de
    // réponse `position` attendu par NewsModal (cf. types/news.ts).
    const { data: items, error: itemsError } = await supabase
      .from('news_episode_items')
      .select('episode_id, order_idx')
      .eq('synthesis_id', id)

    if (itemsError) {
      console.error('news/syntheses[id] items error:', itemsError)
    } else if (items && items.length > 0) {
      // T8 — on conserve la position de la synthèse dans l'épisode parent
      // pour permettre à NewsModal de cibler le bon chapitre de la timeline.
      const positionByEpisode = new Map<string, number>()
      for (const it of items) {
        const row = it as Record<string, unknown>
        const epId = row.episode_id as string
        const pos = row.order_idx as number | null
        if (epId && typeof pos === 'number') {
          positionByEpisode.set(epId, pos)
        }
      }
      const episodeIds = Array.from(positionByEpisode.keys())

      // Verrou editorial : ne pas exposer un episode qui contient une AUTRE
      // synthese non validee (la synthese courante est deja validee, sinon on
      // aurait renvoye 404 plus haut).
      const invalidEpisodeIds = await getInvalidEpisodeIds(supabase, episodeIds)
      const validEpisodeIds = episodeIds.filter((eid) => !invalidEpisodeIds.has(eid))

      if (validEpisodeIds.length > 0) {
        const { data: episodes, error: episodesError } = await supabase
          .from('news_episodes')
          .select('id, audio_url, duration_s, published_at, timeline_url, timeline_published')
          .in('id', validEpisodeIds)
          .eq('status', 'published')
          .order('published_at', { ascending: false, nullsFirst: false })
          .limit(1)

        if (episodesError) {
          console.error('news/syntheses[id] episodes error:', episodesError)
        } else if (episodes && episodes.length > 0) {
          const ep = episodes[0] as Record<string, unknown>
          const audioUrl = ep.audio_url as string | null
          const durationS = ep.duration_s as number | null
          if (audioUrl && typeof durationS === 'number') {
            episode = {
              audio_url: audioUrl,
              duration_s: durationS,
              // T8 — exposés au front pour activer <NewsRecapCard> + permettre
              // de fetcher la timeline JSON sur le chapitre `position`.
              timeline_url: (ep.timeline_url as string | null) ?? null,
              timeline_published:
                (ep.timeline_published as boolean | null) ?? false,
              position: positionByEpisode.get(ep.id as string) ?? null,
            }
          }
        }
      }
    }

    const response: NewsDetailResponse = {
      synthesis,
      episode,
      source,
    }
    return NextResponse.json(response)
  } catch (err) {
    console.error('news/syntheses[id] GET error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
