// Types Sprint 4 — Pipeline Audio Unifié

export type AudioJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AudioGenerationJob {
  id: string
  sequence_id: string | null
  news_episode_id: string | null
  triggered_by: string
  status: AudioJobStatus
  started_at: string | null
  completed_at: string | null
  script_text: string
  with_timestamps: boolean
  audio_url: string | null
  timeline_url: string | null
  duration_sec: number | null
  chars_consumed: number | null
  cost_eur: number | null
  error_log: AudioJobErrorLog | null
  retry_count: number
  created_at: string
  updated_at: string
}

export interface AudioJobErrorLog {
  message: string
  chunk_index?: number
  api_status?: number
  stack?: string
  timestamp: string
}

// Entrée dans audio_history (JSONB sur sequences)
export interface AudioHistoryEntry {
  audio_url: string
  generated_at: string       // ISO 8601
  replaced_at: string | null // null si version courante
  chars: number
  cost_eur: number
}

// Retour de l'endpoint job-status (polling UI)
export interface AudioJobStatusResponse {
  jobId: string
  status: AudioJobStatus
  progress: {
    chunks_processed: number
    total_chunks: number
  }
  audio_url?: string
  timeline_url?: string
  duration_sec?: number
  chars_consumed?: number
  cost_eur?: number
  error?: AudioJobErrorLog
}

// Stats retournées par upload-script (validation côté serveur)
export interface ScriptValidationResult {
  valid: boolean
  repliques: number
  chars: number
  estimated_duration_min: number  // chars / 150 mots/min / 5 chars/mot
  estimated_cost_eur: number      // chars / 1000 * 0.05
  validation_errors?: string[]
}
