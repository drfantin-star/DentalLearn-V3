// Types Ticket E — système de validation éditoriale (Qualiopi #21 + IA Act §50.4)

export type EditorialContentType = 'formation' | 'news_episode' | 'news_synthesis'

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

// ─────────────────────────────────────────────────────────────────────────────
// Rejet éditorial (news_synthesis uniquement)
// ─────────────────────────────────────────────────────────────────────────────
// Avant 09/2026, « non validée » mélangeait « pas encore lue » et « lue et
// refusée » : il n'existait aucune action de refus. Le rejet passe par
// news_syntheses.status = 'rejected', ce qui retire la synthèse de TOUTES les
// surfaces de lecture d'un coup (elles filtrent déjà status='active').
// Cf. migration 20260924a_news_synthesis_rejection.sql.

export type RejectionReason =
  | 'hors_sujet'
  | 'non_transposable'
  | 'preuve_insuffisante'
  | 'doublon'
  | 'qualite_synthese'
  | 'deja_traite'
  | 'autre'

// Libellés affichés. L'ordre est celui du menu de rejet : les motifs les plus
// fréquents d'abord, « Autre » en dernier.
export const REJECTION_REASONS: { value: RejectionReason; label: string; hint: string }[] = [
  { value: 'hors_sujet', label: 'Hors sujet', hint: 'Hors du champ dentaire' },
  { value: 'non_transposable', label: 'Non transposable', hint: "Sans portée pour l'exercice français" },
  { value: 'preuve_insuffisante', label: 'Preuve insuffisante', hint: 'Niveau de preuve trop faible' },
  { value: 'doublon', label: 'Doublon', hint: 'Sujet déjà couvert par une autre synthèse' },
  { value: 'qualite_synthese', label: 'Synthèse ratée', hint: "L'article est bon, la synthèse est mauvaise" },
  { value: 'deja_traite', label: 'Déjà traité', hint: 'Déjà couvert en formation ou dans le journal' },
  { value: 'autre', label: 'Autre', hint: '' },
]

export function rejectionReasonLabel(value: string | null): string {
  if (!value) return '—'
  return REJECTION_REASONS.find((r) => r.value === value)?.label ?? value
}

// Forme retournée par get_rejected_syntheses()
export interface RejectedSynthesis {
  id: string
  display_title: string | null
  specialite: string | null
  published_at: string | null
  created_at: string
  rejected_at: string | null
  rejection_reason: string | null
}

// Contenu sans validation courante (pour l'écran admin)
export interface ValidationCandidate {
  content_type: EditorialContentType
  content_id: string
  content_title: string
  axe_cp?: number | null      // formation uniquement
  episode_type?: string | null // news uniquement
  episode_status?: string | null // news uniquement : 'draft' | 'published' | 'archived'
  is_stale: boolean
  current_validation_id: string | null
  current_validated_at: string | null
  current_lead_name: string | null
  current_secondary_name: string | null
}
