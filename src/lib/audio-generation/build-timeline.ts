import { TimelineSchema, type Timeline, type TimelineWord } from '@/lib/timeline/schema'
import type { AlignmentData, GenerateAudioResult, VoiceSegment } from './types'

const SOPHIE_VOICE_ID = 't8BrjWUT5Z23DLLBzbuY'
const MARTIN_VOICE_ID = 'ohItIVrXTBI80RrUECOD'
const GENERATOR_TAG = 'auto_python_pipeline'

function voiceIdToSpeaker(voice_id: string): 'sophie' | 'martin' {
  if (voice_id === SOPHIE_VOICE_ID) return 'sophie'
  if (voice_id === MARTIN_VOICE_ID) return 'martin'
  return 'martin'
}

/**
 * Regroupe une tranche de caractères en mots (split sur espaces/sauts de ligne).
 * Réimplémentation de characters_to_words() Python.
 */
function charactersToWords(
  chars: string[],
  starts: number[],
  ends: number[],
): TimelineWord[] {
  const words: TimelineWord[] = []
  let curChars: string[] = []
  let curStart: number | null = null
  let prevEnd: number | null = null

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i]
    if (ch === ' ' || ch === '\n' || ch === '\t') {
      if (curChars.length > 0 && curStart !== null && prevEnd !== null) {
        const text = curChars.join('')
        if (text.trim().length > 0) {
          words.push({ text, start_sec: curStart, end_sec: prevEnd })
        }
        curChars = []
        curStart = null
        prevEnd = null
      }
    } else {
      if (curChars.length === 0) curStart = starts[i]
      curChars.push(ch)
      prevEnd = ends[i]
    }
  }

  if (curChars.length > 0 && curStart !== null && prevEnd !== null) {
    const text = curChars.join('')
    if (text.trim().length > 0) {
      words.push({ text, start_sec: curStart, end_sec: prevEnd })
    }
  }

  return words
}

function buildSegments(
  voice_segments: VoiceSegment[],
  alignment: AlignmentData,
) {
  return voice_segments.map((seg) => {
    const cs = seg.character_start_index
    const ce = seg.character_end_index
    const sliceChars = alignment.characters.slice(cs, ce)
    const sliceStarts = alignment.character_start_times_seconds.slice(cs, ce)
    const sliceEnds = alignment.character_end_times_seconds.slice(cs, ce)
    return {
      start_sec: seg.start_time_seconds,
      end_sec: seg.end_time_seconds,
      speaker: voiceIdToSpeaker(seg.voice_id),
      text: sliceChars.join('').trim(),
      words: charactersToWords(sliceChars, sliceStarts, sliceEnds),
    }
  })
}

/**
 * Construit un objet Timeline JSON v1.0 depuis les données d'alignment
 * ElevenLabs. Parité stricte avec build_timeline() Python (PHASE_2B).
 *
 * Validation finale via TimelineSchema.safeParse — en cas d'échec, log un
 * warning mais retourne quand même le timeline (ne pas bloquer la génération
 * audio pour une erreur de schéma).
 */
export function buildTimelineFromAlignment(
  _scriptText: string,
  result: GenerateAudioResult,
  audioUrl: string,
  sourceType: 'formation_sequence' | 'news_synthesis',
  sourceId: string,
): Record<string, unknown> {
  const segments =
    result.alignment && result.voice_segments
      ? buildSegments(result.voice_segments, result.alignment)
      : []

  const timeline: Timeline = {
    schema_version: '1.0',
    source_type: sourceType,
    source_id: sourceId,
    audio_url: audioUrl,
    duration_sec: result.durationSec,
    generated_at: new Date().toISOString(),
    generator: GENERATOR_TAG,
    transcript: { segments },
    concepts: [],
    scenes: [],
    chapters: [],
  }

  const parsed = TimelineSchema.safeParse(timeline)
  if (!parsed.success) {
    console.warn(
      '[buildTimelineFromAlignment] Timeline produit ne valide pas le schéma Zod :',
      parsed.error.issues,
    )
  }

  return timeline as unknown as Record<string, unknown>
}
