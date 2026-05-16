import { createAdminClient } from '@/lib/supabase/admin'

const TIMELINE_BUCKET = 'audio-timelines'

/**
 * Upload un MP3 dans le bucket 'formations' ou 'news-audio'.
 * Path ex : 'felures/sequence_04_techniques.mp3'.
 */
export async function uploadAudioMp3(
  audio: Buffer,
  bucket: 'formations' | 'news-audio',
  path: string,
): Promise<{ url: string }> {
  const supabase = createAdminClient()

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, audio, {
      contentType: 'audio/mpeg',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Audio upload failed (${bucket}/${path}): ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl }
}

/**
 * Upload un fichier JSON timeline dans le bucket 'audio-timelines'.
 * Path ex : 'formations/sequence-uuid-ISO.json'.
 */
export async function uploadTimelineJson(
  timeline: Record<string, unknown>,
  path: string,
): Promise<{ url: string }> {
  const supabase = createAdminClient()
  const body = JSON.stringify(timeline, null, 2)

  const { error: uploadError } = await supabase.storage
    .from(TIMELINE_BUCKET)
    .upload(path, body, {
      contentType: 'application/json',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Timeline upload failed (${TIMELINE_BUCKET}/${path}): ${uploadError.message}`)
  }

  const { data } = supabase.storage.from(TIMELINE_BUCKET).getPublicUrl(path)
  return { url: data.publicUrl }
}
