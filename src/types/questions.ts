// Types de questions supportés
export type QuestionType =
  | 'mcq'           // QCM classique (4 options, 1 correcte)
  | 'true_false'    // Vrai/Faux
  | 'mcq_image'     // QCM avec image zoomable
  | 'checkbox'      // Cases à cocher (plusieurs correctes)
  | 'highlight'     // Barrer les intrus
  | 'matching'      // Association paires
  | 'ordering'      // Ordonnancement
  | 'fill_blank'    // Texte à trous
  | 'case_study'    // Cas clinique multi-questions
  | 'drag_drop'     // Glisser-déposer (legacy)
  | 'image'         // Image seule (legacy)

// Configuration par type de question
export interface QuestionTypeConfig {
  label: string
  description: string
  hasImage: boolean
  requiresImage: boolean
  defaultPoints: number
  minOptions?: number
  maxOptions?: number
}

export const QUESTION_TYPE_CONFIGS: Record<QuestionType, QuestionTypeConfig> = {
  mcq: {
    label: 'QCM',
    description: '4 options, 1 correcte',
    hasImage: false,
    requiresImage: false,
    defaultPoints: 10,
    minOptions: 2,
    maxOptions: 6
  },
  true_false: {
    label: 'Vrai/Faux',
    description: '2 options',
    hasImage: false,
    requiresImage: false,
    defaultPoints: 5
  },
  mcq_image: {
    label: 'QCM Image',
    description: 'QCM avec image zoomable',
    hasImage: true,
    requiresImage: true,
    defaultPoints: 15,
    minOptions: 2,
    maxOptions: 6
  },
  checkbox: {
    label: 'Cases à cocher',
    description: 'Plusieurs réponses correctes',
    hasImage: false,
    requiresImage: false,
    defaultPoints: 15,
    minOptions: 3,
    maxOptions: 8
  },
  highlight: {
    label: 'Barrer intrus',
    description: '1-2 intrus à identifier',
    hasImage: false,
    requiresImage: false,
    defaultPoints: 10,
    minOptions: 3,
    maxOptions: 6
  },
  matching: {
    label: 'Association',
    description: 'Paires à relier',
    hasImage: false,
    requiresImage: false,
    defaultPoints: 15
  },
  ordering: {
    label: 'Ordonnancement',
    description: 'Éléments à ordonner',
    hasImage: false,
    requiresImage: false,
    defaultPoints: 15
  },
  fill_blank: {
    label: 'Compléter',
    description: 'Texte à trous',
    hasImage: false,
    requiresImage: false,
    defaultPoints: 10
  },
  case_study: {
    label: 'Cas clinique',
    description: '2-3 sous-questions liées',
    hasImage: true,
    requiresImage: false,
    defaultPoints: 30
  },
  drag_drop: {
    label: 'Glisser-déposer',
    description: 'Association ou ordonnancement',
    hasImage: false,
    requiresImage: false,
    defaultPoints: 15
  },
  image: {
    label: 'Image',
    description: 'Question avec image',
    hasImage: true,
    requiresImage: true,
    defaultPoints: 10
  }
}

// Interfaces pour les options de matching
export interface MatchingPair {
  id: string
  left: string
  right: string
}

export interface MatchingOptionsNormalized {
  pairs: MatchingPair[]
}

export type MatchingOptionsUnion =
  | { pairs: MatchingPair[] }
  | { format: 'matching'; pairs: MatchingPair[] }
  | MatchingPair[]

// Normalise les différents formats de matching en un format unique
export function normalizeMatchingOptions(options: MatchingOptionsUnion): MatchingOptionsNormalized {
  if (Array.isArray(options)) {
    return { pairs: options }
  }
  if ('pairs' in options && Array.isArray(options.pairs)) {
    return { pairs: options.pairs }
  }
  return { pairs: [] }
}

// Interfaces pour drag_drop
export interface DragDropOrderingItem {
  id: string
  text: string
  correctPosition: number
}

export interface DragDropMatchingPair {
  id: string
  left: string
  right: string
}

// Helpers pour détecter le format drag_drop
export function isDragDropOrdering(options: unknown): boolean {
  if (Array.isArray(options)) {
    const first = options[0] as { text?: string; correctPosition?: number }
    return first?.text !== undefined && first?.correctPosition !== undefined
  }
  const obj = options as { format?: string; items?: unknown[]; ordering?: unknown[] }
  return obj?.format === 'ordering' || Array.isArray(obj?.items) || Array.isArray(obj?.ordering)
}

export function isDragDropMatching(options: unknown): boolean {
  if (Array.isArray(options)) {
    const first = options[0] as { left?: string; right?: string }
    return first?.left !== undefined && first?.right !== undefined
  }
  const obj = options as { format?: string; pairs?: unknown[] }
  return obj?.format === 'matching' || (Array.isArray(obj?.pairs) && !isDragDropOrdering(options))
}

export function getDragDropOrderingItems(options: unknown): DragDropOrderingItem[] {
  if (Array.isArray(options)) {
    return options as DragDropOrderingItem[]
  }
  const obj = options as { items?: DragDropOrderingItem[]; ordering?: DragDropOrderingItem[] }
  return obj?.items || obj?.ordering || []
}

export function getDragDropMatchingPairs(options: unknown): DragDropMatchingPair[] {
  if (Array.isArray(options)) {
    return options as DragDropMatchingPair[]
  }
  const obj = options as { pairs?: DragDropMatchingPair[] }
  return obj?.pairs || []
}
