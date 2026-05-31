// Moteur de scoring de l'auto-évaluation santé — fonctions PURES (aucune I/O).
//
// La définition (libellés, échelles, sens, seuils) vient de la DB ; la logique
// vit ici, typée par type_bloc, avec des défauts sûrs si un champ scoring_rule
// manque. Enjeu : une bande CBI mal calculée peut ne PAS router vers SPS une
// personne qui en a besoin — cf. scoring.test.ts pour la couverture des bornes.

import type {
  Answers,
  AutoevalResults,
  BlockRecap,
  CbiBand,
  CbiRecapConfig,
  CbiScoringRule,
  CbiSubscaleResult,
  Palier,
  Preoccupation,
  Questionnaire,
  QuestionnaireBlock,
  QuestionnaireItem,
  QuestionnaireRouting,
  ReflexifRecapConfig,
  ReflexifResult,
  ReflexifScoringRule,
  RoutingCard,
  SubstancesRecapConfig,
  SubstancesScoringRule,
} from './types'

const DEFAULT_BAND_LABEL: Record<CbiBand, string> = {
  low: 'Faible',
  moderate: 'Modéré',
  high: 'Élevé',
}

function palierRank(p: Palier): number {
  return p === 'rouge' ? 2 : p === 'orange' ? 1 : 0
}

function maxNumericOption(item: QuestionnaireItem, fallback: number): number {
  const nums = (item.options ?? [])
    .map((o) => o.value)
    .filter((v): v is number => typeof v === 'number')
  return nums.length ? Math.max(...nums) : fallback
}

function itemsByOrdre(block: QuestionnaireBlock): Map<number, QuestionnaireItem> {
  return new Map(block.items.map((i) => [i.ordre, i]))
}

function answerMatches(raw: unknown, values: (string | number)[]): boolean {
  if (raw === undefined || raw === null) return false
  if (Array.isArray(raw)) return raw.some((v) => values.includes(v as string | number))
  return values.includes(raw as string | number)
}

// ── CBI ────────────────────────────────────────────────────────────────────

export function scoreCbiBlock(
  block: QuestionnaireBlock,
  answers: Answers
): CbiSubscaleResult[] {
  const rule = block.scoring_rule as CbiScoringRule | null
  const recap = block.recap_config as CbiRecapConfig | null
  if (!rule || !Array.isArray(rule.subscales)) return []

  const moderate = rule.bands?.moderate ?? 50
  const high = rule.bands?.high ?? 75
  const byOrdre = itemsByOrdre(block)

  return rule.subscales.map((sub) => {
    const vals: number[] = []
    for (const ordre of sub.items) {
      const item = byOrdre.get(ordre)
      if (!item) continue
      const raw = answers[item.id]
      if (typeof raw !== 'number') continue
      const maxOpt = maxNumericOption(item, 100)
      vals.push(item.reverse ? maxOpt - raw : raw)
    }
    const score = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    const band: CbiBand = score >= high ? 'high' : score >= moderate ? 'moderate' : 'low'
    const info = recap?.bands?.[band]
    return {
      key: sub.key,
      label: sub.label,
      score: Math.round(score),
      band,
      bandLabel: info?.label ?? DEFAULT_BAND_LABEL[band],
      message: info?.message ?? '',
    }
  })
}

// ── Dimensions réflexives maison ─────────────────────────────────────────────

export function scoreReflexifBlock(
  block: QuestionnaireBlock,
  answers: Answers
): ReflexifResult {
  const rule = block.scoring_rule as ReflexifScoringRule | null
  const recap = block.recap_config as ReflexifRecapConfig | null
  const maxPerItem = rule?.maxPerItem ?? 3
  const scoredItems = rule?.scoredItems ?? []
  const orangeT = rule?.thresholds?.orange ?? 25
  const rougeT = rule?.thresholds?.rouge ?? 55
  const byOrdre = itemsByOrdre(block)

  let total = 0
  let count = 0
  for (const ordre of scoredItems) {
    const item = byOrdre.get(ordre)
    if (!item) continue
    const raw = answers[item.id]
    if (typeof raw !== 'number') continue
    total += item.reverse ? maxPerItem - raw : raw
    count++
  }

  const max = maxPerItem * count
  const percent = max > 0 ? Math.round((total / max) * 100) : 0
  let palier: Palier = percent > rougeT ? 'rouge' : percent > orangeT ? 'orange' : 'vert'

  let forced = false
  for (const f of rule?.forcing ?? []) {
    const item = byOrdre.get(f.item_ordre)
    if (!item) continue
    const raw = answers[item.id]
    if (typeof raw === 'number' && f.values.includes(raw)) {
      if (palierRank(f.min_palier) > palierRank(palier)) {
        palier = f.min_palier
        forced = true
      }
    }
  }

  return {
    percent,
    palier,
    message: recap?.messages?.[palier] ?? '',
    forced,
  }
}

// ── Substances ────────────────────────────────────────────────────────────

export function evaluateSubstancesBlock(
  block: QuestionnaireBlock,
  answers: Answers
): { neutralMessage: string; triggered: boolean } {
  const rule = block.scoring_rule as SubstancesScoringRule | null
  const recap = block.recap_config as SubstancesRecapConfig | null
  const byOrdre = itemsByOrdre(block)

  let triggered = false
  for (const cond of rule?.cardConditions ?? []) {
    const item = byOrdre.get(cond.item_ordre)
    if (!item) continue
    if (answerMatches(answers[item.id], cond.values)) {
      triggered = true
      break
    }
  }

  return { neutralMessage: recap?.neutralMessage ?? '', triggered }
}

// ── Cartes factuelles (tous blocs confondus) ─────────────────────────────────

export function collectFactualRouteKeys(
  blocks: QuestionnaireBlock[],
  answers: Answers
): string[] {
  const keys: string[] = []
  for (const block of blocks) {
    for (const item of block.items) {
      const fc = item.factual_card
      if (!fc) continue
      if (answerMatches(answers[item.id], fc.triggerValues)) keys.push(fc.routeKey)
    }
  }
  return keys
}

function mapKeysToCards(
  keys: Set<string>,
  routing: QuestionnaireRouting[]
): RoutingCard[] {
  return routing
    .filter((r) => keys.has(r.condition?.key))
    .sort((a, b) => a.ordre - b.ordre)
    .map((r) => r.carte)
}

// ── Recap d'un bloc (modal après chaque bloc) ────────────────────────────────

export function computeBlockRecap(
  block: QuestionnaireBlock,
  answers: Answers,
  routing: QuestionnaireRouting[]
): BlockRecap {
  const recap: BlockRecap = {
    blockId: block.id,
    type_bloc: block.type_bloc,
    titre: block.titre,
    cards: [],
  }
  const keys = new Set<string>()

  if (block.type_bloc === 'cbi') {
    recap.cbi = scoreCbiBlock(block, answers)
    const rule = block.scoring_rule as CbiScoringRule | null
    if (rule?.routeHighTo && recap.cbi.some((s) => s.band === 'high')) {
      keys.add(rule.routeHighTo)
    }
  } else if (block.type_bloc === 'reflexif') {
    recap.reflexif = scoreReflexifBlock(block, answers)
    const rule = block.scoring_rule as ReflexifScoringRule | null
    for (const ro of rule?.routeOn ?? []) {
      if (palierRank(recap.reflexif.palier) >= palierRank(ro.palier)) keys.add(ro.key)
    }
  } else if (block.type_bloc === 'substances') {
    const s = evaluateSubstancesBlock(block, answers)
    recap.substancesNeutralMessage = s.neutralMessage
    const rule = block.scoring_rule as SubstancesScoringRule | null
    if (s.triggered && rule?.routeKey) keys.add(rule.routeKey)
  }

  // Cartes factuelles déclenchées par les items de CE bloc.
  for (const item of block.items) {
    const fc = item.factual_card
    if (fc && answerMatches(answers[item.id], fc.triggerValues)) keys.add(fc.routeKey)
  }

  recap.cards = mapKeysToCards(keys, routing)
  return recap
}

// ── Agrégation finale (synthèse) ─────────────────────────────────────────────

export function aggregateResults(
  questionnaire: Questionnaire,
  answers: Answers
): AutoevalResults {
  const allKeys = new Set<string>()
  const preoccupations: Preoccupation[] = []

  for (const block of questionnaire.blocks) {
    if (block.type_bloc === 'cbi') {
      const subs = scoreCbiBlock(block, answers)
      const rule = block.scoring_rule as CbiScoringRule | null
      for (const s of subs) {
        if (s.band === 'high') {
          preoccupations.push({ label: s.label, severity: 3, blockTitre: block.titre })
          if (rule?.routeHighTo) allKeys.add(rule.routeHighTo)
        } else if (s.band === 'moderate') {
          preoccupations.push({ label: s.label, severity: 2, blockTitre: block.titre })
        }
      }
    } else if (block.type_bloc === 'reflexif') {
      const r = scoreReflexifBlock(block, answers)
      const rule = block.scoring_rule as ReflexifScoringRule | null
      if (r.palier === 'rouge') {
        preoccupations.push({ label: block.titre, severity: 3, blockTitre: block.titre })
      } else if (r.palier === 'orange') {
        preoccupations.push({ label: block.titre, severity: 2, blockTitre: block.titre })
      }
      for (const ro of rule?.routeOn ?? []) {
        if (palierRank(r.palier) >= palierRank(ro.palier)) allKeys.add(ro.key)
      }
    } else if (block.type_bloc === 'substances') {
      const s = evaluateSubstancesBlock(block, answers)
      const rule = block.scoring_rule as SubstancesScoringRule | null
      if (s.triggered && rule?.routeKey) allKeys.add(rule.routeKey)
    }
  }

  for (const k of collectFactualRouteKeys(questionnaire.blocks, answers)) allKeys.add(k)

  // Tri stable : severity desc, puis ordre d'apparition (rouge/élevé prioritaire).
  const top = [...preoccupations].sort((a, b) => b.severity - a.severity).slice(0, 3)

  return {
    topPreoccupations: top,
    cards: mapKeysToCards(allKeys, questionnaire.routing),
  }
}
