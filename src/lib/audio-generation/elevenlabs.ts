import type { GenerateAudioOptions, GenerateAudioResult } from './types'

/**
 * Génère l'audio d'un dialogue Sophie/Martin complet via ElevenLabs.
 *
 * Workflow :
 * 1. Découpe inputs en chunks via splitIntoChunks
 * 2. Pour chaque chunk : appel ElevenLabs text_to_dialogue (convert ou convert_with_timestamps)
 *    avec retry 3x et pause inter-chunk
 * 3. Concaténation des buffers MP3
 * 4. Merge des alignments avec offset temporel
 * 5. Filtrage balises émotion des alignments (préserve l'audio)
 *
 * Note : utilise ELEVENLABS_API_KEY depuis process.env
 * Note : withTimestamps=true → maxCharsPerChunk défaut 1900, sinon 4500
 */
export async function generateDialogueAudio(
  _options: GenerateAudioOptions
): Promise<GenerateAudioResult> {
  throw new Error('Not implemented — Sprint 4 T2')
}
