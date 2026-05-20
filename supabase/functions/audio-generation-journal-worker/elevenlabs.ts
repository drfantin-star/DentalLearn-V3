// Copie locale de supabase/functions/audio-generation-worker/elevenlabs.ts.
// Duplication contrôlée pour isoler le pipeline journal news du pipeline
// formations. Chunking 4500 chars (sans timestamps), pause 2 s entre chunks,
// retry 3x avec backoff exponentiel sur 429/5xx.

import { splitIntoChunks } from "./chunk-dialogue.ts";
import type { DialogueInput } from "./parse-dialogue.ts";

const SOPHIE_VOICE_ID = "t8BrjWUT5Z23DLLBzbuY";
const MARTIN_VOICE_ID = "ohItIVrXTBI80RrUECOD";
const DEFAULT_SPEED = 1.1;
const DEFAULT_MAX_CHARS_WITHOUT_TIMESTAMPS = 4500;
const DEFAULT_PAUSE_MS = 2000;
const DEFAULT_MAX_RETRIES = 3;
const ELEVENLABS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-dialogue";

export { MARTIN_VOICE_ID, SOPHIE_VOICE_ID };

export interface ChunkResult {
  audio: Uint8Array;
  chars: number;
}

export interface GenerateAudioOptions {
  inputs: DialogueInput[];
  speed?: number;
  maxCharsPerChunk?: number;
  pauseBetweenChunksMs?: number;
  maxRetries?: number;
}

export interface GenerateAudioResult {
  audio: Uint8Array;
  totalChars: number;
  totalChunks: number;
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
  speed: number,
  maxRetries: number,
  apiKey: string,
): Promise<ChunkResult> {
  const body: Record<string, unknown> = {
    inputs: chunk.map((i) => ({ voice_id: i.voice_id, text: i.text })),
    mode: "dialogue",
    settings: { speed },
  };
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

export async function generateDialogueAudio(
  options: GenerateAudioOptions,
): Promise<GenerateAudioResult> {
  const speed = options.speed ?? DEFAULT_SPEED;
  const maxChars = options.maxCharsPerChunk ??
    DEFAULT_MAX_CHARS_WITHOUT_TIMESTAMPS;
  const pauseMs = options.pauseBetweenChunksMs ?? DEFAULT_PAUSE_MS;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;

  if (options.inputs.length === 0) {
    throw new Error("generateDialogueAudio: aucune réplique fournie");
  }

  const apiKey = getElevenLabsApiKey();
  const chunks = splitIntoChunks(options.inputs, maxChars);
  const results: ChunkResult[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const r = await callChunk(chunks[i], speed, maxRetries, apiKey);
    results.push(r);
    if (i < chunks.length - 1) {
      await sleep(pauseMs);
    }
  }

  const audio = concatBytes(results.map((r) => r.audio));
  const totalChars = results.reduce((acc, r) => acc + r.chars, 0);

  return {
    audio,
    totalChars,
    totalChunks: chunks.length,
  };
}
