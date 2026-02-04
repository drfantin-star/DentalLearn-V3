// ============================================
// EXPORTS SUPABASE
// ============================================

// Client
export { createClient } from './client'

// Types
export type {
  Formation,
  Sequence,
  Question,
  QuestionOption,
  UserFormation,
  UserSequence,
  UserSequenceAnswer,
  UserStats,
  UserPoints,
  FormationWithProgress,
  SequenceWithQuestions,
} from './types'

export {
  CATEGORY_CONFIG,
  DEFAULT_CATEGORY_CONFIG,
  getCategoryConfig,
} from './types'

// Hooks
export {
  useFormations,
  useFormation,
  useSequenceQuestions,
  useUserFormationProgress,
  useEnrollFormation,
  useSubmitSequenceResult,
  useUserStats,
} from './hooks'
