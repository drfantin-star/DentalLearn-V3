import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEpisodeAudio } from '@/lib/news/generate-episode-audio'

export const dynamic = 'force-dynamic'
// 5 minutes pour absorber 1800 mots (12 min de podcast) en plusieurs chunks ElevenLabs.
export const maxDuration = 300

// POST — génère le MP3 du journal via ElevenLabs + persiste la timeline.
//
// Après succès, passe le journal à status='ready' (preview avant publication).
// Le status 'published' + published_at + validated_by sont réservés au endpoint
// POST /api/admin/news/episodes/[id]/publish.
//
// POC-T12-D-1 — Mode régénération via querystring `?regenerate=true` :
//   - Skip précondition status (accepte n'importe quel status)
//   - Skip UPDATE status + published_at + validated_by (préservés strict)
//   - TOUT le reste identique (pipeline ElevenLabs + Storage upsert + timeline)

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const isRegenerate =
      new URL(request.url).searchParams.get('regenerate') === 'true'

    const supabase = createClient()
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

    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'Clé API ElevenLabs manquante' },
        { status: 503 },
      )
    }

    const adminSupabase = createAdminClient()

    const { data: episode, error: fetchErr } = await adminSupabase
      .from('news_episodes')
      .select('id, type, status, script_md, timeline_url')
      .eq('id', episodeId)
      .eq('type', 'journal')
      .maybeSingle()

    if (fetchErr) {
      console.error('generate-audio journal fetch error:', fetchErr)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }
    if (!episode) {
      return NextResponse.json({ error: 'Journal introuvable' }, { status: 404 })
    }
    if (!isRegenerate && episode.status !== 'draft') {
      return NextResponse.json(
        { error: 'Génération audio autorisée uniquement sur un journal en draft' },
        { status: 409 },
      )
    }
    if (!episode.script_md || episode.script_md.trim().length === 0) {
      return NextResponse.json(
        { error: "Script vide — générer le script avant l'audio" },
        { status: 400 },
      )
    }

    // ----- Génération audio + timeline via helper partagé -----
    let audioResult: { audioUrl: string; durationS: number; timelineUrl: string | null }
    try {
      audioResult = await generateEpisodeAudio(adminSupabase, {
        episodeId: episode.id,
        scriptMd: episode.script_md,
        episodeType: 'journal',
        existingTimelineUrl: (episode.timeline_url as string | null) ?? null,
      })
    } catch (err) {
      console.error('Échec generateEpisodeAudio (journal):', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Échec génération audio' },
        { status: 502 },
      )
    }

    // ----- UPDATE episode -----
    // En mode régénération : ne pas toucher status / published_at / validated_by.
    // En mode normal : passage à 'ready' (published_at + validated_by réservés à /publish).
    const updatePayload: Record<string, unknown> = {
      audio_url: audioResult.audioUrl,
      duration_s: audioResult.durationS,
    }
    if (!isRegenerate) {
      updatePayload.status = 'ready'
    }
    if (audioResult.timelineUrl) {
      updatePayload.timeline_url = audioResult.timelineUrl
      updatePayload.timeline_published = true
    }

    const { data: updated, error: updErr } = await adminSupabase
      .from('news_episodes')
      .update(updatePayload)
      .eq('id', episode.id)
      .select('id, audio_url, duration_s, status, published_at')
      .single()

    if (updErr) {
      console.error('generate-audio journal update error:', updErr)
      return NextResponse.json(
        { error: updErr.message, audio_url: audioResult.audioUrl, duration_s: audioResult.durationS },
        { status: 500 },
      )
    }

    return NextResponse.json({
      audio_url: updated.audio_url,
      duration_s: updated.duration_s,
      status: updated.status,
      ...(audioResult.timelineUrl
        ? { timeline: { timeline_url: audioResult.timelineUrl, timeline_published: true } }
        : {}),
    })
  } catch (err) {
    console.error('POST generate-audio journal error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
