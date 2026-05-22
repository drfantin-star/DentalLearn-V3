import type { Scene, TimelineConcept } from './schema'

/**
 * Type étroit d'un concept "affichable" : on a la garantie que les champs
 * optionnels du schéma (`term`, `definition`, `at_sec`) sont définis.
 * `getActiveConcept` filtre les concepts incomplets avant de retourner.
 */
export type DisplayableConcept = TimelineConcept & {
  term: string
  definition: string
  at_sec: number
}

/**
 * Retourne la scène active selon le timestamp courant.
 *
 * Sémantique (spec POC §5.1, adaptée au schéma Timeline v1.0 livré T3 qui
 * encode la fenêtre via `start_sec`/`end_sec` plutôt que `trigger_at_sec` +
 * `display_duration_sec`) :
 *
 *  - Une scène est active à `t` si `start_sec <= t <= end_sec`.
 *  - Si plusieurs scènes se chevauchent à `t`, on retourne la plus récente
 *    (celle dont `start_sec` est le plus grand, donc la plus tardivement
 *    déclenchée — comportement "la dernière qui parle gagne").
 *  - Si aucune scène n'est active (gap entre deux scènes, avant la première,
 *    après la dernière), retourne `null`.
 *
 * Cas limites :
 *  - `scenes` vide → `null`
 *  - `currentTime < scenes[0].start_sec` → `null`
 *  - `currentTime` exactement sur un `start_sec` → scène active (`<=`, pas `<`)
 *  - `currentTime` exactement sur un `end_sec` → scène encore active (`<=`)
 *  - `currentTime` négatif → `null`
 *  - Deux scènes qui se chevauchent : la plus récente (start_sec le plus tard)
 *    gagne, conformément à la règle "la dernière déclenchée prend la main".
 *
 * Robustesse : on copie+trie défensivement par `start_sec` ascendant. En
 * pratique le pipeline T2 livre les scènes dans l'ordre, mais on ne veut pas
 * dépendre de cette garantie côté client.
 *
 * @example
 *   const scenes = [
 *     { id: 's1', start_sec: 0,  end_sec: 10, ... },
 *     { id: 's2', start_sec: 15, end_sec: 27, ... },
 *   ]
 *   getActiveScene(5,  scenes) // → s1
 *   getActiveScene(12, scenes) // → null  (gap entre s1 et s2)
 *   getActiveScene(20, scenes) // → s2
 *   getActiveScene(30, scenes) // → null  (s2 a expiré)
 */
export function getActiveScene(
  currentTime: number,
  scenes: Scene[]
): Scene | null {
  if (!scenes.length) return null
  if (currentTime < 0) return null

  // Tri défensif (non destructif) : ascending par start_sec.
  const sorted =
    isAscByStart(scenes) ? scenes : [...scenes].sort((a, b) => a.start_sec - b.start_sec)

  // Itération en sens inverse : on prend la plus récente dont la fenêtre
  // [start_sec, end_sec] couvre currentTime. Linéaire ; pour 6 scènes c'est
  // largement assez rapide et ça évite la complexité d'une recherche binaire
  // (les fenêtres peuvent se chevaucher, ce qui casse l'invariant binaire).
  for (let i = sorted.length - 1; i >= 0; i--) {
    const scene = sorted[i]
    if (
      currentTime >= scene.start_sec &&
      currentTime <= scene.end_sec
    ) {
      return scene
    }
  }
  return null
}

function isAscByStart(scenes: Scene[]): boolean {
  for (let i = 1; i < scenes.length; i++) {
    if (scenes[i].start_sec < scenes[i - 1].start_sec) return false
  }
  return true
}

/**
 * Variante "continuité visuelle" de `getActiveScene` pour POC-T7.2.
 *
 * Sémantique :
 *  - `scenes` vide ⇒ `null`
 *  - `currentTime < 0` ⇒ `null`
 *  - `currentTime < firstScene.start_sec` (gap initial avant la première
 *    scène) ⇒ `null` (on veut afficher la cover de la séquence pendant
 *    cet intervalle, pas une scène)
 *  - Sinon ⇒ la dernière scène dont `start_sec <= currentTime`. Cela
 *    couvre :
 *      - la scène activement en cours (start_sec ≤ t ≤ end_sec)
 *      - les gaps inter-scènes (la scène précédente reste affichée)
 *      - le gap après la dernière scène (la dernière scène reste
 *        affichée jusqu'à la fin de l'audio)
 *
 * Pourquoi un helper distinct : `getActiveScene` est consommé par les
 * pages T3/T4/T5/T6 (admin) qui s'appuient sur sa sémantique stricte
 * (« null pendant les gaps »). Modifier `getActiveScene` casserait ces
 * pages. Le helper distinct est utilisé uniquement par le wrapper user
 * `<EnrichedAudioPlayer>` (T7.2 et T7.3) où la continuité visuelle est
 * souhaitée.
 *
 * Robustesse : tri défensif comme `getActiveScene` (réutilise
 * `isAscByStart` du même module).
 *
 * @example
 *   const scenes = [
 *     { id: 's1', start_sec: 0,   end_sec: 187.5, ... },
 *     { id: 's2', start_sec: 250.4, end_sec: 350,  ... },
 *   ]
 *   getActiveOrLastScene(50,  scenes)  // → s1 (active)
 *   getActiveOrLastScene(200, scenes)  // → s1 (gap inter, dernière connue)
 *   getActiveOrLastScene(300, scenes)  // → s2 (active)
 *   getActiveOrLastScene(400, scenes)  // → s2 (post-dernière)
 *   getActiveOrLastScene(-1,  scenes)  // → null
 */
export function getActiveOrLastScene(
  currentTime: number,
  scenes: Scene[]
): Scene | null {
  if (!scenes.length) return null
  if (currentTime < 0) return null

  const sorted =
    isAscByStart(scenes) ? scenes : [...scenes].sort((a, b) => a.start_sec - b.start_sec)

  // Gap initial avant la première scène : on préserve la cover.
  if (currentTime < sorted[0].start_sec) return null

  // Itération inverse : on prend la dernière scène (la plus récente)
  // dont `start_sec <= currentTime`. Couvre intra-scène, gap inter, et
  // post-dernière-scène d'un seul coup.
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i].start_sec <= currentTime) {
      return sorted[i]
    }
  }
  // Inatteignable : on a déjà testé `currentTime >= sorted[0].start_sec`.
  return null
}

/**
 * Retourne le concept "affichable" (term + definition + at_sec présents,
 * non masqué) dont `at_sec` est le plus grand parmi ceux ≤ `currentTime`.
 *
 * Utilisé par `<EnrichedAudioPlayer>` (T7-bis) pour combler les gaps du
 * whiteboard quand aucune scène n'est strictement active. Préfère un
 * concept récemment "passé" à la mention d'une scène expirée (priorité
 * concept sur extension de scène — mode hybride T7-bis).
 *
 * Filtres appliqués :
 *  - `at_sec` numérique défini (T2 ne remplit pas ce champ ; T5/Sonnet oui)
 *  - `term` non vide
 *  - `definition` non vide
 *  - `hidden !== true` (admin masquage T6.5.b)
 *  - `at_sec <= currentTime`
 *
 * Tri défensif par `at_sec` ascending (le pipeline T5 livre dans l'ordre,
 * mais on ne dépend pas de cette garantie côté client).
 */
export function getActiveConcept(
  currentTime: number,
  concepts: TimelineConcept[]
): DisplayableConcept | null {
  if (!concepts.length) return null
  if (currentTime < 0) return null

  const passed = concepts.filter(
    (c): c is DisplayableConcept =>
      typeof c.at_sec === 'number' &&
      typeof c.term === 'string' &&
      c.term.length > 0 &&
      typeof c.definition === 'string' &&
      c.definition.length > 0 &&
      c.hidden !== true &&
      c.at_sec <= currentTime
  )
  if (passed.length === 0) return null

  const sorted = [...passed].sort((a, b) => a.at_sec - b.at_sec)
  return sorted[sorted.length - 1]
}

/**
 * Retourne TOUS les concepts affichables du gap courant, triés par `at_sec`
 * croissant. Permet d'afficher simultanément plusieurs concepts qui se
 * succèdent dans un même gap inter-scènes.
 *
 * Logique :
 *  - Le "gap courant" commence à la fin de la dernière scène terminée avant
 *    `currentTime` (ou à 0 s'il n'y a pas encore de scène).
 *  - Sont inclus tous les concepts éligibles dont `at_sec` est compris dans
 *    `[gapStart, currentTime]`.
 */
export function getActiveConcepts(
  currentTime: number,
  concepts: TimelineConcept[],
  scenes: Scene[]
): DisplayableConcept[] {
  if (!concepts.length) return []
  if (currentTime < 0) return []

  const sortedScenes = isAscByStart(scenes)
    ? scenes
    : [...scenes].sort((a, b) => a.start_sec - b.start_sec)

  let gapStart = 0
  for (const scene of sortedScenes) {
    if (scene.end_sec <= currentTime) {
      gapStart = Math.max(gapStart, scene.end_sec)
    }
  }

  return concepts
    .filter(
      (c): c is DisplayableConcept =>
        typeof c.at_sec === 'number' &&
        typeof c.term === 'string' &&
        c.term.length > 0 &&
        typeof c.definition === 'string' &&
        c.definition.length > 0 &&
        c.hidden !== true &&
        c.at_sec >= gapStart &&
        c.at_sec <= currentTime
    )
    .sort((a, b) => a.at_sec - b.at_sec)
}
