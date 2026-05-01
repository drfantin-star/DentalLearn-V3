import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) {
      return NextResponse.json({ error: 'Paramètre `id` manquant' }, { status: 400 })
    }

    const supabase = createClient()

    const { data: synthesisRow, error: synthesisError } = await supabase
      .from('news_syntheses')
      .select(NEWS_DETAIL_COLUMNS)
      .eq('id', id)
      .eq('status', 'active')
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
    const { data: items, error: itemsError } = await supabase
      .from('news_episode_items')
      .select('episode_id')
      .eq('synthesis_id', id)

    if (itemsError) {
      console.error('news/syntheses[id] items error:', itemsError)
    } else if (items && items.length > 0) {
      const episodeIds = items
        .map((it) => (it as Record<string, unknown>).episode_id as string)
        .filter(Boolean)

      if (episodeIds.length > 0) {
        const { data: episodes, error: episodesError } = await supabase
          .from('news_episodes')
          .select('audio_url, duration_s, published_at')
          .in('id', episodeIds)
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
            episode = { audio_url: audioUrl, duration_s: durationS }
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
