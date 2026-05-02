import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateFullAudio } from '@/lib/elevenlabs'

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
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: episodeId } = await params

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
      .select('id, status, script_md')
      .eq('id', episodeId)
      .maybeSingle()

    if (fetchError) {
      console.error('Erreur lecture épisode:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }
    if (!episode) {
      return NextResponse.json({ error: 'Épisode introuvable' }, { status: 404 })
    }

    if (episode.status !== 'ready') {
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
    const { data: updated, error: updateError } = await adminSupabase
      .from('news_episodes')
      .update({
        audio_url,
        duration_s,
        status: 'published',
        published_at: new Date().toISOString(),
        validated_by: session.user.id,
      })
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

    return NextResponse.json({
      audio_url: updated.audio_url,
      duration_s: updated.duration_s,
      status: updated.status,
    })
  } catch (error) {
    console.error('Erreur API admin/news/episodes/[id]/generate-audio:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
