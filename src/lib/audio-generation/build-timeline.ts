import type { GenerateAudioResult } from './types'

/**
 * Construit un objet Timeline JSON depuis les données d'alignment ElevenLabs.
 * Format de sortie : schéma Timeline v1.0 (cf. spec_poc_visualisation_audio_v1_0.md).
 *
 * Note : ce module sera aligné avec le format exact produit par le pipeline Python
 * (generate_audio_PHASE_2B.py) lors de T2.
 */
export function buildTimelineFromAlignment(
  _scriptText: string,
  _result: GenerateAudioResult,
  _audioUrl: string,
  _sourceType: 'formation_sequence' | 'news_synthesis',
  _sourceId: string
): Record<string, unknown> {
  throw new Error('Not implemented — Sprint 4 T2')
}
