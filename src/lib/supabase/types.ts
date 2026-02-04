// ============================================
// TYPES SUPABASE — DentalLearn Database
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
  level: 'debutant' | 'intermediate' | 'avance' | null
  total_sequences: number
  dpc_hours: number | null
  is_published: boolean
  access_type: 'demo' | 'full'
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
  unlock_day: number | null // obsolète mais encore présent
  estimated_duration_minutes: number
  learning_objectives: string[] | null
  created_at: string
  updated_at: string
}

// ─────────────────────────────────────────────
// QUESTIONS
// ─────────────────────────────────────────────

export interface QuestionOption {
  id: string // "A", "B", "C", "D" ou "VRAI", "FAUX"
  text: string
  correct: boolean
}

export interface Question {
  id: string
  sequence_id: string
  question_order: number
  question_type: 'mcq' | 'true_false' | 'fill_blank' | 'drag_drop' | 'matching' | 'hotspot' | 'case_study' | 'ordering'
  question_text: string
  options: QuestionOption[]
  feedback_correct: string | null
  feedback_incorrect: string | null
  image_url: string | null
  points: number
  recommended_time_seconds: number | null
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
  progress: number | null
  access_type: string | null
  current_sequence: number
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
  completed_at: string
  score: number
  time_spent_seconds: number
  attempts_count: number
  answers: UserSequenceAnswer[]
}

// ─────────────────────────────────────────────
// USER STATS
// ─────────────────────────────────────────────

export interface UserStats {
  user_id: string
  first_name: string | null
  last_name: string | null
  total_points: number
  current_streak: number | null
  longest_streak: number | null
  formations_enrolled: number
  formations_completed: number
  sequences_completed: number
  badges_earned: number
}

// ─────────────────────────────────────────────
// USER POINTS
// ─────────────────────────────────────────────

export interface UserPoints {
  id: string
  user_id: string
  sequence_id: string
  points_earned: number
  reason: string
  created_at: string
}

// ─────────────────────────────────────────────
// TYPES COMPOSITES (avec jointures)
// ─────────────────────────────────────────────

export interface FormationWithProgress extends Formation {
  userProgress?: {
    currentSequence: number
    completedSequences: number
    totalPoints: number
    isEnrolled: boolean
  }
  totalLikes?: number
}

export interface SequenceWithQuestions extends Sequence {
  questions: Question[]
  isCompleted?: boolean
  userScore?: number
}

// ─────────────────────────────────────────────
// CATÉGORIES (mapping frontend)
// ─────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<string, {
  emoji: string
  gradient: { from: string; to: string }
  bgColor: string
  textColor: string
  isCP: boolean
}> = {
  esthetique: {
    emoji: '✨',
    gradient: { from: '#8B5CF6', to: '#A78BFA' },
    bgColor: 'bg-violet-50',
    textColor: 'text-violet-600',
    isCP: true,
  },
  restauratrice: {
    emoji: '🦷',
    gradient: { from: '#F59E0B', to: '#FBBF24' },
    bgColor: 'bg-amber-50',
    textColor: 'text-amber-700',
    isCP: true,
  },
  chirurgie: {
    emoji: '🔪',
    gradient: { from: '#EF4444', to: '#F87171' },
    bgColor: 'bg-rose-50',
    textColor: 'text-rose-600',
    isCP: true,
  },
  implant: {
    emoji: '🔩',
    gradient: { from: '#10B981', to: '#34D399' },
    bgColor: 'bg-green-50',
    textColor: 'text-green-600',
    isCP: true,
  },
  prothese: {
    emoji: '👄',
    gradient: { from: '#F97316', to: '#FB923C' },
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-600',
    isCP: true,
  },
  parodontologie: {
    emoji: '🫧',
    gradient: { from: '#EC4899', to: '#F472B6' },
    bgColor: 'bg-pink-50',
    textColor: 'text-pink-600',
    isCP: true,
  },
  endodontie: {
    emoji: '🔬',
    gradient: { from: '#6366F1', to: '#818CF8' },
    bgColor: 'bg-indigo-50',
    textColor: 'text-indigo-600',
    isCP: true,
  },
  radiologie: {
    emoji: '📡',
    gradient: { from: '#14B8A6', to: '#2DD4BF' },
    bgColor: 'bg-teal-50',
    textColor: 'text-teal-600',
    isCP: true,
  },
  management: {
    emoji: '💼',
    gradient: { from: '#64748B', to: '#94A3B8' },
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    isCP: false,
  },
  organisation: {
    emoji: '📋',
    gradient: { from: '#78716C', to: '#A8A29E' },
    bgColor: 'bg-stone-50',
    textColor: 'text-stone-600',
    isCP: false,
  },
  softskills: {
    emoji: '🤝',
    gradient: { from: '#D97706', to: '#F59E0B' },
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    isCP: false,
  },
}

// Catégorie par défaut si non trouvée
export const DEFAULT_CATEGORY_CONFIG = {
  emoji: '📚',
  gradient: { from: '#6B7280', to: '#9CA3AF' },
  bgColor: 'bg-gray-50',
  textColor: 'text-gray-600',
  isCP: true,
}

export function getCategoryConfig(category: string | null) {
  if (!category) return DEFAULT_CATEGORY_CONFIG
  return CATEGORY_CONFIG[category.toLowerCase()] || DEFAULT_CATEGORY_CONFIG
}
