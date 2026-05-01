// src/lib/elevenlabs.ts
//
// Client minimal ElevenLabs pour la route /v1/text-to-dialogue (modèle eleven_v3).
// Pas de SDK officiel — fetch direct, mêmes contraintes que _shared/anthropic.ts :
//   - Clé API en variable d'environnement (ELEVENLABS_API_KEY) ;
//   - Backoff exponentiel sur 429/5xx, max 3 retries ;
//   - Aucune log des textes envoyés (pas de PII, mais on évite le bruit).
//
// Le module est server-only : il lit process.env.ELEVENLABS_API_KEY au moment
// de l'appel, jamais à l'import (sinon il casserait le bundling client de
// Next.js sur les composants qui importeraient indirectement).

// ---------------------------------------------------------------------------
// Constantes voix
// ---------------------------------------------------------------------------

export const VOICE_SOPHIE = 't8BrjWUT5Z23DLLBzbuY'
export const VOICE_MARTIN = 'ohItIVrXTBI80RrUECOD'

const ELEVEN_BASE = 'https://api.elevenlabs.io/v1'
const MODEL_ID = 'eleven_v3'
const MAX_CHUNK_CHARS = 4500
const MAX_RETRIES = 3
const PAUSE_BETWEEN_CHUNKS_MS = 1000

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DialogueSpeaker = 'sophie' | 'martin'

export interface DialogueTurn {
  speaker: DialogueSpeaker
  text: string
}

// ---------------------------------------------------------------------------
// 1. Parse du script Markdown → DialogueTurn[]
// ---------------------------------------------------------------------------

const SOPHIE_PREFIX_RE = /^Sophie:\s+/
const MARTIN_PREFIX_RE = /^Martin:\s+/

/**
 * Convertit un script "Sophie: ...\nMartin: ..." en suite de répliques.
 * Les audio_tags ([curious], [pause]…) sont CONSERVÉS dans le texte envoyé
 * à ElevenLabs — le modèle eleven_v3 les interprète nativement (cf doc).
 *
 * Les lignes vides et les lignes ne commençant pas par un préfixe locuteur
 * sont silencieusement ignorées (la validation côté news-audio.ts a déjà
 * statué sur la conformité du script — ici on est en mode parsing tolérant).
 */
export function parseDialogue(script_md: string): DialogueTurn[] {
  if (!script_md) return []
  const turns: DialogueTurn[] = []

  for (const rawLine of script_md.split('\n')) {
    const line = rawLine.trim()
    if (line.length === 0) continue

    if (SOPHIE_PREFIX_RE.test(line)) {
      turns.push({
        speaker: 'sophie',
        text: line.replace(SOPHIE_PREFIX_RE, '').trim(),
      })
    } else if (MARTIN_PREFIX_RE.test(line)) {
      turns.push({
        speaker: 'martin',
        text: line.replace(MARTIN_PREFIX_RE, '').trim(),
      })
    }
  }

  return turns
}

// ---------------------------------------------------------------------------
// 2. Découpage en chunks ≤ 4500 chars
// ---------------------------------------------------------------------------

/**
 * Découpe une suite de répliques en chunks dont la somme des longueurs de
 * texte ne dépasse pas maxChars. Une réplique n'est jamais coupée en deux —
 * si une seule réplique dépasse maxChars, elle constitue son propre chunk.
 */
export function chunkDialogue(
  turns: DialogueTurn[],
  maxChars: number = MAX_CHUNK_CHARS,
): DialogueTurn[][] {
  const chunks: DialogueTurn[][] = []
  let current: DialogueTurn[] = []
  let currentLen = 0

  for (const turn of turns) {
    const len = turn.text.length
    if (current.length > 0 && currentLen + len > maxChars) {
      chunks.push(current)
      current = []
      currentLen = 0
    }
    current.push(turn)
    currentLen += len
  }

  if (current.length > 0) chunks.push(current)
  return chunks
}

// ---------------------------------------------------------------------------
// 3. Appel POST /v1/text-to-dialogue avec retry
// ---------------------------------------------------------------------------

/**
 * Appelle ElevenLabs text-to-dialogue avec retry exponentiel (1s, 2s, 4s) sur
 * 429/5xx. Lève une Error détaillée si toutes les tentatives échouent.
 *
 * Retourne un Buffer Node contenant le MP3 brut.
 */
export async function callTextToDialogue(turns: DialogueTurn[]): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error('ELEVENLABS_API_KEY manquante côté serveur')
  }
  if (turns.length === 0) {
    throw new Error('callTextToDialogue: aucune réplique fournie')
  }

  const body = JSON.stringify({
    model_id: MODEL_ID,
    inputs: turns.map((t) => ({
      text: t.text,
      voice_id: t.speaker === 'sophie' ? VOICE_SOPHIE : VOICE_MARTIN,
    })),
  })

  let attempt = 0
  let lastErr: unknown

  while (attempt <= MAX_RETRIES) {
    try {
      const res = await fetch(`${ELEVEN_BASE}/text-to-dialogue`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body,
      })

      if (res.ok) {
        const arr = await res.arrayBuffer()
        return Buffer.from(arr)
      }

      const errText = await safeReadError(res)

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(
          `ElevenLabs ${res.status} ${res.statusText}: ${errText}`,
        )
        if (attempt < MAX_RETRIES) {
          await sleep(1000 * Math.pow(2, attempt))
          attempt++
          continue
        }
        throw lastErr
      }

      // 4xx non retryable.
      throw new Error(
        `ElevenLabs ${res.status} ${res.statusText}: ${errText} (non-retryable)`,
      )
    } catch (e) {
      // Erreur réseau ou throw du bloc ci-dessus.
      if (
        attempt < MAX_RETRIES &&
        e instanceof TypeError /* fetch network error */
      ) {
        lastErr = e
        await sleep(1000 * Math.pow(2, attempt))
        attempt++
        continue
      }
      throw e
    }
  }

  throw lastErr ?? new Error('ElevenLabs: retries épuisés')
}

// ---------------------------------------------------------------------------
// 4. Pipeline complet : script_md → buffer MP3 final
// ---------------------------------------------------------------------------

/**
 * Génère l'audio complet pour un script donné :
 *   parse → chunk → appels séquentiels callTextToDialogue → concat
 *
 * Pause d'1s entre chunks pour ne pas saturer l'API. Les buffers MP3 sont
 * concaténés tels quels — c'est OK pour des MP3 issus du même modèle/codec
 * et c'est ce que la doc ElevenLabs recommande pour le chunking.
 */
export async function generateFullAudio(script_md: string): Promise<Buffer> {
  const turns = parseDialogue(script_md)
  if (turns.length === 0) {
    throw new Error('generateFullAudio: script vide après parsing')
  }
  const chunks = chunkDialogue(turns)

  const buffers: Buffer[] = []
  for (let i = 0; i < chunks.length; i++) {
    const buf = await callTextToDialogue(chunks[i])
    buffers.push(buf)
    if (i < chunks.length - 1) {
      await sleep(PAUSE_BETWEEN_CHUNKS_MS)
    }
  }

  return Buffer.concat(buffers)
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

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
