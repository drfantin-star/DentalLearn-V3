import type { DialogueInput } from './types'

/**
 * Découpe une liste de DialogueInput en chunks respectant maxChars.
 * Réimplémentation TypeScript fidèle de la logique de chunking Python.
 *
 * Règle : un chunk ne dépasse pas maxChars caractères.
 * Une réplique entière n'est jamais coupée à mi-chemin.
 * Si une réplique seule dépasse maxChars, elle forme son propre chunk (cas exceptionnel).
 */
export function splitIntoChunks(
  _inputs: DialogueInput[],
  _maxChars: number
): DialogueInput[][] {
  throw new Error('Not implemented — Sprint 4 T2')
}

/**
 * Estime le nombre de chunks qui seront produits (pour affichage UI avant génération).
 */
export function estimateChunkCount(
  _inputs: DialogueInput[],
  _withTimestamps: boolean
): number {
  throw new Error('Not implemented — Sprint 4 T2')
}
