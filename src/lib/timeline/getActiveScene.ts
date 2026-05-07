import type { Scene } from './schema'

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
