import type { Scene, TimelineConcept } from './schema'

/**
 * Calcule, pour l'éditeur de timeline, où chaque concept se situe par rapport
 * aux scènes et s'il sera réellement affiché pendant la lecture.
 *
 * Rappel du modèle de lecture (cf. `EnrichedAudioPlayer`) :
 *  - Une scène occupe une fenêtre `[start_sec, end_sec]`. Un concept est un
 *    point unique `at_sec`.
 *  - Pendant la lecture, le whiteboard affiche la scène active ; **hors** de
 *    toute fenêtre de scène (un *gap*), il affiche le concept « passé » le plus
 *    récent (le plus grand `at_sec ≤ t`) parmi les concepts *éligibles*.
 *  - Éligible = `term` et `definition` non vides, `at_sec` numérique,
 *    `hidden !== true` (mêmes filtres que `getConceptsForScene`).
 *
 * Conséquence : un concept n'est affiché que si son « règne » — l'intervalle
 * `[at_sec, at_sec du concept éligible suivant)` — recouvre au moins un gap.
 * Un concept dont l'`at_sec` tombe dans une fenêtre de scène ET qui est
 * supplanté par le concept suivant avant le prochain gap ne s'affiche jamais.
 */

export type ConceptDisplayStatus =
  | 'visible' // sera affiché pendant un gap
  | 'never' // éligible mais jamais à l'écran (recouvert par les scènes)
  | 'disabled' // hidden === true
  | 'incomplete' // term/definition/at_sec manquant → ignoré par la lecture

export interface ConceptPlacement {
  concept: TimelineConcept
  /** Index dans le tableau `concepts` d'origine. */
  index: number
  atSec: number | null
  status: ConceptDisplayStatus
  /** Scène sous laquelle afficher le concept : la dernière dont `start_sec ≤ at_sec`. */
  anchorSceneId: string | null
  /** Scène dont la fenêtre `[start, end]` contient `at_sec`, si applicable. */
  insideScene: { id: string; title: string } | null
}

export interface ConceptPlacementResult {
  placements: ConceptPlacement[]
  /** Concepts ancrés (groupés) par `anchorSceneId`, triés par `at_sec` croissant. */
  byAnchorScene: Map<string, ConceptPlacement[]>
  /** Concepts horodatés dont l'`at_sec` précède la première scène. */
  beforeFirst: ConceptPlacement[]
  /** Concepts sans `at_sec` (jamais affichés — pipeline T2 sans extraction LLM). */
  noTimestamp: ConceptPlacement[]
  /** Nombre de concepts qui s'afficheront effectivement. */
  visibleCount: number
  /** Nombre de concepts éligibles (term+def+at_sec, non masqués). */
  eligibleCount: number
}

type Interval = [number, number]

function mergeWindows(scenes: Scene[], end: number): Interval[] {
  const windows = scenes
    .map((s): Interval => [Math.max(0, s.start_sec), Math.min(end, s.end_sec)])
    .filter(([a, b]) => b > a)
    .sort((a, b) => a[0] - b[0])

  const merged: Interval[] = []
  for (const w of windows) {
    const last = merged[merged.length - 1]
    if (last && w[0] <= last[1]) {
      last[1] = Math.max(last[1], w[1])
    } else {
      merged.push([w[0], w[1]])
    }
  }
  return merged
}

function computeGaps(scenes: Scene[], end: number): Interval[] {
  const merged = mergeWindows(scenes, end)
  const gaps: Interval[] = []
  let cursor = 0
  for (const [a, b] of merged) {
    if (a > cursor) gaps.push([cursor, a])
    cursor = Math.max(cursor, b)
  }
  if (cursor < end) gaps.push([cursor, end])
  return gaps
}

function intersectsAnyGap(start: number, end: number, gaps: Interval[]): boolean {
  for (const [a, b] of gaps) {
    if (start < b && end > a) return true
  }
  return false
}

function isEligible(
  c: TimelineConcept
): c is TimelineConcept & { at_sec: number; term: string; definition: string } {
  return (
    typeof c.at_sec === 'number' &&
    typeof c.term === 'string' &&
    c.term.length > 0 &&
    typeof c.definition === 'string' &&
    c.definition.length > 0 &&
    c.hidden !== true
  )
}

export function computeConceptPlacements(
  scenes: Scene[],
  concepts: TimelineConcept[],
  durationSec: number
): ConceptPlacementResult {
  const scenesByStart = [...scenes].sort((a, b) => a.start_sec - b.start_sec)

  // Borne temporelle effective : la durée audio, ou à défaut la fin de scène /
  // le dernier at_sec connu (timeline sans durée fiable).
  const maxSceneEnd = scenes.reduce((m, s) => Math.max(m, s.end_sec), 0)
  const maxAtSec = concepts.reduce(
    (m, c) => (typeof c.at_sec === 'number' ? Math.max(m, c.at_sec) : m),
    0
  )
  const end = Math.max(durationSec || 0, maxSceneEnd, maxAtSec)
  const gaps = computeGaps(scenesByStart, end)

  // « Règnes » des concepts éligibles : bornés par l'at_sec éligible suivant.
  const eligibleSorted = concepts
    .map((concept, index) => ({ concept, index }))
    .filter((e) => isEligible(e.concept))
    .sort((a, b) => (a.concept.at_sec ?? 0) - (b.concept.at_sec ?? 0))

  const visibleByIndex = new Set<number>()
  for (let i = 0; i < eligibleSorted.length; i++) {
    const at = eligibleSorted[i].concept.at_sec as number
    const reignEnd =
      i + 1 < eligibleSorted.length
        ? (eligibleSorted[i + 1].concept.at_sec as number)
        : end
    if (intersectsAnyGap(at, reignEnd, gaps)) {
      visibleByIndex.add(eligibleSorted[i].index)
    }
  }

  function anchorSceneFor(atSec: number): string | null {
    let anchor: string | null = null
    for (const s of scenesByStart) {
      if (s.start_sec <= atSec) anchor = s.id
      else break
    }
    return anchor
  }

  function insideSceneFor(atSec: number): { id: string; title: string } | null {
    // Si plusieurs scènes se chevauchent, la plus récente (start le plus grand)
    // gagne — cohérent avec `getActiveScene`.
    let found: { id: string; title: string } | null = null
    for (const s of scenesByStart) {
      if (atSec >= s.start_sec && atSec <= s.end_sec) {
        found = { id: s.id, title: s.title?.trim() || '(sans titre)' }
      }
    }
    return found
  }

  const placements: ConceptPlacement[] = concepts.map((concept, index) => {
    const atSec = typeof concept.at_sec === 'number' ? concept.at_sec : null

    let status: ConceptDisplayStatus
    if (concept.hidden === true) {
      status = 'disabled'
    } else if (!isEligible(concept)) {
      status = 'incomplete'
    } else {
      status = visibleByIndex.has(index) ? 'visible' : 'never'
    }

    const anchorSceneId = atSec === null ? null : anchorSceneFor(atSec)
    const insideScene = atSec === null ? null : insideSceneFor(atSec)

    return { concept, index, atSec, status, anchorSceneId, insideScene }
  })

  // Tri par at_sec pour l'affichage groupé (les concepts sans at_sec en fin).
  const byAtSec = (a: ConceptPlacement, b: ConceptPlacement) =>
    (a.atSec ?? Number.POSITIVE_INFINITY) - (b.atSec ?? Number.POSITIVE_INFINITY)

  const byAnchorScene = new Map<string, ConceptPlacement[]>()
  const beforeFirst: ConceptPlacement[] = []
  const noTimestamp: ConceptPlacement[] = []
  for (const p of [...placements].sort(byAtSec)) {
    if (p.atSec === null) {
      noTimestamp.push(p)
    } else if (p.anchorSceneId === null) {
      beforeFirst.push(p)
    } else {
      const arr = byAnchorScene.get(p.anchorSceneId) ?? []
      arr.push(p)
      byAnchorScene.set(p.anchorSceneId, arr)
    }
  }

  return {
    placements,
    byAnchorScene,
    beforeFirst,
    noTimestamp,
    visibleCount: visibleByIndex.size,
    eligibleCount: eligibleSorted.length,
  }
}
