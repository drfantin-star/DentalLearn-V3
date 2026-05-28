// Parseur partagé pour les questions `case_study`.
//
// Deux formats coexistent en base (vérifié 28/05, aucune migration prévue) :
//  - STRUCTURED  : { context: {...}, questions: [{ id, text, choices, ... }] }
//  - LEGACY_ARRAY: [{ id, text, correct }]  (énoncé porté par question_text de la ligne)
//
// `parseCaseStudyData` normalise les deux vers une seule forme `NormalizedCaseStudy`
// à N sous-questions (N === 1 en prod aujourd'hui, mais le support multi reste).

export interface CaseStudyChoice {
  id: string
  text: string
  correct: boolean
}

export interface CaseStudyContext {
  patient?: string
  chief_complaint?: string
  history?: string
  clinical_image?: string
}

export interface CaseStudySubQuestion {
  id: string
  order: number
  text: string
  choices: CaseStudyChoice[]
  feedback: string | null
  points: number | null
}

export interface NormalizedCaseStudy {
  context: CaseStudyContext | null
  questions: CaseStudySubQuestion[]
}

// Défaut aligné sur QUESTION_TYPE_CONFIGS.case_study.defaultPoints.
// Note : le scoring réel côté consumer utilise `question.points` (colonne DB),
// ce champ reste informatif pour le format normalisé.
const DEFAULT_CASE_STUDY_POINTS = 30

export function parseCaseStudyData(options: unknown): NormalizedCaseStudy | null {
  let opts = options
  if (typeof opts === 'string') {
    try {
      opts = JSON.parse(opts)
    } catch {
      return null
    }
  }

  if (!opts) return null

  // LEGACY_ARRAY → 1 sous-question, énoncé injecté côté composant (rootText).
  if (Array.isArray(opts)) {
    return {
      context: null,
      questions: [
        {
          id: 'legacy',
          order: 0,
          text: '',
          choices: opts as CaseStudyChoice[],
          feedback: null,
          points: DEFAULT_CASE_STUDY_POINTS,
        },
      ],
    }
  }

  // STRUCTURED
  if (typeof opts === 'object' && 'questions' in (opts as Record<string, unknown>)) {
    const o = opts as { context?: CaseStudyContext; questions?: unknown }
    if (!Array.isArray(o.questions)) {
      console.warn('[case_study] Unrecognized format')
      return null
    }
    return {
      context: o.context ?? null,
      questions: o.questions as CaseStudySubQuestion[],
    }
  }

  console.warn('[case_study] Unrecognized format')
  return null
}
