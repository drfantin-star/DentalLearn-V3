import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'

// ============================================================================
// GET /api/admin/news/syntheses/[id]/linked-episodes — POC-T12-D-2
//
// Liste les episodes liés à une synthèse via les 2 chemins distincts (cf.
// §1.bis.1 prompt v2) :
//   - Insight (digest/insight) → news_episode_items (colonne `order_idx`),
//     filtre `synthesis_id IS NOT NULL` (D-PF-1, héritage digest legacy
//     nullable).
//   - Journal → news_episode_syntheses (colonne `position`).
//
// Filtre côté serveur : status IN ('published', 'archived'). Les drafts/
// ready se régénèrent par leur path natif (Cas C de AudioPodcastBlock).
//
// Auth : isSuperAdmin() (invariant /api/admin/news/*).
//
// Réponse : { insight: [...], journals: [...] }. Tableau vide si aucun
// episode lié — le composant <EpisodeRegenerationPanel> côté UI cache la
// section entière dans ce cas (pas de message "Aucun episode").
// ============================================================================

interface InsightItem {
  episode_id: string
  type: 'digest' | 'insight'
  status: 'published' | 'archived'
  audio_url: string | null
  title: string | null
  order_idx: number
  published_at: string | null
  updated_at: string
}

interface JournalItem {
  episode_id: string
  type: 'journal'
  status: 'published' | 'archived'
  audio_url: string | null
  title: string | null
  position: number
  published_at: string | null
  updated_at: string
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: synthesisId } = await params

    // ----- 1. Auth -----
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    // ----- 2. Insight via news_episode_items (D-PF-1 IS NOT NULL) -----
    const { data: itemRows, error: itemErr } = await adminSupabase
      .from('news_episode_items')
      .select('episode_id, order_idx')
      .eq('synthesis_id', synthesisId)
      .not('synthesis_id', 'is', null)

    if (itemErr) {
      console.error('Erreur lecture news_episode_items:', itemErr)
      return NextResponse.json({ error: itemErr.message }, { status: 500 })
    }

    const insightIds = Array.from(
      new Set((itemRows ?? []).map((r: { episode_id: string }) => r.episode_id)),
    )
    const orderByEpisode = new Map<string, number>()
    for (const r of itemRows ?? []) {
      orderByEpisode.set(
        r.episode_id as string,
        (r.order_idx as number) ?? 0,
      )
    }

    let insightItems: InsightItem[] = []
    if (insightIds.length > 0) {
      const { data: episodes, error: epErr } = await adminSupabase
        .from('news_episodes')
        .select('id, type, status, audio_url, title, published_at, updated_at')
        .in('id', insightIds)
        .in('status', ['published', 'archived'])
        .in('type', ['digest', 'insight'])
        .order('updated_at', { ascending: false })

      if (epErr) {
        console.error('Erreur lecture news_episodes (insight):', epErr)
        return NextResponse.json({ error: epErr.message }, { status: 500 })
      }

      insightItems = (episodes ?? []).map((e: Record<string, unknown>) => ({
        episode_id: e.id as string,
        type: e.type as 'digest' | 'insight',
        status: e.status as 'published' | 'archived',
        audio_url: (e.audio_url as string | null) ?? null,
        title: (e.title as string | null) ?? null,
        order_idx: orderByEpisode.get(e.id as string) ?? 0,
        published_at: (e.published_at as string | null) ?? null,
        updated_at: e.updated_at as string,
      }))
    }

    // ----- 3. Journal via news_episode_syntheses -----
    const { data: nesRows, error: nesErr } = await adminSupabase
      .from('news_episode_syntheses')
      .select('episode_id, position')
      .eq('synthesis_id', synthesisId)

    if (nesErr) {
      console.error('Erreur lecture news_episode_syntheses:', nesErr)
      return NextResponse.json({ error: nesErr.message }, { status: 500 })
    }

    const journalIds = Array.from(
      new Set((nesRows ?? []).map((r: { episode_id: string }) => r.episode_id)),
    )
    const positionByEpisode = new Map<string, number>()
    for (const r of nesRows ?? []) {
      positionByEpisode.set(
        r.episode_id as string,
        (r.position as number) ?? 0,
      )
    }

    let journalItems: JournalItem[] = []
    if (journalIds.length > 0) {
      const { data: episodes, error: epErr } = await adminSupabase
        .from('news_episodes')
        .select('id, type, status, audio_url, title, published_at, updated_at')
        .in('id', journalIds)
        .in('status', ['published', 'archived'])
        .eq('type', 'journal')
        .order('updated_at', { ascending: false })

      if (epErr) {
        console.error('Erreur lecture news_episodes (journal):', epErr)
        return NextResponse.json({ error: epErr.message }, { status: 500 })
      }

      journalItems = (episodes ?? []).map((e: Record<string, unknown>) => ({
        episode_id: e.id as string,
        type: 'journal' as const,
        status: e.status as 'published' | 'archived',
        audio_url: (e.audio_url as string | null) ?? null,
        title: (e.title as string | null) ?? null,
        position: positionByEpisode.get(e.id as string) ?? 0,
        published_at: (e.published_at as string | null) ?? null,
        updated_at: e.updated_at as string,
      }))
    }

    return NextResponse.json({
      insight: insightItems,
      journals: journalItems,
    })
  } catch (error) {
    console.error(
      'Erreur API admin/news/syntheses/[id]/linked-episodes GET:',
      error,
    )
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
