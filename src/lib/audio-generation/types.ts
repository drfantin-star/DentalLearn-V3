import type { AudioJobStatus } from '@/types/audio-jobs'

// Re-export pour consommateurs internes du module
export type { AudioJobStatus }

export interface DialogueInput {
  voice_id: string
  text: string
  speaker?: 'sophie' | 'martin'
}

export interface GenerateAudioOptions {
  inputs: DialogueInput[]
  speed?: number                  // défaut 1.1
  withTimestamps: boolean
  maxCharsPerChunk?: number       // défaut 1900 si timestamps, sinon 4500
  pauseBetweenChunksMs?: number   // défaut 2000
  maxRetries?: number             // défaut 3
}

export interface AlignmentData {
  characters: string[]
  character_start_times_seconds: number[]
  character_end_times_seconds: number[]
}

export interface VoiceSegment {
  voice_id: string
  start_time_seconds: number
  end_time_seconds: number
  character_start_index: number
  character_end_index: number
  dialogue_input_index: number
}

export interface ChunkResult {
  audio: Buffer
  alignment?: AlignmentData
  voice_segments?: VoiceSegment[]
  chars: number
}

export interface GenerateAudioResult {
  audio: Buffer
  alignment?: AlignmentData
  voice_segments?: VoiceSegment[]
  totalChars: number
  totalChunks: number
  durationSec: number
}

export interface CreateJobOptions {
  sequenceId?: string
  newsEpisodeId?: string
  scriptText: string
  triggeredBy: string
  withTimestamps: boolean
  // Sprint 4 T6 — Batch multi-séquences. UUID partagé par les jobs du même
  // batch + index d'ordonnancement (0..N-1). batch_id NULL = mono-séquence.
  batchId?: string
  batchIndex?: number
}

export interface UpdateJobOptions {
  audioUrl?: string
  timelineUrl?: string
  durationSec?: number
  charsConsumed?: number
  costEur?: number
  errorLog?: object
  chunksProcessed?: number
  totalChunks?: number
}
