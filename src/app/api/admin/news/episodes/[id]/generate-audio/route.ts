import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateEpisodeAudio } from '@/lib/news/generate-episode-audio'

// 5 minutes de buffer pour absorber 1800 mots (12 min de podcast) en plusieurs
// chunks ElevenLabs.
export const maxDuration = 300

// POST: génère le MP3 d'un épisode insight/digest et le passe à 'ready'.
//
// Après succès, passe l'épisode à status='ready' (preview avant publication).
// Le status 'published' + published_at + validated_by sont réservés au endpoint
// POST /api/admin/news/episodes/[id]/publish.
//
// POC-T12-D-1 — Mode régénération via querystring `?regenerate=true` :
//   - Skip précondition status (accepte n'importe quel status)
//   - Skip UPDATE status + published_at + validated_by (préservés strict)
//   - TOUT le reste identique (pipeline ElevenLabs + Storage + timeline)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: episodeId } = await params

    const isRegenerate =
      new URL(request.url).searchParams.get('regenerate') === 'true'

    // ----- 1. Auth admin -----
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }
    if (!(await isSuperAdmin(session.user.id))) {
      return NextResponse.json({ error: 'Accès non autorisé' }, { status: 403 })
    }

    // ----- 2. Pré-checks -----
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json(
        { error: 'Clé API ElevenLabs manquante' },
        { status: 503 },
      )
    }

    const adminSupabase = createAdminClient()

    const { data: episode, error: fetchError } = await adminSupabase
      .from('news_episodes')
      .select('id, type, status, script_md, timeline_url')
      .eq('id', episodeId)
      .maybeSingle()

    if (fetchError) {
      console.error('Erreur lecture épisode:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!episode) {
      return NextResponse.json({ error: 'Épisode introuvable' }, { status: 404 })
    }

    if (!isRegenerate && episode.status !== 'draft') {
      return NextResponse.json(
        {
          error:
            "Le script doit être en statut draft avant de générer l'audio",
        },
        { status: 409 },
      )
    }

    if (!episode.script_md || episode.script_md.trim().length === 0) {
      return NextResponse.json(
        { error: "Le script de l'épisode est vide" },
        { status: 400 },
      )
    }

    // ----- 3. Génération audio + timeline via helper partagé -----
    const episodeType =
      (episode.type as string) === 'journal'
        ? 'journal'
        : (episode.type as string) === 'insight'
          ? 'insight'
          : 'digest'

    let audioResult: { audioUrl: string; durationS: number; timelineUrl: string | null }
    try {
      audioResult = await generateEpisodeAudio(adminSupabase, {
        episodeId: episode.id,
        scriptMd: episode.script_md,
        episodeType,
        existingTimelineUrl: (episode.timeline_url as string | null) ?? null,
      })
    } catch (err) {
      console.error('Échec generateEpisodeAudio:', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Échec génération audio' },
        { status: 502 },
      )
    }

    // ----- 4. UPDATE episode -----
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

    const { data: updated, error: updateError } = await adminSupabase
      .from('news_episodes')
      .update(updatePayload)
      .eq('id', episode.id)
      .select('id, audio_url, duration_s, status, published_at')
      .single()

    if (updateError) {
      console.error('Erreur UPDATE news_episodes après upload:', updateError)
      return NextResponse.json(
        {
          error: updateError.message,
          audio_url: audioResult.audioUrl,
          duration_s: audioResult.durationS,
        },
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
  } catch (error) {
    console.error('Erreur API admin/news/episodes/[id]/generate-audio:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
