// Types Ticket E — système de validation éditoriale (Qualiopi #21 + IA Act §50.4)

export type EditorialContentType = 'formation' | 'news_episode'

export interface CsMember {
  id: string
  user_id: string | null
  display_name: string
  title: string | null
  expertise_areas: string[]
  photo_url: string | null
  bio_short: string | null
  is_lead: boolean
  active: boolean
  joined_at: string // YYYY-MM-DD
  created_at: string
  updated_at: string
}

export interface ValidationStatus {
  validated: boolean
  is_stale: boolean
  validation_id: string | null
  validated_at: string | null
  lead_name: string | null
  lead_title: string | null
  secondary_name: string | null
  secondary_title: string | null
  comments: string | null
}

export interface EditorialValidation {
  id: string
  content_type: EditorialContentType
  content_id: string
  content_hash: string
  validated_by_lead: string
  validated_by_secondary: string | null
  validated_at: string
  comments: string | null
  is_current: boolean
  metadata: Record<string, unknown>
  created_at: string
}

// Forme retournée par validate_content_bulk
export interface BulkValidationResult {
  content_type: EditorialContentType
  content_id: string
  validation_id: string
}

// Contenu sans validation courante (pour l'écran admin)
export interface ValidationCandidate {
  content_type: EditorialContentType
  content_id: string
  content_title: string
  axe_cp?: number | null      // formation uniquement
  episode_type?: string | null // news uniquement
  is_stale: boolean
  current_validation_id: string | null
  current_validated_at: string | null
  current_lead_name: string | null
  current_secondary_name: string | null
}
