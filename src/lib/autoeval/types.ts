// Types du module d'auto-évaluation santé (Axe 4 — Action B).
//
// IMPORTANT (RGPD Art. 9) : les réponses (`Answers`) et les résultats
// (`AutoevalResults`) vivent UNIQUEMENT en mémoire React. Rien n'est persisté
// hormis l'événement de complétion (cf. autoeval_completions).

// ── Définition (lignes DB) ───────────────────────────────────────────────

export type TypeBloc = 'cbi' | 'reflexif' | 'substances' | 'factuel'
export type TypeInput = 'scale' | 'yesno' | 'choice' | 'multi'
export type Sens = 'negatif' | 'positif' | 'na'

export interface ItemOption {
  label: string
  value: number | string
}

/** Item non scoré déclenchant une carte ressource (routeKey → questionnaire_routing). */
export interface FactualCard {
  triggerValues: (string | number)[]
  routeKey: string
}

export interface QuestionnaireItem {
  id: string
  block_id: string
  ordre: number
  libelle: string
  libelle_en: string | null
  type_input: TypeInput
  options: ItemOption[] | null
  sens: Sens
  reverse: boolean
  factual_card: FactualCard | null
}

export interface QuestionnaireBlock {
  id: string
  questionnaire_id: string
  ordre: number
  titre: string
  type_bloc: TypeBloc
  verrouille: boolean
  scoring_rule: ScoringRule | null
  recap_config: RecapConfig | null
  items: QuestionnaireItem[]
}

export interface RoutingCard {
  key: string
  title: string
  body: string
  phone?: string
  href?: string
  variant?: 'sps' | 'default' | 'sensitive'
}

export interface QuestionnaireRouting {
  id: string
  ordre: number
  condition: { key: string }
  carte: RoutingCard
}

export interface Questionnaire {
  id: string
  slug: string
  titre: string
  description: string | null
  axe_cp: number | null
  intro_text: string | null
  time_estimate_min: number | null
  blocks: QuestionnaireBlock[]
  routing: QuestionnaireRouting[]
}

// ── scoring_rule : forme typée par type_bloc ──────────────────────────────

export type Palier = 'vert' | 'orange' | 'rouge'

/** Sous-échelle CBI : moyenne des items (par `ordre`) → score 0-100. */
export interface CbiSubscale {
  key: string
  label: string
  items: number[] // ordres d'items dans le bloc
}

export interface CbiScoringRule {
  subscales: CbiSubscale[]
  bands: { moderate: number; high: number } // seuils 50 / 75
  routeHighTo?: string // clé de routage si band 'high' (ex. 'sps')
}

export interface ForcingRule {
  item_ordre: number
  values: number[] // valeurs (numériques) forçant le palier
  min_palier: Palier
}

export interface ReflexifScoringRule {
  scoredItems: number[] // ordres des items scorés (les autres = factuels)
  maxPerItem: number // 3 (échelle jamais/parfois/souvent/toujours)
  thresholds: { orange: number; rouge: number } // pourcentages : orange > 25, rouge > 55
  forcing?: ForcingRule[]
  routeOn?: { palier: Palier; key: string }[] // ex. orange/rouge → 'inrs_tms'
}

export interface SubstancesScoringRule {
  cardConditions: { item_ordre: number; values: (string | number)[] }[]
  routeKey: string // 'sps'
}

export type ScoringRule =
  | CbiScoringRule
  | ReflexifScoringRule
  | SubstancesScoringRule
  | Record<string, never>

// ── recap_config : messages affichés ──────────────────────────────────────

export interface BandInfo {
  label: string
  message: string
}

export interface CbiRecapConfig {
  bands: { low: BandInfo; moderate: BandInfo; high: BandInfo }
}

export interface ReflexifRecapConfig {
  messages: { vert: string; orange: string; rouge: string }
}

export interface SubstancesRecapConfig {
  neutralMessage: string
}

export type RecapConfig =
  | CbiRecapConfig
  | ReflexifRecapConfig
  | SubstancesRecapConfig
  | Record<string, unknown>

// ── État des réponses (mémoire uniquement) ────────────────────────────────

export type AnswerValue = number | string | string[]
export type Answers = Record<string, AnswerValue> // clé = item.id

// ── Résultats calculés (mémoire uniquement) ───────────────────────────────

export type CbiBand = 'low' | 'moderate' | 'high'

export interface CbiSubscaleResult {
  key: string
  label: string
  score: number // 0-100
  band: CbiBand
  bandLabel: string
  message: string
}

export interface ReflexifResult {
  percent: number // 0-100
  palier: Palier
  message: string
  forced: boolean
}

export interface BlockRecap {
  blockId: string
  type_bloc: TypeBloc
  titre: string
  cbi?: CbiSubscaleResult[]
  reflexif?: ReflexifResult
  substancesNeutralMessage?: string
  cards: RoutingCard[] // cartes déclenchées par CE bloc
}

export interface Preoccupation {
  label: string
  severity: number // 2 = modéré/orange, 3 = élevé/rouge
  blockTitre: string
}

export interface AutoevalResults {
  topPreoccupations: Preoccupation[]
  cards: RoutingCard[] // toutes cartes déclenchées, dédoublonnées par key
}
