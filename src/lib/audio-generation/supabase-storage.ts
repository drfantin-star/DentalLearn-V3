/**
 * Helpers d'upload vers Supabase Storage.
 * Utilise le client Supabase avec service_role (pas de RLS).
 */

/**
 * Upload un MP3 dans le bucket 'formations' ou 'news-audio'.
 * Path ex : 'felures/sequence_04_techniques.mp3'
 * Retourne l'URL publique.
 */
export async function uploadAudioMp3(
  _audio: Buffer,
  _bucket: 'formations' | 'news-audio',
  _path: string
): Promise<{ url: string }> {
  throw new Error('Not implemented — Sprint 4 T2')
}

/**
 * Upload un fichier JSON timeline dans le bucket 'audio-timelines'.
 * Path ex : 'formations/sequence-uuid-ISO.json'
 * Retourne l'URL publique.
 */
export async function uploadTimelineJson(
  _timeline: Record<string, unknown>,
  _path: string
): Promise<{ url: string }> {
  throw new Error('Not implemented — Sprint 4 T2')
}
