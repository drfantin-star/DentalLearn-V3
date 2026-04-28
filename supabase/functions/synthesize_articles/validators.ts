// Validation de l'output Sonnet pour synthesize_articles.
//
// Module pur (pas d'IO, pas de fetch). Vérifie la conformité de la sortie
// Sonnet aux règles produit du Ticket 5 :
//   - Tags : tous appartiennent aux listes fournies (taxonomy news +
//     formations.category + category_editorial constants).
//   - Quiz : 3 types autorisés (mcq, true_false, checkbox), comptes
//     d'options, ids consécutifs A-..., 1 ou plusieurs `correct=true`
//     selon type, feedback non vide + citation, source non vide.
//
// Distinction des erreurs :
//   - Tag invalide → caller relance Sonnet (jusqu'à MAX_TAG_RETRIES, A2).
//   - Question invalide → filtrée puis trace dans validation_warnings ;
//     si <QUESTION_VALID_THRESHOLD valides → caller marque l'article fail.
//
// Aligné sur api/admin/questions/route.ts (validateOptionsByType côté admin),
// avec les durcissements news (counts par type, ids stricts, citation
// obligatoire).

import type {
  NormalizedQuestion,
  QuestionType,
  QuestionWarning,
  SonnetQuizQuestion,
  SonnetSynthesisOutput,
  TaxonomyLists,
} from "./types.ts";
import {
  CATEGORY_EDITORIAL_VALUES,
  POINTS_BY_DIFFICULTY,
  QUESTION_COUNT_MAX,
  QUESTION_TYPES_ALLOWED,
  TIME_BY_TYPE,
} from "./types.ts";

// ---------------------------------------------------------------------------
// Tag validation
// ---------------------------------------------------------------------------

export type TagValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

/**
 * Vérifie que tous les tags de l'output Sonnet appartiennent aux listes
 * fournies. Aucune normalisation : on rejette tout slug qui ne matche pas
 * exactement (case-sensitive) — Sonnet doit recopier littéralement les
 * slugs fournis dans le user prompt.
 *
 * Retourne `{ ok: false, errors: [...] }` avec une string par anomalie
 * détectée. Le caller logue + relance Sonnet (cf MAX_TAG_RETRIES, A2).
 */
export function validateTags(
  output: SonnetSynthesisOutput,
  lists: TaxonomyLists,
): TagValidationResult {
  const errors: string[] = [];

  // ----- specialite : exactement 1 slug -----
  if (typeof output.specialite !== "string" || !output.specialite.trim()) {
    errors.push("specialite missing or empty");
  } else if (!lists.specialites.includes(output.specialite)) {
    errors.push(
      `specialite '${output.specialite}' not in taxonomy.specialite list`,
    );
  }

  // ----- themes : 1 à 3 slugs -----
  if (!Array.isArray(output.themes)) {
    errors.push("themes is not an array");
  } else if (output.themes.length < 1 || output.themes.length > 3) {
    errors.push(`themes length ${output.themes.length} not in [1..3]`);
  } else {
    for (const t of output.themes) {
      if (typeof t !== "string" || !t.trim()) {
        errors.push("themes contains empty/non-string entry");
        continue;
      }
      if (!lists.themes.includes(t)) {
        errors.push(`theme '${t}' not in taxonomy.themes list`);
      }
    }
  }

  // ----- niveau_preuve : exactement 1 slug -----
  if (typeof output.niveau_preuve !== "string" || !output.niveau_preuve.trim()) {
    errors.push("niveau_preuve missing or empty");
  } else if (!lists.niveaux_preuve.includes(output.niveau_preuve)) {
    errors.push(
      `niveau_preuve '${output.niveau_preuve}' not in taxonomy.niveau_preuve list`,
    );
  }

  // ----- category_editorial : 1 valeur parmi 4 -----
  if (
    typeof output.category_editorial !== "string" ||
    !output.category_editorial.trim()
  ) {
    errors.push("category_editorial missing or empty");
  } else if (
    !(CATEGORY_EDITORIAL_VALUES as readonly string[]).includes(
      output.category_editorial,
    )
  ) {
    errors.push(
      `category_editorial '${output.category_editorial}' not in [${CATEGORY_EDITORIAL_VALUES.join(",")}]`,
    );
  }

  // ----- formation_category_match : null OU slug ∈ liste -----
  if (
    output.formation_category_match !== null &&
    output.formation_category_match !== undefined
  ) {
    if (typeof output.formation_category_match !== "string") {
      errors.push(
        `formation_category_match is not string nor null (got ${typeof output.formation_category_match})`,
      );
    } else if (
      !lists.formation_categories.includes(output.formation_category_match)
    ) {
      errors.push(
        `formation_category_match '${output.formation_category_match}' not in formations.category list`,
      );
    }
  }

  // ----- keywords_libres : array de strings non vides (vocabulaire libre) -----
  if (!Array.isArray(output.keywords_libres)) {
    errors.push("keywords_libres is not an array");
  } else {
    for (const k of output.keywords_libres) {
      if (typeof k !== "string" || !k.trim()) {
        errors.push("keywords_libres contains empty/non-string entry");
        break; // un seul signal suffit
      }
    }
  }

  // ----- display_title : non vide, ≤60 chars, pas de point final -----
  if (typeof output.display_title !== "string" || !output.display_title.trim()) {
    errors.push("display_title missing or empty");
  } else {
    const t = output.display_title.trim();
    if (t.length > 60) {
      errors.push(`display_title length ${t.length} > 60`);
    }
    if (t.endsWith(".")) {
      errors.push("display_title ends with '.' (rule: no trailing dot)");
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ---------------------------------------------------------------------------
// Question validation
// ---------------------------------------------------------------------------

export type QuestionValidationResult =
  | { ok: true; normalized: NormalizedQuestion }
  | { ok: false; reason: string };

/** Variantes acceptables pour true_false (case + ponctuation finale). */
const TRUE_FALSE_VRAI = new Set(["vrai", "vrai.", "true", "true."]);
const TRUE_FALSE_FAUX = new Set(["faux", "faux.", "false", "false."]);

/** Citation obligatoire dans le feedback : année 19xx/20xx OU DOI. */
const CITATION_YEAR_RE = /\b(?:19|20)\d{2}\b/;
const CITATION_DOI_RE = /(?:doi\s*:|10\.\d{4,9}\/[^\s,;]+)/i;

function hasCitation(s: string): boolean {
  return CITATION_YEAR_RE.test(s) || CITATION_DOI_RE.test(s);
}

function isQuestionType(s: string): s is QuestionType {
  return (QUESTION_TYPES_ALLOWED as readonly string[]).includes(s);
}

/** Génère ['A','B','C',...] pour une longueur donnée (max 26). */
function expectedIds(count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    out.push(String.fromCharCode("A".charCodeAt(0) + i));
  }
  return out;
}

/**
 * Vérifie la structure d'options pour un type donné :
 *   - Array de longueur dans [count.min, count.max]
 *   - Chaque option a id consécutif A,B,C,..., text non vide, correct boolean
 *   - Nombre d'options correct=true dans [correctRange.min, correctRange.max]
 *
 * Retourne null si OK, ou une string d'erreur descriptive sinon.
 */
function checkOptions(
  q: SonnetQuizQuestion,
  count: { min: number; max: number },
  correctRange: { min: number; max: number },
): string | null {
  if (!Array.isArray(q.options)) return "options is not an array";
  const n = q.options.length;
  if (n < count.min || n > count.max) {
    return `options count ${n} not in [${count.min}..${count.max}]`;
  }
  const ids = expectedIds(n);
  let correctCount = 0;
  for (let i = 0; i < n; i++) {
    const opt = q.options[i];
    if (!opt || typeof opt !== "object") {
      return `option ${i} is not an object`;
    }
    if (opt.id !== ids[i]) {
      return `option ${i} id '${opt.id}' expected '${ids[i]}'`;
    }
    if (typeof opt.text !== "string" || !opt.text.trim()) {
      return `option ${i} text empty`;
    }
    if (typeof opt.correct !== "boolean") {
      return `option ${i} correct is not boolean (got ${typeof opt.correct})`;
    }
    if (opt.correct) correctCount++;
  }
  if (correctCount < correctRange.min || correctCount > correctRange.max) {
    return `correct=true count ${correctCount} not in [${correctRange.min}..${correctRange.max}]`;
  }
  return null;
}

/**
 * Pour true_false (post checkOptions OK avec 2 options) : vérifie que
 * les textes sont des variantes acceptables de Vrai/Faux dans n'importe
 * quel ordre (A=Vrai/B=Faux ou A=Faux/B=Vrai).
 */
function checkTrueFalseText(q: SonnetQuizQuestion): string | null {
  const a = q.options[0].text.trim().toLowerCase();
  const b = q.options[1].text.trim().toLowerCase();
  const okOrder1 = TRUE_FALSE_VRAI.has(a) && TRUE_FALSE_FAUX.has(b);
  const okOrder2 = TRUE_FALSE_FAUX.has(a) && TRUE_FALSE_VRAI.has(b);
  if (!okOrder1 && !okOrder2) {
    return `true_false texts '${q.options[0].text}'/'${q.options[1].text}' not Vrai/Faux variants`;
  }
  return null;
}

/**
 * Validation complète d'une question Sonnet + normalisation pour INSERT BDD.
 * Index = position dans le quiz array (0-based) — sert au question_order
 * (1-based) du résultat normalisé.
 *
 * Règles vérifiées :
 *   1. question_type ∈ QUESTION_TYPES_ALLOWED
 *   2. question_text non vide après trim
 *   3. options conforme par type (counts, ids, text, correct)
 *      - mcq        : 4 options A-D, exactement 1 correct=true
 *      - true_false : 2 options A-B Vrai/Faux variants, 1 correct=true
 *      - checkbox   : 5-6 options A-E ou A-F, 2-4 correct=true
 *   4. difficulty ∈ {1,2,3}
 *   5. feedback non vide + citation (année OR DOI)
 *   6. source non vide
 *
 * Mappings injectés :
 *   - feedback_correct = feedback_incorrect = q.feedback (règle v1.3)
 *   - points = POINTS_BY_DIFFICULTY[difficulty] (mapping A8)
 *   - recommended_time_seconds = TIME_BY_TYPE[type] (mapping A9)
 *   - is_daily_quiz_eligible = false (explicite, default true non appliqué)
 *   - sequence_id = null
 */
export function validateQuestion(
  q: SonnetQuizQuestion,
  index: number,
): QuestionValidationResult {
  // 1. Type
  if (typeof q.question_type !== "string" || !isQuestionType(q.question_type)) {
    return {
      ok: false,
      reason: `invalid question_type '${q.question_type}' (allowed: ${QUESTION_TYPES_ALLOWED.join(",")})`,
    };
  }
  const type: QuestionType = q.question_type;

  // 2. Question text
  if (typeof q.question_text !== "string" || !q.question_text.trim()) {
    return { ok: false, reason: "question_text empty" };
  }

  // 3. Options par type
  let optErr: string | null = null;
  if (type === "mcq") {
    optErr = checkOptions(q, { min: 4, max: 4 }, { min: 1, max: 1 });
  } else if (type === "true_false") {
    optErr = checkOptions(q, { min: 2, max: 2 }, { min: 1, max: 1 });
    if (!optErr) optErr = checkTrueFalseText(q);
  } else {
    // checkbox
    optErr = checkOptions(q, { min: 5, max: 6 }, { min: 2, max: 4 });
  }
  if (optErr) return { ok: false, reason: optErr };

  // 4. Difficulty
  const diff = q.difficulty;
  if (diff !== 1 && diff !== 2 && diff !== 3) {
    return { ok: false, reason: `difficulty ${diff} not in {1,2,3}` };
  }
  const difficultyTyped: 1 | 2 | 3 = diff;

  // 5. Feedback non vide + citation
  if (typeof q.feedback !== "string" || !q.feedback.trim()) {
    return { ok: false, reason: "feedback empty" };
  }
  if (!hasCitation(q.feedback)) {
    return {
      ok: false,
      reason: "feedback missing citation (year YYYY or DOI required)",
    };
  }

  // 6. Source non vide
  if (typeof q.source !== "string" || !q.source.trim()) {
    return { ok: false, reason: "source empty" };
  }

  // Build normalized
  const feedback = q.feedback.trim();
  const normalized: NormalizedQuestion = {
    question_type: type,
    question_text: q.question_text.trim(),
    options: q.options.map((o) => ({
      id: o.id,
      text: o.text.trim(),
      correct: o.correct,
    })),
    feedback_correct: feedback,
    feedback_incorrect: feedback, // règle v1.3 : un seul feedback dupliqué
    difficulty: difficultyTyped,
    points: POINTS_BY_DIFFICULTY[difficultyTyped],
    recommended_time_seconds: TIME_BY_TYPE[type],
    question_order: index + 1, // 1-based, peut être renuméroté côté caller
    is_daily_quiz_eligible: false,
    sequence_id: null,
  };

  return { ok: true, normalized };
}

// ---------------------------------------------------------------------------
// Filtrage du quiz Sonnet — applique validateQuestion sur tout le tableau
// ---------------------------------------------------------------------------

export interface FilterResult {
  /** Questions valides, prêtes à INSERT (question_order renumérotés 1..N). */
  valid: NormalizedQuestion[];
  /** Questions rejetées (validation_warnings JSONB). */
  warnings: QuestionWarning[];
}

/**
 * Applique validateQuestion sur tout le quiz array Sonnet.
 *
 * Comportements :
 *   - Quiz n'est pas un array → 1 warning "quiz_not_array", aucune valide.
 *   - Une question invalide → ajoutée à warnings avec sa raison.
 *   - Une question valide en surnombre (>QUESTION_COUNT_MAX) → ajoutée à
 *     warnings avec reason="over_max_count" (protège l'UI d'un dump 5+
 *     questions). Sonnet est censé respecter QUESTION_COUNT_MIN/MAX, mais
 *     défense en profondeur.
 *
 * Renumérotation : le question_order est renumeroté 1..N sur les valides
 * acceptées (continu, sans trous), pour respecter la sémantique
 * `question_order` de la table public.questions (positionnement dans
 * la séquence pédagogique).
 */
export function validateAndFilterQuestions(
  questions: SonnetQuizQuestion[] | unknown,
): FilterResult {
  const warnings: QuestionWarning[] = [];
  const valid: NormalizedQuestion[] = [];

  if (!Array.isArray(questions)) {
    warnings.push({
      question_index: -1,
      reason: "quiz_not_array",
      raw: questions,
    });
    return { valid, warnings };
  }

  let kept = 0;
  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const res = validateQuestion(q, i);
    if (res.ok) {
      if (kept < QUESTION_COUNT_MAX) {
        valid.push({ ...res.normalized, question_order: kept + 1 });
        kept++;
      } else {
        warnings.push({
          question_index: i,
          reason: "over_max_count",
          raw: q,
        });
      }
    } else {
      warnings.push({
        question_index: i,
        reason: res.reason,
        raw: q,
      });
    }
  }

  return { valid, warnings };
}
