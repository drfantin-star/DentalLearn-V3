import { splitIntoChunks } from './chunk-dialogue'
import type {
  AlignmentData,
  ChunkResult,
  DialogueInput,
  GenerateAudioOptions,
  GenerateAudioResult,
  VoiceSegment,
} from './types'

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const SOPHIE_VOICE_ID = 't8BrjWUT5Z23DLLBzbuY'
const MARTIN_VOICE_ID = 'ohItIVrXTBI80RrUECOD'
const DEFAULT_SPEED = 1.1
const DEFAULT_MAX_CHARS_WITH_TIMESTAMPS = 1900
const DEFAULT_MAX_CHARS_WITHOUT_TIMESTAMPS = 4500
const DEFAULT_PAUSE_MS = 2000
const DEFAULT_MAX_RETRIES = 3
const ELEVENLABS_COST_PER_1000_CHARS = 0.05
const EMOTION_TAG_PATTERN = /\[[a-zA-Z_]+\]/g
const ELEVENLABS_ENDPOINT = 'https://api.elevenlabs.io/v1/text-to-dialogue'

// Export pour consommateurs externes (UI affichage coût estimé).
export {
  SOPHIE_VOICE_ID,
  MARTIN_VOICE_ID,
  DEFAULT_SPEED,
  ELEVENLABS_COST_PER_1000_CHARS,
}

// ---------------------------------------------------------------------------
// Types internes pour la réponse ElevenLabs
// ---------------------------------------------------------------------------

interface ElevenLabsTimestampsResponse {
  audio_base_64: string
  normalized_alignment: {
    characters: string[]
    character_start_times_seconds: number[]
    character_end_times_seconds: number[]
  }
  voice_segments?: Array<{
    voice_id: string
    start_time_seconds: number
    end_time_seconds: number
    character_start_index: number
    character_end_index: number
    dialogue_input_index?: number
  }>
}

// ---------------------------------------------------------------------------
// Helpers internes
// ---------------------------------------------------------------------------

function getElevenLabsApiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY
  if (!key) {
    throw new Error("ELEVENLABS_API_KEY manquante dans les variables d'environnement")
  }
  return key
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const text = await res.text()
    return text.slice(0, 500)
  } catch {
    return '(no body)'
  }
}

// ---------------------------------------------------------------------------
// Appel API pour un chunk avec retry
// ---------------------------------------------------------------------------

async function callChunk(
  chunk: DialogueInput[],
  withTimestamps: boolean,
  speed: number,
  maxRetries: number,
  apiKey: string,
): Promise<ChunkResult> {
  const body: Record<string, unknown> = {
    inputs: chunk.map((i) => ({ voice_id: i.voice_id, text: i.text })),
    mode: 'dialogue',
    settings: { speed },
  }
  if (withTimestamps) {
    body.with_timestamps = true
  }
  const bodyStr = JSON.stringify(body)
  const chars = chunk.reduce((acc, i) => acc + i.text.length, 0)

  let attempt = 0
  let lastErr: unknown

  while (attempt <= maxRetries) {
    let res: Response
    try {
      res = await fetch(ELEVENLABS_ENDPOINT, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: bodyStr,
      })
    } catch (e) {
      // Erreur réseau bas-niveau → retry avec backoff
      lastErr = e
      if (attempt < maxRetries) {
        await sleep(Math.pow(2, attempt) * 1000)
        attempt++
        continue
      }
      throw lastErr instanceof Error
        ? lastErr
        : new Error('ElevenLabs: erreur réseau')
    }

    if (res.ok) {
      if (withTimestamps) {
        const json = (await res.json()) as ElevenLabsTimestampsResponse
        const audio = Buffer.from(json.audio_base_64, 'base64')
        const alignment: AlignmentData = {
          characters: json.normalized_alignment.characters.slice(),
          character_start_times_seconds:
            json.normalized_alignment.character_start_times_seconds.map(Number),
          character_end_times_seconds:
            json.normalized_alignment.character_end_times_seconds.map(Number),
        }
        const voice_segments: VoiceSegment[] = (json.voice_segments ?? []).map(
          (seg, idx) => ({
            voice_id: seg.voice_id,
            start_time_seconds: Number(seg.start_time_seconds),
            end_time_seconds: Number(seg.end_time_seconds),
            character_start_index: Number(seg.character_start_index),
            character_end_index: Number(seg.character_end_index),
            dialogue_input_index:
              typeof seg.dialogue_input_index === 'number'
                ? seg.dialogue_input_index
                : idx,
          }),
        )
        return { audio, alignment, voice_segments, chars }
      }
      const arr = await res.arrayBuffer()
      return { audio: Buffer.from(arr), chars }
    }

    const errText = await safeReadError(res)

    // 4xx non-retryable (sauf 429)
    if (res.status >= 400 && res.status < 500 && res.status !== 429) {
      throw new Error(
        `ElevenLabs ${res.status} ${res.statusText}: ${errText} (non-retryable)`,
      )
    }

    // 429 + 5xx : retry avec backoff exponentiel
    lastErr = new Error(`ElevenLabs ${res.status} ${res.statusText}: ${errText}`)
    if (attempt < maxRetries) {
      await sleep(Math.pow(2, attempt) * 1000)
      attempt++
      continue
    }
    throw lastErr
  }

  throw lastErr instanceof Error ? lastErr : new Error('ElevenLabs: retries épuisés')
}

// ---------------------------------------------------------------------------
// Merge des alignments avec offset temporel
// ---------------------------------------------------------------------------

interface MergeResult {
  alignment: AlignmentData
  voice_segments: VoiceSegment[]
  totalDurationSec: number
}

/**
 * Concatène les alignments de tous les chunks en offsetant à la fois les
 * timestamps (cumulative duration) et les indices caractères (cumulative count).
 * Les `dialogue_input_index` sont aussi offsetés du nombre d'inputs déjà traités.
 */
function mergeChunkResults(
  chunks: DialogueInput[][],
  results: ChunkResult[],
): MergeResult {
  const characters: string[] = []
  const startTimes: number[] = []
  const endTimes: number[] = []
  const mergedSegments: VoiceSegment[] = []

  let timeOffset = 0
  let charOffset = 0
  let inputOffset = 0

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (!r.alignment) continue

    const { characters: cs, character_start_times_seconds: ss, character_end_times_seconds: es } =
      r.alignment

    for (let k = 0; k < cs.length; k++) {
      characters.push(cs[k])
      startTimes.push(ss[k] + timeOffset)
      endTimes.push(es[k] + timeOffset)
    }

    for (const seg of r.voice_segments ?? []) {
      mergedSegments.push({
        voice_id: seg.voice_id,
        start_time_seconds: seg.start_time_seconds + timeOffset,
        end_time_seconds: seg.end_time_seconds + timeOffset,
        character_start_index: seg.character_start_index + charOffset,
        character_end_index: seg.character_end_index + charOffset,
        dialogue_input_index: seg.dialogue_input_index + inputOffset,
      })
    }

    const chunkDuration = es.length > 0 ? es[es.length - 1] : 0
    timeOffset += chunkDuration
    charOffset += cs.length
    inputOffset += chunks[i].length
  }

  return {
    alignment: {
      characters,
      character_start_times_seconds: startTimes,
      character_end_times_seconds: endTimes,
    },
    voice_segments: mergedSegments,
    totalDurationSec: timeOffset,
  }
}

// ---------------------------------------------------------------------------
// Filtrage des balises émotion
// ---------------------------------------------------------------------------

/**
 * Retire les balises émotion ElevenLabs v3 (`[concerned]`, `[serious]`, ...)
 * du transcript karaoké. L'audio reste inchangé — seuls les caractères de
 * balise et leurs entrées dans starts/ends sont supprimés, et les indices
 * des voice_segments sont réindexés sur la liste filtrée.
 */
function stripEmotionTagsFromAlignment(
  alignment: AlignmentData,
  voice_segments: VoiceSegment[],
): { alignment: AlignmentData; voice_segments: VoiceSegment[] } {
  const text = alignment.characters.join('')
  // Court-circuit : pas de balise détectée → renvoyer tel quel
  EMOTION_TAG_PATTERN.lastIndex = 0
  if (!EMOTION_TAG_PATTERN.test(text)) {
    return { alignment, voice_segments }
  }

  const n = alignment.characters.length
  const keep: boolean[] = new Array(n).fill(true)

  EMOTION_TAG_PATTERN.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = EMOTION_TAG_PATTERN.exec(text)) !== null) {
    for (let i = m.index; i < m.index + m[0].length; i++) {
      keep[i] = false
    }
  }

  const filteredChars: string[] = []
  const filteredStarts: number[] = []
  const filteredEnds: number[] = []
  const oldToNew: number[] = new Array(n + 1).fill(0)
  let count = 0

  for (let i = 0; i < n; i++) {
    oldToNew[i] = count
    if (keep[i]) {
      filteredChars.push(alignment.characters[i])
      filteredStarts.push(alignment.character_start_times_seconds[i])
      filteredEnds.push(alignment.character_end_times_seconds[i])
      count++
    }
  }
  oldToNew[n] = count

  const reindexedSegments: VoiceSegment[] = voice_segments.map((seg) => ({
    voice_id: seg.voice_id,
    start_time_seconds: seg.start_time_seconds,
    end_time_seconds: seg.end_time_seconds,
    character_start_index: oldToNew[Math.min(seg.character_start_index, n)],
    character_end_index: oldToNew[Math.min(seg.character_end_index, n)],
    dialogue_input_index: seg.dialogue_input_index,
  }))

  return {
    alignment: {
      characters: filteredChars,
      character_start_times_seconds: filteredStarts,
      character_end_times_seconds: filteredEnds,
    },
    voice_segments: reindexedSegments,
  }
}

// ---------------------------------------------------------------------------
// API publique
// ---------------------------------------------------------------------------

/**
 * Génère l'audio d'un dialogue Sophie/Martin complet via ElevenLabs.
 * Parité stricte avec generate_audio_PHASE_2B.py.
 */
export async function generateDialogueAudio(
  options: GenerateAudioOptions,
): Promise<GenerateAudioResult> {
  const speed = options.speed ?? DEFAULT_SPEED
  const withTimestamps = options.withTimestamps
  const maxChars =
    options.maxCharsPerChunk ??
    (withTimestamps
      ? DEFAULT_MAX_CHARS_WITH_TIMESTAMPS
      : DEFAULT_MAX_CHARS_WITHOUT_TIMESTAMPS)
  const pauseMs = options.pauseBetweenChunksMs ?? DEFAULT_PAUSE_MS
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES

  if (options.inputs.length === 0) {
    throw new Error('generateDialogueAudio: aucune réplique fournie')
  }

  const apiKey = getElevenLabsApiKey()
  const chunks = splitIntoChunks(options.inputs, maxChars)
  const results: ChunkResult[] = []

  for (let i = 0; i < chunks.length; i++) {
    const r = await callChunk(chunks[i], withTimestamps, speed, maxRetries, apiKey)
    results.push(r)
    if (i < chunks.length - 1) {
      await sleep(pauseMs)
    }
  }

  const audio = Buffer.concat(results.map((r) => r.audio))
  const totalChars = results.reduce((acc, r) => acc + r.chars, 0)

  if (!withTimestamps) {
    // Pas de timestamps → on ne peut pas dériver la durée précise. Renvoyer 0
    // (le caller utilise une autre source ou ignore la durée en mode legacy).
    return {
      audio,
      totalChars,
      totalChunks: chunks.length,
      durationSec: 0,
    }
  }

  const merged = mergeChunkResults(chunks, results)
  const stripped = stripEmotionTagsFromAlignment(
    merged.alignment,
    merged.voice_segments,
  )

  const ends = stripped.alignment.character_end_times_seconds
  const durationSec =
    ends.length > 0 ? ends[ends.length - 1] : merged.totalDurationSec

  return {
    audio,
    alignment: stripped.alignment,
    voice_segments: stripped.voice_segments,
    totalChars,
    totalChunks: chunks.length,
    durationSec,
  }
}
