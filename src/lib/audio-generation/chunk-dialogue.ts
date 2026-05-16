import type { DialogueInput } from './types'

const DEFAULT_MAX_CHARS_WITH_TIMESTAMPS = 1900
const DEFAULT_MAX_CHARS_WITHOUT_TIMESTAMPS = 4500

/**
 * Découpe une liste de DialogueInput en chunks respectant maxChars.
 * Réimplémentation fidèle de split_into_chunks() Python (generate_audio_PHASE_2B.py).
 *
 * Une réplique entière n'est jamais coupée. Si une réplique seule dépasse
 * maxChars, elle forme son propre chunk (cas exceptionnel).
 */
export function splitIntoChunks(
  inputs: DialogueInput[],
  maxChars: number,
): DialogueInput[][] {
  const chunks: DialogueInput[][] = []
  let current: DialogueInput[] = []
  let currentChars = 0

  for (const input of inputs) {
    const len = input.text.length

    if (current.length > 0 && currentChars + len > maxChars) {
      chunks.push(current)
      current = []
      currentChars = 0
    }

    current.push(input)
    currentChars += len
  }

  if (current.length > 0) chunks.push(current)

  return chunks
}

/**
 * Estime le nombre de chunks pour affichage UI avant génération.
 */
export function estimateChunkCount(
  inputs: DialogueInput[],
  withTimestamps: boolean,
): number {
  const maxChars = withTimestamps
    ? DEFAULT_MAX_CHARS_WITH_TIMESTAMPS
    : DEFAULT_MAX_CHARS_WITHOUT_TIMESTAMPS
  return splitIntoChunks(inputs, maxChars).length
}
