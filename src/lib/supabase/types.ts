// ============================================
// TYPES SUPABASE — DentalLearn Database
// Adapté à la structure réelle de la BDD
// ============================================

// ─────────────────────────────────────────────
// FORMATIONS
// ─────────────────────────────────────────────

export interface Formation {
  id: string
  title: string
  slug: string
  instructor_name: string
  description_short: string | null
  description_long: string | null
  cover_image_url: string | null
  category: string | null
  level: string | null
  total_sequences: number
  dpc_hours: number | null
  is_published: boolean
  access_type: 'demo' | 'full'
  cp_eligible: boolean | null
  cp_axe_id: number | null
  cp_hours: number | null
  likes_count: number
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────
// SEQUENCES
// ─────────────────────────────────────────────

export interface Sequence {
  id: string
  formation_id: string
  sequence_number: number
  title: string
  unlock_day: number | null
  estimated_duration_minutes: number
  learning_objectives: string[] | null
  is_intro: boolean
  is_evaluation: boolean
  access_level: 'free' | 'premium'
  course_media_url: string | null
  course_media_type: 'audio' | 'video' | null
  course_duration_seconds: number | null
  subtitles_url: string | null
  infographic_url: string | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────

export interface QuestionOption {
  id: string
  text: string
  correct: boolean
}

export interface Question {
  id: string
  sequence_id: string
  question_order: number
  question_type: string
  question_text: string
  options: QuestionOption[]
  feedback_correct: string
  feedback_incorrect: string
  image_url: string | null
  points: number
  recommended_time_seconds: number | null
  is_daily_quiz_eligible: boolean
  difficulty: number
  created_at: string
}

// ─────────────────────────────────────────────
// USER FORMATIONS (progression)
// ─────────────────────────────────────────────

export interface UserFormation {
  id: string
  user_id: string
  formation_id: string
  started_at: string
  completed_at: string | null
  is_active: boolean
  progress: Record<string, unknown> | null
  access_type: 'demo' | 'full'
  current_sequence: number
  total_points: number
  best_score: number
}

// ─────────────────────────────────────────────
// USER SEQUENCES (résultats)
// ─────────────────────────────────────────────

export interface UserSequenceAnswer {
  question_id: string
  selected_option: string
  is_correct: boolean
  points_earned: number
}

export interface UserSequence {
  id: string
  user_id: string
  sequence_id: string
  completed_at: string | null
  score: number | null
  time_spent_seconds: number | null
  attempts_count: number
  answers: UserSequenceAnswer[] | null
}

// ─────────────────────────────────────────────
// USER SUBSCRIPTIONS
// ─────────────────────────────────────────────

export interface UserSubscription {
  id: string
  user_id: string
  plan: 'free' | 'premium' | 'cabinet' | 'enterprise'
  status: 'active' | 'cancelled' | 'expired' | 'trial'
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────
// USER POINTS — ENUM point_reason
// ─────────────────────────────────────────────

export type PointReason = 
  | 'question_correct'
  | 'speed_bonus'
  | 'perfect_sequence'
  | 'streak_bonus_3'
  | 'streak_bonus_7'
  | 'streak_bonus_14'
  | 'streak_bonus_30'
  | 'badge_unlock'
  | 'quest_reward'
  | 'streak_bonus'
  | 'leaderboard_reward'

export interface UserPoints {
  id: string
  user_id: string
  sequence_id: string | null
  points_earned: number
  reason: PointReason
  created_at: string
}

// ─────────────────────────────────────────────
// CATÉGORIES (mapping frontend)
// ─────────────────────────────────────────────

export interface CategoryConfig {
  emoji: string
  gradient: { from: string; to: string }
  bgColor: string
  textColor: string
  isCP: boolean
  name: string
  shortName: string
  type: 'cp' | 'bonus'
}

export const CATEGORY_CONFIG: Record<string, CategoryConfig> = {
  esthetique: {
    emoji: '✨',
    gradient: { from: '#8B5CF6', to: '#A78BFA' },
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-600',
    isCP: true,
    name: 'Esthétique',
    shortName: 'Esthétique',
    type: 'cp',
  },
  restauratrice: {
    emoji: '🦷',
    gradient: { from: '#F59E0B', to: '#FBBF24' },
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    isCP: true,
    name: 'Dentisterie Restauratrice',
    shortName: 'Restauratrice',
    type: 'cp',
  },
  chirurgie: {
    emoji: '🔪',
    gradient: { from: '#EF4444', to: '#F87171' },
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-600',
    isCP: true,
    name: 'Chirurgie Orale',
    shortName: 'Chirurgie',
    type: 'cp',
  },
  implant: {
    emoji: '🔩',
    gradient: { from: '#10B981', to: '#34D399' },
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    isCP: true,
    name: 'Implantologie',
    shortName: 'Implant',
    type: 'cp',
  },
  prothese: {
    emoji: '👄',
    gradient: { from: '#F97316', to: '#FB923C' },
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    isCP: true,
    name: 'Prothèse',
    shortName: 'Prothèse',
    type: 'cp',
  },
  parodontologie: {
    emoji: '🫧',
    gradient: { from: '#EC4899', to: '#F472B6' },
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    isCP: true,
    name: 'Parodontologie',
    shortName: 'Paro',
    type: 'cp',
  },
  endodontie: {
    emoji: '🔬',
    gradient: { from: '#6366F1', to: '#818CF8' },
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    isCP: true,
    name: 'Endodontie',
    shortName: 'Endo',
    type: 'cp',
  },
  radiologie: {
    emoji: '📡',
    gradient: { from: '#14B8A6', to: '#2DD4BF' },
    bgColor: 'bg-teal-50',
    textColor: 'text-teal-600',
    isCP: true,
    name: 'Radiologie',
    shortName: 'Radio',
    type: 'cp',
  },
  management: {
    emoji: '💼',
    gradient: { from: '#78716C', to: '#A8A29E' },
    bgColor: 'bg-stone-50',
    textColor: 'text-stone-600',
    isCP: false,
    name: 'Management',
    shortName: 'Management',
    type: 'bonus',
  },
  organisation: {
    emoji: '📋',
    gradient: { from: '#64748B', to: '#94A3B8' },
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    isCP: false,
    name: 'Organisation',
    shortName: 'Organisation',
    type: 'bonus',
  },
  'soft-skills': {
    emoji: '🤝',
    gradient: { from: '#D97706', to: '#F59E0B' },
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    isCP: false,
    name: 'Soft Skills',
    shortName: 'Soft Skills',
    type: 'bonus',
  },
}

export const DEFAULT_CATEGORY_CONFIG: CategoryConfig = {
  emoji: '📚',
  gradient: { from: '#6B7280', to: '#9CA3AF' },
  bgColor: 'bg-gray-50',
  textColor: 'text-gray-600',
  isCP: true,
  name: 'Autre',
  shortName: 'Autre',
  type: 'cp',
}

/** Strip diacritics so "Esthétique" matches key "esthetique" */
function normalize(str: string): string {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function getCategoryConfig(category: string | null): CategoryConfig {
  if (!category) return DEFAULT_CATEGORY_CONFIG
  const slug = normalize(category)
  // Direct slug match (e.g. "esthetique")
  if (CATEGORY_CONFIG[slug]) return CATEGORY_CONFIG[slug]
  // Try matching individual words (e.g. "Dentisterie Restauratrice" → "restauratrice")
  for (const word of slug.split(/\s+/)) {
    if (CATEGORY_CONFIG[word]) return CATEGORY_CONFIG[word]
  }
  return DEFAULT_CATEGORY_CONFIG
}

/** Ordered list of all categories for catalog display */
export const CATEGORIES = Object.entries(CATEGORY_CONFIG).map(([id, config]) => ({
  id,
  ...config,
}))
