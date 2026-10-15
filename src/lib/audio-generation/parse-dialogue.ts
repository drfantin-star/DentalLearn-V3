import type { DialogueInput } from './types'

// IDs voix ElevenLabs (Sophie/Martin, standard Dentalschool)
export const VOICE_IDS = {
  sophie: 't8BrjWUT5Z23DLLBzbuY',
  martin: 'ohItIVrXTBI80RrUECOD',
} as const

export type Speaker = keyof typeof VOICE_IDS

const MAX_REPLIQUES = 50
const MIN_REPLIQUES = 2
const MAX_TOTAL_CHARS = 30_000

// 150 mots/min, ~5 caractères/mot ≈ 750 chars/min
const CHARS_PER_MINUTE = 750
const COST_PER_1000_CHARS_EUR = 0.05

const SPEAKER_LINE_RE = /^(sophie|martin)\s*:\s*(.*)$/i
// Audio tags ElevenLabs v3 : [pause], [laughs], [excited]…
const AUDIO_TAG_RE = /\[[^\]]*\]/g

/** Texte d'une réplique une fois les audio tags retirés. */
function stripAudioTags(text: string): string {
  return text.replace(AUDIO_TAG_RE, '').trim()
}

/**
 * Parse un script dialogue Sophie/Martin au format Dentalschool.
 * Réimplémentation TypeScript fidèle de parse_dialogue() Python (generate_audio_PHASE_2B.py).
 *
 * 15/10/2026 : une réplique composée uniquement d'audio tags (ex. « Martin: [pause] »,
 * fréquent dans les scripts journal générés par Sonnet) était envoyée telle quelle et
 * ElevenLabs la refusait (400 input_text_empty : « Input at position N has empty text »).
 * Ces tags sont désormais reportés en tête de la réplique parlée suivante — la pause
 * est conservée, sans réplique vide. Si rien ne suit, ils sont ignorés.
 */
export function parseDialogueScript(text: string): DialogueInput[] {
  if (!text) return []

  const out: DialogueInput[] = []
  const lines = text.split(/\r?\n/)
  let pendingTags = ''

  for (const raw of lines) {
    const line = raw.trim()
    if (line.length === 0) continue
    if (line.startsWith('#')) continue

    const m = SPEAKER_LINE_RE.exec(line)
    if (!m) continue

    const speakerRaw = m[1].toLowerCase()
    const speaker: Speaker = speakerRaw === 'sophie' ? 'sophie' : 'martin'
    const replyText = m[2].trim()
    if (replyText.length === 0) continue

    // Réplique « tags seuls » : on la reporte sur la suivante
    if (stripAudioTags(replyText).length === 0) {
      pendingTags = pendingTags ? `${pendingTags} ${replyText}` : replyText
      continue
    }

    out.push({
      voice_id: VOICE_IDS[speaker],
      text: pendingTags ? `${pendingTags} ${replyText}` : replyText,
      speaker,
    })
    pendingTags = ''
  }

  return out
}

/**
 * Valide un script parsé. Retourne la liste des erreurs (vide = valide).
 */
export function validateDialogue(inputs: DialogueInput[]): string[] {
  const errors: string[] = []

  if (inputs.length < MIN_REPLIQUES) {
    errors.push(`Script trop court : ${inputs.length} réplique(s), minimum ${MIN_REPLIQUES}.`)
  }
  if (inputs.length > MAX_REPLIQUES) {
    errors.push(`Script trop long : ${inputs.length} répliques, maximum ${MAX_REPLIQUES}.`)
  }

  const totalChars = inputs.reduce((acc, i) => acc + i.text.length, 0)
  if (totalChars > MAX_TOTAL_CHARS) {
    errors.push(`Script dépasse la limite caractères : ${totalChars} > ${MAX_TOTAL_CHARS}.`)
  }

  // Même critère qu'ElevenLabs : vide une fois les audio tags retirés
  const hasEmpty = inputs.some((i) => stripAudioTags(i.text).length === 0)
  if (hasEmpty) {
    errors.push('Une ou plusieurs répliques ont un texte vide (hors audio tags).')
  }

  const hasSophie = inputs.some((i) => i.speaker === 'sophie')
  const hasMartin = inputs.some((i) => i.speaker === 'martin')
  if (!hasSophie || !hasMartin) {
    errors.push('Le script doit contenir au moins une réplique Sophie et une réplique Martin.')
  }

  return errors
}

export interface ScriptStats {
  repliques: number
  chars: number
  estimatedDurationMin: number
  estimatedCostEur: number
}

/**
 * Statistiques d'un script parsé — utilisé par la route /upload-script.
 */
export function computeScriptStats(inputs: DialogueInput[]): ScriptStats {
  const chars = inputs.reduce((acc, i) => acc + i.text.length, 0)
  return {
    repliques: inputs.length,
    chars,
    estimatedDurationMin: chars / CHARS_PER_MINUTE,
    estimatedCostEur: (chars / 1000) * COST_PER_1000_CHARS_EUR,
  }
}
