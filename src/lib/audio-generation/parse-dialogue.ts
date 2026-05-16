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

/**
 * Parse un script dialogue Sophie/Martin au format Dentalschool.
 * Réimplémentation TypeScript fidèle de parse_dialogue() Python (generate_audio_PHASE_2B.py).
 */
export function parseDialogueScript(text: string): DialogueInput[] {
  if (!text) return []

  const out: DialogueInput[] = []
  const lines = text.split(/\r?\n/)

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

    out.push({
      voice_id: VOICE_IDS[speaker],
      text: replyText,
      speaker,
    })
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

  const hasEmpty = inputs.some((i) => i.text.trim().length === 0)
  if (hasEmpty) {
    errors.push('Une ou plusieurs répliques ont un texte vide.')
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
