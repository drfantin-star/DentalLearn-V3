import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  JOURNAL_MAX_SYNTHESES,
  JOURNAL_MIN_SYNTHESES,
} from '@/lib/constants/news'

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// GET — liste des 20 derniers journaux (tous statuts), ordonnés du + récent
// au + ancien. Inclut un compteur de synthèses liées.
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    const adminSupabase = createAdminClient()

    // On fait deux requêtes plutôt qu'une jointure agrégée : Supabase ne sait
    // pas faire COUNT(news_episode_syntheses) sur un select() embarqué simple
    // sans schema cache, donc on récupère les episodes puis on agrège côté
    // serveur. Volume max = 20 lignes, perf OK.
    const { data: episodes, error: epErr } = await adminSupabase
      .from('news_episodes')
      .select(
        'id, week_iso, status, duration_s, audio_url, created_at, updated_at, title',
      )
      .eq('type', 'journal')
      .order('created_at', { ascending: false })
      .limit(20)

    if (epErr) {
      console.error('GET /api/admin/news/journal episodes error:', epErr)
      return NextResponse.json({ error: epErr.message }, { status: 500 })
    }

    const episodeIds = (episodes ?? []).map((e) => e.id as string)
    const countByEpisode = new Map<string, number>()

    if (episodeIds.length > 0) {
      const { data: links, error: linkErr } = await adminSupabase
        .from('news_episode_syntheses')
        .select('episode_id')
        .in('episode_id', episodeIds)

      if (linkErr) {
        console.error('GET /api/admin/news/journal links error:', linkErr)
        return NextResponse.json({ error: linkErr.message }, { status: 500 })
      }

      for (const row of links ?? []) {
        const epId = (row as { episode_id: string }).episode_id
        countByEpisode.set(epId, (countByEpisode.get(epId) ?? 0) + 1)
      }
    }

    const journals = (episodes ?? []).map((e) => ({
      id: e.id as string,
      title: e.title as string,
      week_iso: e.week_iso as string | null,
      status: e.status as string,
      duration_s: e.duration_s as number | null,
      audio_url: e.audio_url as string | null,
      created_at: e.created_at as string,
      updated_at: e.updated_at as string | null,
      syntheses_count: countByEpisode.get(e.id as string) ?? 0,
    }))

    return NextResponse.json({ data: journals })
  } catch (err) {
    console.error('GET /api/admin/news/journal error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST — crée un journal draft.
// Body : { synthesis_ids: string[], week_iso?: string }
//   - synthesis_ids : 3 à 6 UUID (ordre = position 1..N)
//   - week_iso : optionnel, par défaut la semaine ISO courante
// Pré-checks :
//   - 1 seul journal non-archivé par week_iso (couvert par l'index partiel
//     news_episodes_type_week_uniq + check explicite ici pour message clair)
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Body JSON invalide' }, { status: 400 })
    }

    const ids = Array.isArray(body?.synthesis_ids) ? body.synthesis_ids : null
    if (!ids) {
      return NextResponse.json(
        { error: 'synthesis_ids requis (tableau d\'UUID)' },
        { status: 400 },
      )
    }

    if (ids.length < JOURNAL_MIN_SYNTHESES) {
      return NextResponse.json(
        { error: `Minimum ${JOURNAL_MIN_SYNTHESES} articles requis` },
        { status: 400 },
      )
    }
    if (ids.length > JOURNAL_MAX_SYNTHESES) {
      return NextResponse.json(
        { error: `Maximum ${JOURNAL_MAX_SYNTHESES} articles` },
        { status: 400 },
      )
    }

    const seen = new Set<string>()
    for (const v of ids) {
      if (typeof v !== 'string' || v.length < 10) {
        return NextResponse.json(
          { error: 'synthesis_ids doit être un tableau d\'UUID valides' },
          { status: 400 },
        )
      }
      if (seen.has(v)) {
        return NextResponse.json(
          { error: 'synthesis_ids contient des doublons' },
          { status: 400 },
        )
      }
      seen.add(v)
    }

    const week_iso =
      typeof body?.week_iso === 'string' && body.week_iso.trim().length > 0
        ? body.week_iso.trim()
        : getCurrentIsoWeek()

    const adminSupabase = createAdminClient()

    // Vérifie qu'aucun journal non-archivé n'existe déjà pour cette semaine.
    const { data: existing, error: existErr } = await adminSupabase
      .from('news_episodes')
      .select('id, status')
      .eq('type', 'journal')
      .eq('week_iso', week_iso)
      .neq('status', 'archived')
      .maybeSingle()

    if (existErr) {
      console.error('POST /api/admin/news/journal check existing error:', existErr)
      return NextResponse.json({ error: existErr.message }, { status: 500 })
    }
    if (existing) {
      return NextResponse.json(
        {
          error: `Un journal non-archivé existe déjà pour la semaine ${week_iso}`,
          existing_episode_id: existing.id,
        },
        { status: 409 },
      )
    }

    // Vérifie que toutes les synthèses référencées existent et sont actives.
    const { data: foundSyntheses, error: synErr } = await adminSupabase
      .from('news_syntheses')
      .select('id, status')
      .in('id', ids)

    if (synErr) {
      console.error('POST /api/admin/news/journal syntheses check error:', synErr)
      return NextResponse.json({ error: synErr.message }, { status: 500 })
    }
    const foundIds = new Set((foundSyntheses ?? []).map((s) => s.id as string))
    const missing = ids.filter((id: string) => !foundIds.has(id))
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Synthèse(s) introuvable(s) : ${missing.join(', ')}` },
        { status: 404 },
      )
    }
    const inactive = (foundSyntheses ?? []).filter((s) => s.status !== 'active')
    if (inactive.length > 0) {
      return NextResponse.json(
        {
          error: `Synthèse(s) non actives : ${inactive.map((s) => s.id).join(', ')}`,
        },
        { status: 422 },
      )
    }

    // ----- INSERT episode draft -----
    const { data: episode, error: insertErr } = await adminSupabase
      .from('news_episodes')
      .insert({
        type: 'journal',
        title: `Journal de la semaine — ${week_iso}`,
        script_md: '', // sera renseigné par generate-script
        format: 'dialogue',
        narrator: null, // CHECK XOR : dialogue ⇒ narrator NULL
        target_duration_min: 12,
        editorial_tone: 'standard',
        status: 'draft',
        week_iso,
      })
      .select('id, week_iso, title, status, created_at, updated_at')
      .single()

    if (insertErr || !episode) {
      console.error('POST /api/admin/news/journal insert episode error:', insertErr)
      return NextResponse.json(
        { error: insertErr?.message ?? 'Erreur création journal' },
        { status: 500 },
      )
    }

    // ----- INSERT liaisons N:N -----
    const links = (ids as string[]).map((synthesis_id, idx) => ({
      episode_id: episode.id,
      synthesis_id,
      position: idx + 1,
    }))

    const { error: linksErr } = await adminSupabase
      .from('news_episode_syntheses')
      .insert(links)

    if (linksErr) {
      console.error('POST /api/admin/news/journal insert links error:', linksErr)
      // On nettoie l'épisode orphelin pour ne pas laisser un draft inutile.
      await adminSupabase.from('news_episodes').delete().eq('id', episode.id)
      return NextResponse.json({ error: linksErr.message }, { status: 500 })
    }

    return NextResponse.json({
      episode_id: episode.id,
      week_iso: episode.week_iso,
      title: episode.title,
      status: episode.status,
      syntheses_count: links.length,
    })
  } catch (err) {
    console.error('POST /api/admin/news/journal error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ISO 8601 week (e.g. "2026-W18") — duplique volontairement la fonction
// présente dans /api/admin/news/syntheses/[id]/generate-script/route.ts
// pour éviter une dépendance croisée.
function getCurrentIsoWeek(date: Date = new Date()): string {
  const d = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  )
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`
}
