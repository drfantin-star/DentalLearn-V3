// ============================================================================
// COPIE ADAPTEE de supabase/functions/synthesize_articles/validators.ts
// (+ constantes/mappings de types.ts). Date de la copie : 2026-07-23.
//
// ⚠️ DETTE DE DRIFT ASSUMEE (decision D4 du brief) : validateTags et
// validateAndFilterQuestions sont DUPLIQUES cote Next.js. L'Edge Function
// synthesize_articles n'est pas modifiee et le code n'est pas factorise. Si les
// regles evoluent cote Edge (listes de tags, format quiz, seuils), cette copie
// NE SUIVRA PAS — a resynchroniser a la main. Ce commentaire est le seul filet.
//
// La logique est recopiee A L'IDENTIQUE (pas allegee) : counts par type, ids
// stricts A/B/C..., citation obligatoire dans le feedback, mappings points/temps.
// ============================================================================

// ---------------------------------------------------------------------------
// Constantes & listes fermées (miroir types.ts)
// ---------------------------------------------------------------------------

/** Types de questions autorisés pour les news (arbitrage A6/A10). */
export const QUESTION_TYPES_ALLOWED = ['mcq', 'true_false', 'checkbox'] as const
export type QuestionType = (typeof QUESTION_TYPES_ALLOWED)[number]

/** Valeurs autorisées pour news_syntheses.category_editorial (CHECK BDD). */
export const CATEGORY_EDITORIAL_VALUES = [
  'reglementaire',
  'scientifique',
  'pratique',
  'humour',
] as const
export type CategoryEditorial = (typeof CATEGORY_EDITORIAL_VALUES)[number]

/** Distribution des questions générées (arbitrage A7). */
export const QUESTION_COUNT_MIN = 3
export const QUESTION_COUNT_MAX = 4

/** Seuil minimum de questions valides pour garder la synthèse (arbitrage A3). */
export const QUESTION_VALID_THRESHOLD = 1

/** Points par difficulty (arbitrage A8). */
export const POINTS_BY_DIFFICULTY: Record<1 | 2 | 3, 5 | 10 | 15> = {
  1: 5,
  2: 10,
  3: 15,
}

/** recommended_time_seconds par type de question (arbitrage A9). */
export const TIME_BY_TYPE: Record<QuestionType, 30 | 20 | 45> = {
  mcq: 30,
  true_false: 20,
  checkbox: 45,
}

/** Longueur max display_title — tronqué côté code avant persistance. */
const DISPLAY_TITLE_MAX = 70

/** Tronque display_title à DISPLAY_TITLE_MAX (Sonnet ne compte pas fiablement). */
export function truncateDisplayTitle(raw: string): string {
  const t = (raw ?? '').trim()
  if (t.length <= DISPLAY_TITLE_MAX) return t
  return t.slice(0, DISPLAY_TITLE_MAX).trimEnd()
}

// ---------------------------------------------------------------------------
// Types — listes de référence + output Sonnet + question normalisée
// ---------------------------------------------------------------------------

export interface TaxonomyLists {
  specialites: string[]
  themes: string[]
  niveaux_preuve: string[]
  formation_categories: string[]
  category_editorial: readonly string[]
}

export interface SonnetQuizQuestion {
  question_type: string
  question_text: string
  options: Array<{ id: string; text: string; correct: boolean }>
  feedback: string
  difficulty: number
  source: string
}

export interface SonnetSynthesisOutput {
  summary_fr: string
  method: string | null
  key_figures: string[] | null
  evidence_level: string | null
  clinical_impact: string | null
  caveats: string | null
  specialite: string
  themes: string[]
  niveau_preuve: string
  keywords_libres: string[]
  category_editorial: string
  formation_category_match: string | null
  display_title: string
  quiz: SonnetQuizQuestion[]
}

/** Question normalisée prête à passer à la RPC (feedback dupliqué, points/temps
 *  calculés). Le shape JSONB envoyé à la RPC dérive de ce type. */
export interface NormalizedQuestion {
  question_type: QuestionType
  question_text: string
  options: Array<{ id: string; text: string; correct: boolean }>
  feedback: string
  difficulty: 1 | 2 | 3
  points: number
  recommended_time_seconds: number
  question_order: number
}

export interface QuestionWarning {
  question_index: number
  reason: string
}

// ---------------------------------------------------------------------------
// Tag validation
// ---------------------------------------------------------------------------

export type TagValidationResult = { ok: true } | { ok: false; errors: string[] }

/**
 * Vérifie que tous les tags de l'output Sonnet appartiennent aux listes
 * fournies. Aucune normalisation : rejet exact (case-sensitive) — Sonnet doit
 * recopier littéralement les slugs. Recopie fidèle de la version Edge.
 */
export function validateTags(
  output: SonnetSynthesisOutput,
  lists: TaxonomyLists,
): TagValidationResult {
  const errors: string[] = []

  // specialite : exactement 1 slug
  if (typeof output.specialite !== 'string' || !output.specialite.trim()) {
    errors.push('specialite missing or empty')
  } else if (!lists.specialites.includes(output.specialite)) {
    errors.push(`specialite '${output.specialite}' not in taxonomy.specialite list`)
  }

  // themes : 1 à 3 slugs
  if (!Array.isArray(output.themes)) {
    errors.push('themes is not an array')
  } else if (output.themes.length < 1 || output.themes.length > 3) {
    errors.push(`themes length ${output.themes.length} not in [1..3]`)
  } else {
    for (const t of output.themes) {
      if (typeof t !== 'string' || !t.trim()) {
        errors.push('themes contains empty/non-string entry')
        continue
      }
      if (!lists.themes.includes(t)) {
        errors.push(`theme '${t}' not in taxonomy.themes list`)
      }
    }
  }

  // niveau_preuve : exactement 1 slug
  if (typeof output.niveau_preuve !== 'string' || !output.niveau_preuve.trim()) {
    errors.push('niveau_preuve missing or empty')
  } else if (!lists.niveaux_preuve.includes(output.niveau_preuve)) {
    errors.push(
      `niveau_preuve '${output.niveau_preuve}' not in taxonomy.niveau_preuve list`,
    )
  }

  // category_editorial : 1 valeur parmi 4
  if (
    typeof output.category_editorial !== 'string' ||
    !output.category_editorial.trim()
  ) {
    errors.push('category_editorial missing or empty')
  } else if (
    !(CATEGORY_EDITORIAL_VALUES as readonly string[]).includes(
      output.category_editorial,
    )
  ) {
    errors.push(
      `category_editorial '${output.category_editorial}' not in [${CATEGORY_EDITORIAL_VALUES.join(',')}]`,
    )
  }

  // formation_category_match : null OU slug ∈ liste
  if (
    output.formation_category_match !== null &&
    output.formation_category_match !== undefined
  ) {
    if (typeof output.formation_category_match !== 'string') {
      errors.push(
        `formation_category_match is not string nor null (got ${typeof output.formation_category_match})`,
      )
    } else if (
      !lists.formation_categories.includes(output.formation_category_match)
    ) {
      errors.push(
        `formation_category_match '${output.formation_category_match}' not in formations.category list`,
      )
    }
  }

  // keywords_libres : array de strings non vides
  if (!Array.isArray(output.keywords_libres)) {
    errors.push('keywords_libres is not an array')
  } else {
    for (const k of output.keywords_libres) {
      if (typeof k !== 'string' || !k.trim()) {
        errors.push('keywords_libres contains empty/non-string entry')
        break
      }
    }
  }

  // display_title : non vide + pas de point final (pas de check longueur — tronqué côté code)
  if (typeof output.display_title !== 'string' || !output.display_title.trim()) {
    errors.push('display_title missing or empty')
  } else if (output.display_title.trim().endsWith('.')) {
    errors.push("display_title ends with '.' (rule: no trailing dot)")
  }

  // summary_fr : non vide, ≥100 chars
  if (typeof output.summary_fr !== 'string' || !output.summary_fr.trim()) {
    errors.push('summary_fr missing or empty')
  } else if (output.summary_fr.trim().length < 100) {
    errors.push(`summary_fr length ${output.summary_fr.trim().length} < 100 (too short)`)
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors }
}

// ---------------------------------------------------------------------------
// Question validation
// ---------------------------------------------------------------------------

const TRUE_FALSE_VRAI = new Set(['vrai', 'vrai.'])
const TRUE_FALSE_FAUX = new Set(['faux', 'faux.'])

const CITATION_YEAR_RE = /\b(?:19|20)\d{2}\b/
const CITATION_DOI_RE = /(?:doi\s*:|10\.\d{4,9}\/[^\s,;]+)/i

function hasCitation(s: string): boolean {
  return CITATION_YEAR_RE.test(s) || CITATION_DOI_RE.test(s)
}

function isQuestionType(s: string): s is QuestionType {
  return (QUESTION_TYPES_ALLOWED as readonly string[]).includes(s)
}

function expectedIds(count: number): string[] {
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    out.push(String.fromCharCode('A'.charCodeAt(0) + i))
  }
  return out
}

function checkOptions(
  q: SonnetQuizQuestion,
  count: { min: number; max: number },
  correctRange: { min: number; max: number },
): string | null {
  if (!Array.isArray(q.options)) return 'options is not an array'
  const n = q.options.length
  if (n < count.min || n > count.max) {
    return `options count ${n} not in [${count.min}..${count.max}]`
  }
  const ids = expectedIds(n)
  let correctCount = 0
  for (let i = 0; i < n; i++) {
    const opt = q.options[i]
    if (!opt || typeof opt !== 'object') return `option ${i} is not an object`
    if (opt.id !== ids[i]) return `option ${i} id '${opt.id}' expected '${ids[i]}'`
    if (typeof opt.text !== 'string' || !opt.text.trim()) return `option ${i} text empty`
    if (typeof opt.correct !== 'boolean') {
      return `option ${i} correct is not boolean (got ${typeof opt.correct})`
    }
    if (opt.correct) correctCount++
  }
  if (correctCount < correctRange.min || correctCount > correctRange.max) {
    return `correct=true count ${correctCount} not in [${correctRange.min}..${correctRange.max}]`
  }
  return null
}

function checkTrueFalseText(q: SonnetQuizQuestion): string | null {
  const a = q.options[0].text.trim().toLowerCase()
  const b = q.options[1].text.trim().toLowerCase()
  const okOrder1 = TRUE_FALSE_VRAI.has(a) && TRUE_FALSE_FAUX.has(b)
  const okOrder2 = TRUE_FALSE_FAUX.has(a) && TRUE_FALSE_VRAI.has(b)
  if (!okOrder1 && !okOrder2) {
    return `true_false texts '${q.options[0].text}'/'${q.options[1].text}' not Vrai/Faux variants`
  }
  return null
}

type QuestionValidationResult =
  | { ok: true; normalized: NormalizedQuestion }
  | { ok: false; reason: string }

function validateQuestion(
  q: SonnetQuizQuestion,
  index: number,
): QuestionValidationResult {
  if (typeof q?.question_type !== 'string' || !isQuestionType(q.question_type)) {
    return {
      ok: false,
      reason: `invalid question_type '${q?.question_type}' (allowed: ${QUESTION_TYPES_ALLOWED.join(',')})`,
    }
  }
  const type: QuestionType = q.question_type

  if (typeof q.question_text !== 'string' || !q.question_text.trim()) {
    return { ok: false, reason: 'question_text empty' }
  }

  let optErr: string | null = null
  if (type === 'mcq') {
    optErr = checkOptions(q, { min: 4, max: 4 }, { min: 1, max: 1 })
  } else if (type === 'true_false') {
    optErr = checkOptions(q, { min: 2, max: 2 }, { min: 1, max: 1 })
    if (!optErr) optErr = checkTrueFalseText(q)
  } else {
    optErr = checkOptions(q, { min: 5, max: 6 }, { min: 2, max: 4 })
  }
  if (optErr) return { ok: false, reason: optErr }

  const diff = q.difficulty
  if (diff !== 1 && diff !== 2 && diff !== 3) {
    return { ok: false, reason: `difficulty ${diff} not in {1,2,3}` }
  }
  const difficultyTyped: 1 | 2 | 3 = diff

  if (typeof q.feedback !== 'string' || !q.feedback.trim()) {
    return { ok: false, reason: 'feedback empty' }
  }
  if (!hasCitation(q.feedback)) {
    return { ok: false, reason: 'feedback missing citation (year YYYY or DOI required)' }
  }

  if (typeof q.source !== 'string' || !q.source.trim()) {
    return { ok: false, reason: 'source empty' }
  }

  const normalized: NormalizedQuestion = {
    question_type: type,
    question_text: q.question_text.trim(),
    options: q.options.map((o) => ({
      id: o.id,
      text: o.text.trim(),
      correct: o.correct,
    })),
    feedback: q.feedback.trim(),
    difficulty: difficultyTyped,
    points: POINTS_BY_DIFFICULTY[difficultyTyped],
    recommended_time_seconds: TIME_BY_TYPE[type],
    question_order: index + 1,
  }

  return { ok: true, normalized }
}

export interface FilterResult {
  valid: NormalizedQuestion[]
  warnings: QuestionWarning[]
}

/**
 * Applique validateQuestion sur tout le quiz array Sonnet. Renumérote
 * question_order 1..N sur les valides acceptées (cap QUESTION_COUNT_MAX).
 */
export function validateAndFilterQuestions(
  questions: SonnetQuizQuestion[] | unknown,
): FilterResult {
  const warnings: QuestionWarning[] = []
  const valid: NormalizedQuestion[] = []

  if (!Array.isArray(questions)) {
    warnings.push({ question_index: -1, reason: 'quiz_not_array' })
    return { valid, warnings }
  }

  let kept = 0
  for (let i = 0; i < questions.length; i++) {
    const res = validateQuestion(questions[i], i)
    if (res.ok) {
      if (kept < QUESTION_COUNT_MAX) {
        valid.push({ ...res.normalized, question_order: kept + 1 })
        kept++
      } else {
        warnings.push({ question_index: i, reason: 'over_max_count' })
      }
    } else {
      warnings.push({ question_index: i, reason: res.reason })
    }
  }

  if (valid.length > 0 && valid.length < QUESTION_COUNT_MIN) {
    warnings.push({
      question_index: -1,
      reason: `valid_count_below_min (${valid.length} < ${QUESTION_COUNT_MIN})`,
    })
  }

  return { valid, warnings }
}
