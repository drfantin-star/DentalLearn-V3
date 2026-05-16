import type { DialogueInput } from './types'

// IDs voix ElevenLabs (Sophie/Martin, standard Dentalschool)
export const VOICE_IDS = {
  sophie: 't8BrjWUT5Z23DLLBzbuY',
  martin: 'ohItIVrXTBI80RrUECOD',
} as const

export type Speaker = keyof typeof VOICE_IDS

/**
 * Parse un script dialogue Sophie/Martin au format Dentalschool.
 * Réimplémentation TypeScript fidèle de parse_dialogue() Python (generate_audio.py Phase 2B).
 *
 * Format attendu :
 *   # commentaire (ignoré)
 *   Sophie: [curious] Texte de la réplique
 *
 *   Martin: [thoughtful] Texte de la réplique
 *
 * Règles :
 * - Lignes commençant par # ignorées
 * - Lignes vides ignorées
 * - Chaque réplique commence par "Sophie:" ou "Martin:" (case-insensitive)
 * - L'alternance Sophie/Martin n'est pas imposée (la validation est séparée)
 * - Les balises émotion ElevenLabs v3 ([excited], [concerned], etc.) sont préservées
 */
export function parseDialogueScript(_text: string): DialogueInput[] {
  throw new Error('Not implemented — Sprint 4 T2')
}

/**
 * Valide un script parsé.
 * Retourne la liste des erreurs (vide = valide).
 */
export function validateDialogue(_inputs: DialogueInput[]): string[] {
  throw new Error('Not implemented — Sprint 4 T2')
}
