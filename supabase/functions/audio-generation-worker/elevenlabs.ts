// Port Deno fidèle de src/lib/audio-generation/elevenlabs.ts (T5-bis).
// Conserve chunking + retry 429/5xx avec backoff exponentiel + merge alignments
// + strip balises émotion v3. `Buffer` Node remplacé par `Uint8Array`.

import { splitIntoChunks } from "./chunk-dialogue.ts";
import type { DialogueInput } from "./parse-dialogue.ts";

const SOPHIE_VOICE_ID = "t8BrjWUT5Z23DLLBzbuY";
const MARTIN_VOICE_ID = "ohItIVrXTBI80RrUECOD";
const DEFAULT_SPEED = 1.1;
const DEFAULT_MAX_CHARS_WITH_TIMESTAMPS = 1900;
const DEFAULT_MAX_CHARS_WITHOUT_TIMESTAMPS = 4500;
const DEFAULT_PAUSE_MS = 2000;
const DEFAULT_MAX_RETRIES = 3;
const EMOTION_TAG_PATTERN = /\[[a-zA-Z_]+\]/g;
const ELEVENLABS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-dialogue";

export { SOPHIE_VOICE_ID, MARTIN_VOICE_ID };

export interface AlignmentData {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface VoiceSegment {
  voice_id: string;
  start_time_seconds: number;
  end_time_seconds: number;
  character_start_index: number;
  character_end_index: number;
  dialogue_input_index: number;
}

export interface ChunkResult {
  audio: Uint8Array;
  alignment?: AlignmentData;
  voice_segments?: VoiceSegment[];
  chars: number;
}

export interface GenerateAudioOptions {
  inputs: DialogueInput[];
  speed?: number;
  withTimestamps: boolean;
  maxCharsPerChunk?: number;
  pauseBetweenChunksMs?: number;
  maxRetries?: number;
}

export interface GenerateAudioResult {
  audio: Uint8Array;
  alignment?: AlignmentData;
  voice_segments?: VoiceSegment[];
  totalChars: number;
  totalChunks: number;
  durationSec: number;
}

interface ElevenLabsTimestampsResponse {
  audio_base_64: string;
  normalized_alignment: {
    characters: string[];
    character_start_times_seconds: number[];
    character_end_times_seconds: number[];
  };
  voice_segments?: Array<{
    voice_id: string;
    start_time_seconds: number;
    end_time_seconds: number;
    character_start_index: number;
    character_end_index: number;
    dialogue_input_index?: number;
  }>;
}

function getElevenLabsApiKey(): string {
  const key = Deno.env.get("ELEVENLABS_API_KEY");
  if (!key) {
    throw new Error(
      "ELEVENLABS_API_KEY manquante dans les variables d'environnement",
    );
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    return text.slice(0, 500);
  } catch {
    return "(no body)";
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const len = bin.length;
  const out = new Uint8Array(len);
  for (let i = 0; i < len; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

async function callChunk(
  chunk: DialogueInput[],
  withTimestamps: boolean,
  speed: number,
  maxRetries: number,
  apiKey: string,
): Promise<ChunkResult> {
  const body: Record<string, unknown> = {
    inputs: chunk.map((i) => ({ voice_id: i.voice_id, text: i.text })),
    mode: "dialogue",
    settings: { speed },
  };
  if (withTimestamps) {
    body.with_timestamps = true;
  }
  const bodyStr = JSON.stringify(body);
  const chars = chunk.reduce((acc, i) => acc + i.text.length, 0);

  let attempt = 0;
  let lastErr: unknown;

  while (attempt <= maxRetries) {
    let res: Response;
    try {
      res = await fetch(ELEVENLABS_ENDPOINT, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: bodyStr,
      });
    } catch (e) {
      lastErr = e;
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000);
        attempt++;
        continue;
      }
      throw lastErr instanceof Error
        ? lastErr
        : new Error("ElevenLabs: erreur réseau");
    }

    if (res.ok) {
      // ElevenLabs /v1/text-to-dialogue retourne TOUJOURS du MP3 binaire
      // (header "ID3..."), même quand `with_timestamps: true` est envoyé dans
      // le body — le flag est silencieusement ignoré côté API. Lire en JSON
      // crash sur "Unexpected token 'I'". Pas d'alignment disponible par
      // cette route ; le timeline JSON n'est donc pas généré.
      const arr = await res.arrayBuffer();
      return { audio: new Uint8Array(arr), chars };
    }

    const errText = await safeReadError(res);

    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      throw new Error(
        `ElevenLabs ${res.status} ${res.statusText}: ${errText} (non-retryable)`,
      );
    }

    lastErr = new Error(
      `ElevenLabs ${res.status} ${res.statusText}: ${errText}`,
    );
    if (attempt < maxRetries) {
      await sleep(Math.pow(2, attempt) * 1000);
      attempt++;
      continue;
    }
    throw lastErr;
  }

  throw lastErr instanceof Error
    ? lastErr
    : new Error("ElevenLabs: retries épuisés");
}

interface MergeResult {
  alignment: AlignmentData;
  voice_segments: VoiceSegment[];
  totalDurationSec: number;
}

function mergeChunkResults(
  chunks: DialogueInput[][],
  results: ChunkResult[],
): MergeResult {
  const characters: string[] = [];
  const startTimes: number[] = [];
  const endTimes: number[] = [];
  const mergedSegments: VoiceSegment[] = [];

  let timeOffset = 0;
  let charOffset = 0;
  let inputOffset = 0;

  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    if (!r.alignment) continue;

    const {
      characters: cs,
      character_start_times_seconds: ss,
      character_end_times_seconds: es,
    } = r.alignment;

    for (let k = 0; k < cs.length; k++) {
      characters.push(cs[k]);
      startTimes.push(ss[k] + timeOffset);
      endTimes.push(es[k] + timeOffset);
    }

    for (const seg of r.voice_segments ?? []) {
      mergedSegments.push({
        voice_id: seg.voice_id,
        start_time_seconds: seg.start_time_seconds + timeOffset,
        end_time_seconds: seg.end_time_seconds + timeOffset,
        character_start_index: seg.character_start_index + charOffset,
        character_end_index: seg.character_end_index + charOffset,
        dialogue_input_index: seg.dialogue_input_index + inputOffset,
      });
    }

    const chunkDuration = es.length > 0 ? es[es.length - 1] : 0;
    timeOffset += chunkDuration;
    charOffset += cs.length;
    inputOffset += chunks[i].length;
  }

  return {
    alignment: {
      characters,
      character_start_times_seconds: startTimes,
      character_end_times_seconds: endTimes,
    },
    voice_segments: mergedSegments,
    totalDurationSec: timeOffset,
  };
}

function stripEmotionTagsFromAlignment(
  alignment: AlignmentData,
  voice_segments: VoiceSegment[],
): { alignment: AlignmentData; voice_segments: VoiceSegment[] } {
  const text = alignment.characters.join("");
  EMOTION_TAG_PATTERN.lastIndex = 0;
  if (!EMOTION_TAG_PATTERN.test(text)) {
    return { alignment, voice_segments };
  }

  const n = alignment.characters.length;
  const keep: boolean[] = new Array(n).fill(true);

  EMOTION_TAG_PATTERN.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = EMOTION_TAG_PATTERN.exec(text)) !== null) {
    for (let i = m.index; i < m.index + m[0].length; i++) {
      keep[i] = false;
    }
  }

  const filteredChars: string[] = [];
  const filteredStarts: number[] = [];
  const filteredEnds: number[] = [];
  const oldToNew: number[] = new Array(n + 1).fill(0);
  let count = 0;

  for (let i = 0; i < n; i++) {
    oldToNew[i] = count;
    if (keep[i]) {
      filteredChars.push(alignment.characters[i]);
      filteredStarts.push(alignment.character_start_times_seconds[i]);
      filteredEnds.push(alignment.character_end_times_seconds[i]);
      count++;
    }
  }
  oldToNew[n] = count;

  const reindexedSegments: VoiceSegment[] = voice_segments.map((seg) => ({
    voice_id: seg.voice_id,
    start_time_seconds: seg.start_time_seconds,
    end_time_seconds: seg.end_time_seconds,
    character_start_index: oldToNew[Math.min(seg.character_start_index, n)],
    character_end_index: oldToNew[Math.min(seg.character_end_index, n)],
    dialogue_input_index: seg.dialogue_input_index,
  }));

  return {
    alignment: {
      characters: filteredChars,
      character_start_times_seconds: filteredStarts,
      character_end_times_seconds: filteredEnds,
    },
    voice_segments: reindexedSegments,
  };
}

export async function generateDialogueAudio(
  options: GenerateAudioOptions,
): Promise<GenerateAudioResult> {
  const speed = options.speed ?? DEFAULT_SPEED;
  const withTimestamps = options.withTimestamps;
  const maxChars = options.maxCharsPerChunk ??
    (withTimestamps
      ? DEFAULT_MAX_CHARS_WITH_TIMESTAMPS
      : DEFAULT_MAX_CHARS_WITHOUT_TIMESTAMPS);
  const pauseMs = options.pauseBetweenChunksMs ?? DEFAULT_PAUSE_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (options.inputs.length === 0) {
    throw new Error("generateDialogueAudio: aucune réplique fournie");
  }

  const apiKey = getElevenLabsApiKey();
  const chunks = splitIntoChunks(options.inputs, maxChars);
  const results: ChunkResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const r = await callChunk(
      chunks[i],
      withTimestamps,
      speed,
      maxRetries,
      apiKey,
    );
    results.push(r);
    if (i < chunks.length - 1) {
      await sleep(pauseMs);
    }
  }

  const audio = concatBytes(results.map((r) => r.audio));
  const totalChars = results.reduce((acc, r) => acc + r.chars, 0);

  if (!withTimestamps) {
    return {
      audio,
      totalChars,
      totalChunks: chunks.length,
      durationSec: 0,
    };
  }

  const merged = mergeChunkResults(chunks, results);
  const stripped = stripEmotionTagsFromAlignment(
    merged.alignment,
    merged.voice_segments,
  );

  const ends = stripped.alignment.character_end_times_seconds;
  const durationSec = ends.length > 0
    ? ends[ends.length - 1]
    : merged.totalDurationSec;

  return {
    audio,
    alignment: stripped.alignment,
    voice_segments: stripped.voice_segments,
    totalChars,
    totalChunks: chunks.length,
    durationSec,
  };
}
