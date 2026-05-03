import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/rbac'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateFullAudio } from '@/lib/elevenlabs'

// Heuristique 128 kbps (cf. /api/admin/news/episodes/[id]/generate-audio).
const BYTES_PER_SECOND_128KBPS = 16_000

export const dynamic = 'force-dynamic'
// 5 minutes pour absorber 1800 mots (12 min de podcast) en plusieurs chunks ElevenLabs.
export const maxDuration = 300

// POST — génère le MP3 du journal et le publie automatiquement.
//   1. Auth admin
//   2. Pré-checks : type='journal', status='draft', script_md non vide,
//                   ELEVENLABS_API_KEY présente
//   3. ElevenLabs text-to-dialogue par chunks → buffer MP3 final
//   4. Upload Supabase Storage news-audio/{episode_id}.mp3 (upsert: true
//      pour permettre la régénération sans suppression manuelle)
//   5. UPDATE audio_url, duration_s, status='published', published_at,
//      validated_by
//   6. Retourne { audio_url, duration_s, status }

export async function POST(
  _request: Request,
  { params }: { params: { id: string } },
) {
  try {
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
      .select('id, type, status, script_md')
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
    if (episode.status !== 'draft') {
      return NextResponse.json(
        {
          error:
            'Génération audio autorisée uniquement sur un journal en draft',
        },
        { status: 409 },
      )
    }
    if (!episode.script_md || episode.script_md.trim().length === 0) {
      return NextResponse.json(
        { error: 'Script vide — générer le script avant l\'audio' },
        { status: 400 },
      )
    }

    // ----- 3. Génération audio (réutilise la fonction existante de
    //         /api/admin/news/episodes/[id]/generate-audio) -----
    let buffer: Buffer
    try {
      buffer = await generateFullAudio(episode.script_md)
    } catch (err) {
      console.error('Échec generateFullAudio (journal):', err)
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Échec génération audio' },
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
    // upsert: true — un journal en draft peut nécessiter plusieurs essais
    // (script ajusté manuellement, régénération). Le nom de fichier dérive
    // du UUID immuable de l'épisode.
    const objectKey = `journal/${episode.id}.mp3`
    const { error: uploadErr } = await adminSupabase
      .storage
      .from('news-audio')
      .upload(objectKey, buffer, {
        contentType: 'audio/mpeg',
        upsert: true,
      })

    if (uploadErr) {
      console.error('generate-audio journal upload error:', uploadErr)
      return NextResponse.json(
        { error: `Upload échoué : ${uploadErr.message}` },
        { status: 500 },
      )
    }

    const { data: publicUrlData } = adminSupabase
      .storage
      .from('news-audio')
      .getPublicUrl(objectKey)
    const audio_url = publicUrlData.publicUrl

    const duration_s = Math.max(
      1,
      Math.round(buffer.byteLength / BYTES_PER_SECOND_128KBPS),
    )

    // ----- 5. UPDATE episode -----
    const { data: updated, error: updErr } = await adminSupabase
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

    if (updErr) {
      console.error('generate-audio journal update error:', updErr)
      return NextResponse.json(
        { error: updErr.message, audio_url, duration_s },
        { status: 500 },
      )
    }

    return NextResponse.json({
      audio_url: updated.audio_url,
      duration_s: updated.duration_s,
      status: updated.status,
    })
  } catch (err) {
    console.error('POST generate-audio journal error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
