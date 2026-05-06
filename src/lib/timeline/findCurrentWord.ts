import type { Timeline, Speaker } from './schema'

/**
 * Mot transcript "aplati" : porte les coords (segment, word) d'origine plus
 * la position absolue dans le tableau plat. Utilisé par le karaoké pour passer
 * d'un timestamp audio courant au mot actif en O(log n).
 */
export type FlatWord = {
  segmentIndex: number
  wordIndex: number
  start_sec: number
  end_sec: number
  text: string
  speaker: Speaker
}

/**
 * Aplatit un transcript multi-segments en un tableau de mots, en conservant
 * pour chaque mot son speaker et ses indices d'origine. Renvoie `[]` si le
 * transcript est absent ou si aucun segment ne contient de mots.
 *
 * L'ordre dans le tableau plat suit l'ordre source : segments puis mots.
 * Aucun tri n'est effectué — on suppose que le pipeline T2 livre un transcript
 * trié par `start_sec`, ce qui est une garantie du schéma v1.0.
 */
export function flattenTranscript(
  transcript: Timeline['transcript']
): FlatWord[] {
  if (!transcript || !transcript.segments?.length) return []

  const flat: FlatWord[] = []
  for (let s = 0; s < transcript.segments.length; s++) {
    const segment = transcript.segments[s]
    const words = segment.words ?? []
    for (let w = 0; w < words.length; w++) {
      const word = words[w]
      flat.push({
        segmentIndex: s,
        wordIndex: w,
        start_sec: word.start_sec,
        end_sec: word.end_sec,
        text: word.text,
        speaker: segment.speaker,
      })
    }
  }
  return flat
}

/**
 * Trouve le mot actif pour un `currentTime` donné, en O(log n) via recherche
 * binaire sur le tableau de mots plat.
 *
 * Sémantique :
 *  - `word.start_sec <= currentTime < word.end_sec` → ce mot est actif
 *  - `currentTime` dans un gap entre deux mots → on renvoie le **mot précédent**
 *    (le dernier mot dont `end_sec <= currentTime`)
 *  - `currentTime` avant le tout premier mot → `null`
 *  - `currentTime` après la fin du dernier mot → `null`
 *  - `currentTime < 0`, tableau vide → `null`
 *
 * @example
 *   // Tableau : [ {0.0→0.5 "Bonjour"}, {0.6→1.0 "Sophie"} ]
 *   findCurrentWord(words, 0.0)   // → "Bonjour" (start exact)
 *   findCurrentWord(words, 0.55)  // → "Bonjour" (gap : mot précédent)
 *   findCurrentWord(words, 0.6)   // → "Sophie"
 *   findCurrentWord(words, 1.0)   // → null (après fin du dernier mot)
 *   findCurrentWord(words, -1)    // → null
 */
export function findCurrentWord(
  flatWords: FlatWord[],
  currentTime: number
): FlatWord | null {
  if (!flatWords.length || currentTime < 0) return null
  if (currentTime < flatWords[0].start_sec) return null

  const last = flatWords[flatWords.length - 1]
  if (currentTime >= last.end_sec) return null

  // Recherche binaire : on cherche le plus grand index tel que
  // flatWords[i].start_sec <= currentTime. Si ce mot couvre currentTime
  // (currentTime < end_sec), c'est le mot actif. Sinon on est dans un gap →
  // ce mot est quand même le bon résultat (= mot précédent / dernier joué).
  let lo = 0
  let hi = flatWords.length - 1
  let candidate = -1

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    if (flatWords[mid].start_sec <= currentTime) {
      candidate = mid
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }

  if (candidate === -1) return null
  return flatWords[candidate]
}
