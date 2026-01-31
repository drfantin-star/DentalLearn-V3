// Types pour DentalLearn V3

export interface CpAxe {
  id: number
  code: string
  name: string
  short_name: string
  description: string | null
  color: string
  required_actions: number
  icon: string | null
  display_order: number
}

export interface Formation {
  id: string
  title: string
  slug: string
  instructor_name: string
  description_short: string | null
  description_long: string | null
  cover_image_url: string | null
  category: string | null
  level: string
  total_sequences: number
  dpc_hours: number | null
  is_published: boolean
  access_type: 'demo' | 'full'
  cp_eligible: boolean
  cp_axe_id: number | null
}

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
}

export interface Question {
  id: string
  sequence_id: string
  question_order: number
  question_type: 'qcm' | 'true_false' | 'qcm_image' | 'case_study'
  question_text: string
  options: {
    choices?: { id: string; text: string; is_correct: boolean }[]
    correct_answer?: boolean // pour true_false
    image_url?: string
  }
  feedback_correct: string
  feedback_incorrect: string
  image_url: string | null
  points: number
  difficulty: number
  is_daily_quiz_eligible: boolean
}

export interface NewsArticle {
  id: string
  category: 'reglementaire' | 'scientifique' | 'pratique' | 'humour'
  title: string
  summary: string | null
  source: string | null
  external_url: string | null
  image_url: string | null
  is_external: boolean
  published_at: string
  is_published: boolean
}

export interface UserFormation {
  id: string
  user_id: string
  formation_id: string
  started_at: string
  completed_at: string | null
  is_active: boolean
  current_sequence: number
  access_type: 'demo' | 'full'
  formation?: Formation
}

export interface DailyAxisQuiz {
  id: string
  user_id: string
  axe_id: number
  quiz_date: string
  questions_ids: string[]
  answers: Record<string, { answer: boolean; correct: boolean }> | null
  score: number
  max_score: number
  completed_at: string | null
}

export interface DailyAxisProgress {
  id: string
  user_id: string
  axe_id: number
  progress_date: string
  points_earned: number
  quizzes_completed: number
}
