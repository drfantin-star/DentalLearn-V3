import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateFullAudio } from '@/lib/elevenlabs'
import { generateAndPersistTimeline } from '@/lib/news-audio'
import type { NewsSynthesisInput } from '@/lib/timeline/build-news-timeline'

// Heuristique 128 kbps : 1 seconde ≈ 16 000 octets (128 kbps / 8 bits).
const BYTES_PER_SECOND_128KBPS = 16_000

// Next.js Route Handler config — la génération audio peut dépasser le défaut.
// 5 minutes de buffer pour absorber 1800 mots (12 min de podcast) en plusieurs
// chunks ElevenLabs.
export const maxDuration = 300

// POST: génère le MP3 d'un épisode prêt et le publie.
//
// Logique :
//   1. Auth admin
//   2. Fetch épisode (status=ready obligatoire, sinon 409 ; script_md non
//      vide ; ELEVENLABS_API_KEY présente)
//   3. ElevenLabs text-to-dialogue par chunks → buffer MP3 final
//   4. Upload Supabase Storage news-audio/{episode_id}.mp3 (upsert: false)
//   5. UPDATE news_episodes : audio_url, duration_s, status='published',
//      published_at=now(), validated_by=session.user.id
//   6. Retourne { audio_url, duration_s, status: 'published' }
//
// POC-T12-D-1 — Mode régénération via querystring `?regenerate=true` :
//   - Skip précondition status (accepte n'importe quel status)
//   - Skip UPDATE status='published' + published_at + validated_by
//     (status courant + published_at + validateur préservés strict)
//   - TOUT le reste identique (pipeline ElevenLabs + Storage + timeline
//     archive via generateAndPersistTimeline T8-E)
//   - Dette D-T12-D-REGEN-FLAG : pattern temporaire, à extraire dans un
//     helper partagé en T13.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: episodeId } = await params

    // POC-T12-D-1 : mode régénération (querystring `?regenerate=true`)
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

    if (!isRegenerate && episode.status !== 'ready') {
      return NextResponse.json(
        {
          error:
            "Le script doit être validé (status=ready) avant de générer l'audio",
        },
        { status: 409 },
      )
    }

    if (!episode.script_md || episode.script_md.trim().length === 0) {
      return NextResponse.json(
        { error: 'Le script de l\'épisode est vide' },
        { status: 400 },
      )
    }

    // ----- 3. Génération audio -----
    let buffer: Buffer
    try {
      buffer = await generateFullAudio(episode.script_md)
    } catch (err) {
      console.error('Échec generateFullAudio:', err)
      return NextResponse.json(
        {
          error: err instanceof Error ? err.message : 'Échec génération audio',
        },
        { status: 502 },
      )
    }

    if (buffer.byteLength === 0) {
      return NextResponse.json(
        { error: 'Buffer audio vide retourné par ElevenLabs' },
        { status: 502 },
      )
    }

    // ----- 4. Upload Supabase Storage -----
    const objectKey = `${episode.id}.mp3`
    const { error: uploadError } = await adminSupabase
      .storage
      .from('news-audio')
      .upload(objectKey, buffer, {
        contentType: 'audio/mpeg',
        upsert: false,
      })

    if (uploadError) {
      console.error('Erreur upload Storage news-audio:', uploadError)
      return NextResponse.json(
        { error: `Upload échoué : ${uploadError.message}` },
        { status: 500 },
      )
    }

    const { data: publicUrlData } = adminSupabase
      .storage
      .from('news-audio')
      .getPublicUrl(objectKey)

    const audio_url = publicUrlData.publicUrl

    // Heuristique 128 kbps. La doc ElevenLabs renvoie effectivement du MP3
    // ~128 kbps par défaut sur eleven_v3 ; à ajuster si le bitrate change.
    const duration_s = Math.max(
      1,
      Math.round(buffer.byteLength / BYTES_PER_SECOND_128KBPS),
    )

    // ----- 5. UPDATE episode -----
    // POC-T12-D-1 : en mode régénération, on ne touche PAS le cycle de
    // publication (status / published_at / validated_by). Sinon, comportement
    // historique = première publication (set à 'published' + now() + user.id).
    const updatePayload: Record<string, unknown> = {
      audio_url,
      duration_s,
    }
    if (!isRegenerate) {
      updatePayload.status = 'published'
      updatePayload.published_at = new Date().toISOString()
      updatePayload.validated_by = session.user.id
    }

    const { data: updated, error: updateError } = await adminSupabase
      .from('news_episodes')
      .update(updatePayload)
      .eq('id', episode.id)
      .select('id, audio_url, duration_s, status, published_at')
      .single()

    if (updateError) {
      console.error('Erreur UPDATE news_episodes après upload:', updateError)
      // L'audio est déjà uploadé — on retourne quand même un 500 explicite.
      // L'admin peut renvoyer la requête, l'upsert: false bloquera mais
      // l'URL existe déjà en Storage.
      return NextResponse.json(
        {
          error: updateError.message,
          audio_url,
          duration_s,
        },
        { status: 500 },
      )
    }

    // ----- 6. T8 — Génération + persistence Timeline (non-bloquant) -----
    // Si la génération échoue, on retourne quand même l'audio publié (l'épisode
    // est jouable sans visu). Garde-fou E3 du prompt T8.
    let timeline_info: {
      timeline_url: string
      timeline_published: boolean
    } | null = null

    try {
      const { data: items, error: itemsError } = await adminSupabase
        .from('news_episode_items')
        .select('synthesis_id, position')
        .eq('episode_id', episode.id)
        .order('position', { ascending: true })

      if (itemsError) throw itemsError

      if (items && items.length > 0) {
        const synthesisIds = items.map((it) => it.synthesis_id as string)
        const { data: synRows, error: synErr } = await adminSupabase
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

        const orderedSyntheses: NewsSynthesisInput[] = items.flatMap((it) => {
          const base = synById.get(it.synthesis_id as string)
          return base
            ? [{ ...base, position: it.position as number }]
            : []
        })

        if (orderedSyntheses.length > 0) {
          const result = await generateAndPersistTimeline({
            supabase: adminSupabase,
            episode: {
              id: episode.id,
              type: (episode.type as 'digest' | 'insight') ?? 'digest',
              audio_url,
              duration_s,
              existing_timeline_url: (episode.timeline_url as string | null) ?? null,
            },
            syntheses: orderedSyntheses,
          })
          timeline_info = {
            timeline_url: result.timeline_url,
            timeline_published: result.timeline_published,
          }
        }
      }
    } catch (timelineErr) {
      // Non-bloquant : on log mais on ne fait pas échouer la route.
      console.warn(
        '[generate-audio episodes] Timeline generation failed (non-blocking):',
        timelineErr,
      )
    }

    return NextResponse.json({
      audio_url: updated.audio_url,
      duration_s: updated.duration_s,
      status: updated.status,
      ...(timeline_info ? { timeline: timeline_info } : {}),
    })
  } catch (error) {
    console.error('Erreur API admin/news/episodes/[id]/generate-audio:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
