export interface NewsCard {
  id: string
  display_title: string
  specialite: string | null
  category_editorial: string | null
  formation_category_match: string | null
  published_at: string | null
  cover_image_url: string | null
  summary_fr: string
  clinical_impact: string | null
  key_figures: string[] | null
  evidence_level: string | null
  caveats: string | null
}

export interface NewsDetail extends NewsCard {
  method: string | null
  themes: string[] | null
}

export interface NewsEpisode {
  audio_url: string
  duration_s: number
}

export interface NewsSource {
  doi: string | null
  source_url: string | null
  journal_name: string | null
}

export interface NewsDetailResponse {
  synthesis: NewsDetail
  episode: NewsEpisode | null
  source: NewsSource | null
}

// ---------------------------------------------------------------------------
// Journal hebdo (T11)
// ---------------------------------------------------------------------------

// Synthèse vue depuis un journal hebdo : projection à plat des champs
// utiles à la home + modal détail. Triée par position côté API.
export interface JournalSynthesisProjection {
  position: number
  display_title: string | null
  specialite: string | null
  summary_fr: string | null
  clinical_impact: string | null
  key_figures: string[] | null
  evidence_level: string | null
  source_url: string | null
  journal_name: string | null
}

export interface JournalEpisode {
  id: string
  week_iso: string                   // ex: "2026-W19"
  audio_url: string
  duration_s: number
  status: 'draft' | 'published' | 'archived'
  created_at: string
  published_at: string | null
  syntheses: JournalSynthesisProjection[]
}
