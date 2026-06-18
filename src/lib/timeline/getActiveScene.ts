import type { Scene, TimelineConcept } from './schema'

/**
 * Type étroit d'un concept "affichable" : on a la garantie que les champs
 * optionnels du schéma (`term`, `definition`, `at_sec`) sont définis.
 * `getConceptsForScene` filtre les concepts incomplets avant de retourner.
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
 * Retourne TOUS les concepts affichables rattachés à `scene`, indépendamment
 * du `currentTime` (arbitrage 2A : pas de révélation progressive).
 *
 * Règle de rattachement concept → scène (arbitrage 3A avec raffinement gaps) —
 * aucun lien explicite n'existe dans le schéma, on dérive donc le rattachement
 * par le temps via la *même* règle de continuité que l'affichage des scènes :
 *
 *  - `at_sec` absent ou `=== 0` ⇒ concept exclu (garde anti-fallback raté :
 *    `llm-extraction` pose `at_sec = 0` quand le lookup word-index échoue).
 *  - sinon : `sceneOf = getActiveOrLastScene(concept.at_sec, scenes)`. Le
 *    concept appartient à `scene` ssi `sceneOf?.id === scene.id`.
 *
 * Cela couvre d'un seul coup les deux cas :
 *  - concept CONTENU dans la fenêtre `[start_sec, end_sec]` d'une scène ;
 *  - concept tombant dans un TROU inter-scènes ⇒ rattaché à la scène qui vient
 *    de se terminer (la "dernière connue" au sens de `getActiveOrLastScene`),
 *    donc jamais perdu.
 *
 * Filtres d'affichage : `at_sec` numérique non nul, `term` non vide,
 * `definition` non vide,
 * `hidden !== true`. Tri `at_sec` croissant.
 *
 * Helper pur, sans dépendance à `currentTime` ni à l'AudioContext. Aucune
 * signature existante modifiée — `getActiveScene`/`getActiveOrLastScene` et les
 * pages admin (T3–T8) restent intacts.
 */
export function getConceptsForScene(
  scene: Scene,
  concepts: TimelineConcept[],
  scenes: Scene[]
): DisplayableConcept[] {
  if (!concepts.length) return []

  return concepts
    .filter(
      (c): c is DisplayableConcept =>
        typeof c.at_sec === 'number' &&
        c.at_sec > 0 &&
        typeof c.term === 'string' &&
        c.term.length > 0 &&
        typeof c.definition === 'string' &&
        c.definition.length > 0 &&
        c.hidden !== true &&
        getActiveOrLastScene(c.at_sec, scenes)?.id === scene.id
    )
    .sort((a, b) => a.at_sec - b.at_sec)
}
