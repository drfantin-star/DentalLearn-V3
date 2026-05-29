// Tests unitaires PURS du moteur de scoring — sans dépendance externe.
//
// Le repo n'a pas de runner de tests unitaires (jest/vitest) et CLAUDE.md
// interdit d'ajouter une dépendance sans demande nominative. Ce fichier utilise
// donc un mini-harnais d'assertions maison ; il est exécutable hors build via :
//   npx tsc --module commonjs --target es2020 --moduleResolution node \
//     --outDir /tmp/sc src/lib/autoeval/{types,scoring,scoring.test}.ts && \
//     node /tmp/sc/src/lib/autoeval/scoring.test.js
// Quand un runner sera ajouté, `runScoringTests()` pourra être appelé depuis un
// `it(...)`. Couverture : chaque borne CBI / palier maison / forcing / routage.

import {
  aggregateResults,
  evaluateSubstancesBlock,
  scoreCbiBlock,
  scoreReflexifBlock,
} from './scoring'
import type {
  Answers,
  Questionnaire,
  QuestionnaireBlock,
  QuestionnaireItem,
} from './types'

// ── mini-harness ────────────────────────────────────────────────────────────
let passed = 0
const failures: string[] = []
function check(label: string, cond: boolean) {
  if (cond) passed++
  else failures.push(label)
}
function eq(label: string, a: unknown, b: unknown) {
  check(`${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`, a === b)
}

// ── builders ─────────────────────────────────────────────────────────────────
let idc = 0
function item(p: Partial<QuestionnaireItem>): QuestionnaireItem {
  return {
    id: `i${idc++}`,
    block_id: 'b',
    ordre: 1,
    libelle: '',
    libelle_en: null,
    type_input: 'scale',
    options: null,
    sens: 'na',
    reverse: false,
    factual_card: null,
    ...p,
  }
}
function block(p: Partial<QuestionnaireBlock>): QuestionnaireBlock {
  return {
    id: 'b',
    questionnaire_id: 'q',
    ordre: 1,
    titre: '',
    type_bloc: 'cbi',
    verrouille: false,
    scoring_rule: null,
    recap_config: null,
    items: [],
    ...p,
  }
}
const CBI_OPTS = [0, 25, 50, 75, 100].map((v) => ({ label: String(v), value: v }))

// ── CBI : bornes de bandes < 50 / 50-74 / ≥ 75 ────────────────────────────────
function cbiBlock(itemAnswers: number[], reverseLast = false): {
  blk: QuestionnaireBlock
  answers: Answers
} {
  const items = itemAnswers.map((_, idx) =>
    item({
      ordre: idx + 1,
      type_input: 'scale',
      options: CBI_OPTS,
      sens: 'negatif',
      reverse: reverseLast && idx === itemAnswers.length - 1,
    })
  )
  const answers: Answers = {}
  items.forEach((it, idx) => (answers[it.id] = itemAnswers[idx]))
  const blk = block({
    type_bloc: 'cbi',
    items,
    scoring_rule: {
      subscales: [{ key: 's', label: 'Sous-échelle', items: items.map((i) => i.ordre) }],
      bands: { moderate: 50, high: 75 },
      routeHighTo: 'sps',
    },
    recap_config: {
      bands: {
        low: { label: 'Faible', message: 'low' },
        moderate: { label: 'Modéré', message: 'mod' },
        high: { label: 'Élevé', message: 'high' },
      },
    },
  })
  return { blk, answers }
}

;(() => {
  // moyenne 25 → low
  let { blk, answers } = cbiBlock([25, 25])
  eq('CBI score 25 → low', scoreCbiBlock(blk, answers)[0].band, 'low')
  // moyenne 49 (50 & 48→47.5? on vise <50) : 25 & 50 → 37.5 → low
  ;({ blk, answers } = cbiBlock([0, 75]))
  eq('CBI score 37 → low', scoreCbiBlock(blk, answers)[0].band, 'low') // (0+75)/2=37.5
  // exactement 50 → moderate (borne basse incluse)
  ;({ blk, answers } = cbiBlock([50, 50]))
  eq('CBI score 50 → moderate', scoreCbiBlock(blk, answers)[0].band, 'moderate')
  // 74 → moderate
  ;({ blk, answers } = cbiBlock([75, 50])) // 62.5
  eq('CBI score 62 → moderate', scoreCbiBlock(blk, answers)[0].band, 'moderate')
  // exactement 75 → high (borne incluse)
  ;({ blk, answers } = cbiBlock([75, 75]))
  eq('CBI score 75 → high', scoreCbiBlock(blk, answers)[0].band, 'high')
  // item inversé : réponse 0 sur item reverse → compte comme 100
  ;({ blk, answers } = cbiBlock([100, 0], true)) // (100 + (100-0))/2 = 100
  eq('CBI reverse item10 (0→100)', scoreCbiBlock(blk, answers)[0].score, 100)
  eq('CBI reverse → high', scoreCbiBlock(blk, answers)[0].band, 'high')
})()

// ── Réflexif : paliers ≤ 25 / 26-55 / > 55 % + sens/reverse + forcing ────────
function reflexifBlock(opts: {
  maxPerItem: number
  scored: { ordre: number; reverse?: boolean }[]
  answers: Record<number, number>
  forcing?: { item_ordre: number; values: number[]; min_palier: 'orange' | 'rouge' }[]
}): { blk: QuestionnaireBlock; answers: Answers } {
  const items = opts.scored.map((s) =>
    item({ ordre: s.ordre, type_input: 'scale', sens: s.reverse ? 'positif' : 'negatif', reverse: !!s.reverse })
  )
  const answers: Answers = {}
  items.forEach((it) => (answers[it.id] = opts.answers[it.ordre]))
  const blk = block({
    type_bloc: 'reflexif',
    items,
    scoring_rule: {
      scoredItems: opts.scored.map((s) => s.ordre),
      maxPerItem: opts.maxPerItem,
      thresholds: { orange: 25, rouge: 55 },
      forcing: opts.forcing,
    },
    recap_config: { messages: { vert: 'v', orange: 'o', rouge: 'r' } },
  })
  return { blk, answers }
}

;(() => {
  // 0 % → vert
  let r = reflexifBlock({ maxPerItem: 3, scored: [{ ordre: 1 }, { ordre: 2 }], answers: { 1: 0, 2: 0 } })
  eq('reflexif 0% → vert', scoreReflexifBlock(r.blk, r.answers).palier, 'vert')
  // exactement 25 % → vert (borne : orange si > 25)
  r = reflexifBlock({ maxPerItem: 20, scored: [{ ordre: 1 }], answers: { 1: 5 } }) // 5/20 = 25%
  eq('reflexif 25% → vert', scoreReflexifBlock(r.blk, r.answers).palier, 'vert')
  // 30 % → orange
  r = reflexifBlock({ maxPerItem: 20, scored: [{ ordre: 1 }], answers: { 1: 6 } }) // 30%
  eq('reflexif 30% → orange', scoreReflexifBlock(r.blk, r.answers).palier, 'orange')
  // exactement 55 % → orange (rouge si > 55)
  r = reflexifBlock({ maxPerItem: 20, scored: [{ ordre: 1 }], answers: { 1: 11 } }) // 55%
  eq('reflexif 55% → orange', scoreReflexifBlock(r.blk, r.answers).palier, 'orange')
  // 60 % → rouge
  r = reflexifBlock({ maxPerItem: 20, scored: [{ ordre: 1 }], answers: { 1: 12 } }) // 60%
  eq('reflexif 60% → rouge', scoreReflexifBlock(r.blk, r.answers).palier, 'rouge')
  // item positif (reverse) : réponse jamais=0 → compte comme 3 (max) → préoccupation max
  r = reflexifBlock({ maxPerItem: 3, scored: [{ ordre: 1, reverse: true }], answers: { 1: 0 } }) // 3/3=100%
  eq('reflexif positif reverse 0→3 → rouge', scoreReflexifBlock(r.blk, r.answers).palier, 'rouge')
  // forcing : fourmillements souvent/toujours (valeur 2 ou 3) force orange même si vert
  r = reflexifBlock({
    maxPerItem: 3,
    scored: [{ ordre: 1 }, { ordre: 2 }],
    answers: { 1: 0, 2: 2 }, // total 2/6 = 33% → déjà orange ; testons le forcing pur ci-dessous
    forcing: [{ item_ordre: 2, values: [2, 3], min_palier: 'orange' }],
  })
  const forcedRes = scoreReflexifBlock(r.blk, r.answers)
  check('reflexif forcing → au moins orange', forcedRes.palier !== 'vert')
  // forcing pur : score 0% mais item de forcing déclenché → orange + forced=true
  r = reflexifBlock({
    maxPerItem: 100,
    scored: [{ ordre: 1 }],
    answers: { 1: 0, 2: 3 }, // 0% scoré
    forcing: [{ item_ordre: 2, values: [2, 3], min_palier: 'orange' }],
  })
  // ordre 2 doit exister comme item pour être lu : on l'ajoute
  r.blk.items.push(item({ ordre: 2, type_input: 'scale' }))
  r.answers[r.blk.items[r.blk.items.length - 1].id] = 3
  const pure = scoreReflexifBlock(r.blk, r.answers)
  eq('reflexif forcing pur → orange', pure.palier, 'orange')
  eq('reflexif forcing pur → forced', pure.forced, true)
})()

// ── Substances : carte conditionnelle (string values) ────────────────────────
;(() => {
  const i1 = item({ ordre: 1, type_input: 'scale' })
  const i2 = item({ ordre: 2, type_input: 'yesno' })
  const i3 = item({ ordre: 3, type_input: 'scale' })
  const i4 = item({ ordre: 4, type_input: 'choice' })
  const blk = block({
    type_bloc: 'substances',
    items: [i1, i2, i3, i4],
    scoring_rule: {
      cardConditions: [
        { item_ordre: 2, values: ['oui'] },
        { item_ordre: 4, values: ['oui', 'peut-etre'] },
        { item_ordre: 3, values: ['souvent', 'toujours'] },
      ],
      routeKey: 'sps',
    },
    recap_config: { neutralMessage: 'neutre' },
  })
  eq('substances aucun flag → neutral', evaluateSubstancesBlock(blk, { [i2.id]: 'non' }).triggered, false)
  eq('substances item2=oui → trigger', evaluateSubstancesBlock(blk, { [i2.id]: 'oui' }).triggered, true)
  eq('substances item3=souvent → trigger', evaluateSubstancesBlock(blk, { [i3.id]: 'souvent' }).triggered, true)
  eq('substances item4=peut-etre → trigger', evaluateSubstancesBlock(blk, { [i4.id]: 'peut-etre' }).triggered, true)
})()

// ── Agrégation : routage SPS dédoublonné + top préoccupations ─────────────────
;(() => {
  const cbi = cbiBlock([100, 100]) // high → sps
  const subItem = item({ ordre: 1, type_input: 'yesno' })
  const subBlk = block({
    id: 'sub',
    type_bloc: 'substances',
    items: [subItem],
    scoring_rule: { cardConditions: [{ item_ordre: 1, values: ['oui'] }], routeKey: 'sps' },
    recap_config: { neutralMessage: 'n' },
  })
  cbi.blk.titre = 'Épuisement'
  const q: Questionnaire = {
    id: 'q',
    slug: 'sante-axe4',
    titre: 't',
    description: null,
    axe_cp: 4,
    intro_text: null,
    time_estimate_min: 10,
    blocks: [cbi.blk, subBlk],
    routing: [
      {
        id: 'r1',
        ordre: 1,
        condition: { key: 'sps' },
        carte: { key: 'sps', title: 'SPS', body: '0 805 23 23 36', variant: 'sps' },
      },
    ],
  }
  const answers: Answers = { ...cbi.answers, [subItem.id]: 'oui' }
  const res = aggregateResults(q, answers)
  eq('aggregate SPS dédoublonné → 1 carte', res.cards.length, 1)
  eq('aggregate carte = sps', res.cards[0].key, 'sps')
  check('aggregate top contient préoccupation élevée', res.topPreoccupations.some((p) => p.severity === 3))
})()

// ── runner ─────────────────────────────────────────────────────────────────
// Les assertions s'exécutent au chargement du module (IIFE ci-dessus) ; ce
// getter expose le bilan. Appelable depuis un `it(...)` quand un runner existera.
export function runScoringTests(): { passed: number; failures: string[] } {
  return { passed, failures }
}
