// Port Deno de src/lib/audio-generation/build-timeline.ts.
// Validation Zod retirée (le timeline est consommé en lecture par
// extract-scenes-formation et l'UI ; un schéma cassé serait visible).

import type {
  AlignmentData,
  GenerateAudioResult,
  VoiceSegment,
} from "./elevenlabs.ts";

const SOPHIE_VOICE_ID = "t8BrjWUT5Z23DLLBzbuY";
const MARTIN_VOICE_ID = "ohItIVrXTBI80RrUECOD";
const GENERATOR_TAG = "auto_python_pipeline";

interface TimelineWord {
  text: string;
  start_sec: number;
  end_sec: number;
}

function voiceIdToSpeaker(voice_id: string): "sophie" | "martin" {
  if (voice_id === SOPHIE_VOICE_ID) return "sophie";
  if (voice_id === MARTIN_VOICE_ID) return "martin";
  return "martin";
}

function charactersToWords(
  chars: string[],
  starts: number[],
  ends: number[],
): TimelineWord[] {
  const words: TimelineWord[] = [];
  let curChars: string[] = [];
  let curStart: number | null = null;
  let prevEnd: number | null = null;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === " " || ch === "\n" || ch === "\t") {
      if (curChars.length > 0 && curStart !== null && prevEnd !== null) {
        const text = curChars.join("");
        if (text.trim().length > 0) {
          words.push({ text, start_sec: curStart, end_sec: prevEnd });
        }
        curChars = [];
        curStart = null;
        prevEnd = null;
      }
    } else {
      if (curChars.length === 0) curStart = starts[i];
      curChars.push(ch);
      prevEnd = ends[i];
    }
  }

  if (curChars.length > 0 && curStart !== null && prevEnd !== null) {
    const text = curChars.join("");
    if (text.trim().length > 0) {
      words.push({ text, start_sec: curStart, end_sec: prevEnd });
    }
  }

  return words;
}

function buildSegments(
  voice_segments: VoiceSegment[],
  alignment: AlignmentData,
) {
  return voice_segments.map((seg) => {
    const cs = seg.character_start_index;
    const ce = seg.character_end_index;
    const sliceChars = alignment.characters.slice(cs, ce);
    const sliceStarts = alignment.character_start_times_seconds.slice(cs, ce);
    const sliceEnds = alignment.character_end_times_seconds.slice(cs, ce);
    return {
      start_sec: seg.start_time_seconds,
      end_sec: seg.end_time_seconds,
      speaker: voiceIdToSpeaker(seg.voice_id),
      text: sliceChars.join("").trim(),
      words: charactersToWords(sliceChars, sliceStarts, sliceEnds),
    };
  });
}

export function buildTimelineFromAlignment(
  result: GenerateAudioResult,
  audioUrl: string,
  sourceType: "formation_sequence" | "news_synthesis",
  sourceId: string,
): Record<string, unknown> {
  const segments = result.alignment && result.voice_segments
    ? buildSegments(result.voice_segments, result.alignment)
    : [];

  return {
    schema_version: "1.0",
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
  };
}
