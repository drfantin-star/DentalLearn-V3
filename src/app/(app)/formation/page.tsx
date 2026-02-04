// ============================================
// EXPORTS SUPABASE — DentalLearn
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
  UserSubscription,
  UserPoints,
  PointReason,
} from './types'

export {
  CATEGORY_CONFIG,
  DEFAULT_CATEGORY_CONFIG,
  getCategoryConfig,
} from './types'

// Hooks
export {
  usePreviewMode,
  useFormations,
  useFormation,
  useSequenceQuestions,
  useUserFormationProgress,
  usePremiumAccess,
  useSubmitSequenceResult,
  isSequenceAccessible,
  useFormationLike,
  useFormationPoints,
  useFormationCompletion,
} from './hooks'
