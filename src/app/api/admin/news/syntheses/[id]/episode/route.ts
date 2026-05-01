import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_EMAIL = 'drfantin@gmail.com'

// GET: épisode actif (status != 'archived') lié à une synthèse, le plus
// récent en cas de pluralité historique.
//
// Retourne { episode: NewsEpisode | null }. 200 même si aucun épisode (pas
// 404) — c'est l'état initial avant toute génération.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: synthesisId } = await params

    // ----- Auth admin -----
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (session.user.email !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    // ----- Récupération des episode_ids liés à la synthèse -----
    const { data: items, error: itemsError } = await adminSupabase
      .from('news_episode_items')
      .select('episode_id')
      .eq('synthesis_id', synthesisId)

    if (itemsError) {
      console.error('Erreur lecture news_episode_items:', itemsError)
      return NextResponse.json({ error: itemsError.message }, { status: 500 })
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ episode: null })
    }

    const episodeIds = Array.from(
      new Set(items.map((it: { episode_id: string }) => it.episode_id)),
    )

    // ----- Récupération de l'épisode actif le plus récent -----
    // Filtrage explicite des archived (la régénération en archive d'anciens).
    const { data: episode, error: episodeError } = await adminSupabase
      .from('news_episodes')
      .select(
        'id, type, title, script_md, format, narrator, target_duration_min, editorial_tone, status, audio_url, duration_s, published_at, created_at',
      )
      .in('id', episodeIds)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (episodeError) {
      console.error('Erreur lecture news_episodes:', episodeError)
      return NextResponse.json({ error: episodeError.message }, { status: 500 })
    }

    return NextResponse.json({ episode: episode ?? null })
  } catch (error) {
    console.error('Erreur API admin/news/syntheses/[id]/episode GET:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
