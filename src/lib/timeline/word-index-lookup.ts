// Lookup helpers `word_index → start_sec` pour la conversion T5.2 entre la
// sortie BRUTE Sonnet (qui raisonne en `trigger_at_word_index` /
// `at_word_index` — entier fiable) et la `Timeline` finale Zod-validée
// (qui exige `start_sec` / `end_sec` / `at_sec` en secondes flottantes).
//
// Doit utiliser le MÊME ordre de flatten que le prompt
// `renderWordsWithIndex` côté llm-prompt-formations.ts pour garantir que
// l'index pointé par Sonnet pointe bien sur le mot attendu côté serveur.
//
// Réutilise `flattenTranscript` de findCurrentWord.ts pour ne pas
// dédupliquer la logique (l'ordre de parcours est garanti identique :
// segments puis words, sans tri).

import { flattenTranscript } from './findCurrentWord'
import type { Timeline } from './schema'

/**
 * Retourne le `start_sec` du mot à l'index global donné (0-based, position
 * dans le tableau aplati segments→words). Renvoie `null` si l'index est
 * négatif ou hors bornes — le caller décide du fallback (cf. T5.2 :
 * proportionnel à la position de la scène dans la liste).
 */
export function getSecAtWordIndex(
  transcript: Timeline['transcript'],
  wordIndex: number
): number | null {
  if (!Number.isInteger(wordIndex) || wordIndex < 0) return null
  const flat = flattenTranscript(transcript)
  if (wordIndex >= flat.length) return null
  return flat[wordIndex].start_sec
}

/**
 * Variante "lazy" pour caller qui doit appeler la lookup plusieurs fois sur
 * le même transcript : on factorise le flatten une seule fois.
 */
export function makeWordIndexLookup(
  transcript: Timeline['transcript']
): (wordIndex: number) => number | null {
  const flat = flattenTranscript(transcript)
  return (wordIndex: number) => {
    if (!Number.isInteger(wordIndex) || wordIndex < 0) return null
    if (wordIndex >= flat.length) return null
    return flat[wordIndex].start_sec
  }
}

/**
 * Nombre total de mots dans le transcript aplati. Utile pour le caller qui
 * veut décider d'un fallback proportionnel sans réaplatir.
 */
export function countWordsFlat(transcript: Timeline['transcript']): number {
  return flattenTranscript(transcript).length
}
