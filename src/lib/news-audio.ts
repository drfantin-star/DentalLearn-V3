// src/lib/news-audio.ts
//
// Helpers de génération + validation de scripts pour les épisodes News Insight.
// Aucune dépendance Anthropic / ElevenLabs ici — module pur (calculs, prompts,
// validation), réutilisable côté API routes et tests.

// ---------------------------------------------------------------------------
// 1. Cible mots / durée
// ---------------------------------------------------------------------------

/**
 * Mots cible en fonction de la durée demandée (150 mots/min).
 *   3 min → 450, 5 min → 750, 8 min → 1200, 12 min → 1800.
 *
 * Toute valeur hors {3,5,8,12} retombe sur le calcul linéaire 150 mots/min,
 * mais la CHECK PostgreSQL (news_episodes_target_duration_min_check) interdit
 * déjà ces valeurs côté BDD — sécurité défensive.
 */
export function calcTargetWords(target_duration_min: number): number {
  return Math.round(target_duration_min * 150)
}

// ---------------------------------------------------------------------------
// 2. Prompt builder
// ---------------------------------------------------------------------------

export type ScriptFormat = 'dialogue' | 'monologue'
export type ScriptNarrator = 'sophie' | 'martin'
export type EditorialTone =
  | 'standard'
  | 'flash_urgence'
  | 'pedagogique'
  | 'focus_specialite'

export interface BuildScriptPromptParams {
  display_title: string
  summary_fr: string
  specialites_tags: string[]
  niveau_preuve: string
  source_title: string
  source_authors: string
  source_year: number
  format: ScriptFormat
  narrator: ScriptNarrator | null
  target_duration_min: number
  editorial_tone: EditorialTone
}

const TONE_INSTRUCTIONS: Record<EditorialTone, string> = {
  standard:
    'Ton normal, professionnel, équilibré entre rigueur scientifique et accessibilité.',
  flash_urgence:
    'Rythme rapide, résultats clés en premier, phrases courtes. Annonce immédiate du chiffre marquant dès la première réplique.',
  pedagogique:
    'Vulgarisation maximale, ralenti. Définis chaque terme technique avant de l\'utiliser. Multiplie les analogies cliniques.',
  focus_specialite:
    'Vocabulaire expert assumé, données techniques complètes (intervalles de confiance, méthodologie, limites). Pas de vulgarisation.',
}

/**
 * Construit le prompt système Anthropic pour la génération du script.
 * Format de sortie strict : chaque ligne non vide commence par "Sophie:" ou
 * "Martin:" suivi du texte (avec audio_tags optionnels entre crochets).
 *
 * `abstract` (optionnel) : abstract source de news_raw, injecté comme
 * contexte scientifique complémentaire si non vide (>50 chars).
 * `editorialNotes` (optionnel) : notes éditorial libre saisies par l'admin,
 * injectées comme directives prioritaires si non vides.
 */
export function buildScriptPrompt(
  params: BuildScriptPromptParams,
  abstract?: string,
  editorialNotes?: string,
): string {
  const {
    display_title,
    summary_fr,
    specialites_tags,
    niveau_preuve,
    source_title,
    source_authors,
    source_year,
    format,
    narrator,
    target_duration_min,
    editorial_tone,
  } = params

  const targetWords = calcTargetWords(target_duration_min)
  const toneLine = TONE_INSTRUCTIONS[editorial_tone]
  const tagsList = specialites_tags.length > 0
    ? specialites_tags.join(', ')
    : '(aucune spécialité taguée)'

  const sourceBlock = [
    `Titre étudié : ${display_title}`,
    `Source : ${source_title} — ${source_authors} (${source_year})`,
    `Niveau de preuve : ${niveau_preuve}`,
    `Spécialités : ${tagsList}`,
    '',
    'Synthèse de référence (à utiliser comme matériau exclusif) :',
    summary_fr,
  ].join('\n')

  const contextBlocks: string[] = []
  if (abstract && abstract.trim().length > 50) {
    contextBlocks.push(
      '',
      '## Abstract source (contexte scientifique complémentaire)',
      abstract.trim(),
    )
  }
  if (editorialNotes && editorialNotes.trim().length > 0) {
    contextBlocks.push(
      '',
      '## Notes éditorial (points à développer impérativement)',
      editorialNotes.trim(),
    )
  }

  if (format === 'dialogue') {
    return [
      `Tu es co-auteur d'un podcast dentaire animé par Dr Sophie (praticienne curieuse 5-10 ans XP, pose les questions du praticien) et Dr Martin (expert 20+ ans, donne chiffres et analyse). Ton confraternel, professionnel, tutoiement entre Sophie et Martin.`,
      ``,
      `Format de sortie strict :`,
      `Sophie: [audio_tag] Texte`,
      `Martin: [audio_tag] Texte`,
      ``,
      `Audio tags disponibles : [curious], [excited], [concerned], [impressed], [reassuring], [explaining], [serious], [enthusiastic], [laughs], [sighs], [pause], [pause-short]. Max 1 tag toutes 2-3 répliques.`,
      ``,
      `Cible : ${targetWords} mots ± 10%.`,
      `Cite systématiquement : auteurs + journal + année.`,
      `Interdiction absolue d'inventer une donnée.`,
      ``,
      `Adaptation du ton (${editorial_tone}) : ${toneLine}`,
      ``,
      `--- MATÉRIAU ---`,
      sourceBlock,
      ...contextBlocks,
    ].join('\n')
  }

  // monologue
  const speakerLabel = narrator === 'sophie' ? 'Sophie' : 'Martin'
  const speakerStyle = narrator === 'sophie'
    ? 'Style Sophie : curieux, accessible, pose les questions du praticien et y répond.'
    : 'Style Martin : expert, didactique, donne directement les chiffres et l\'analyse.'

  return [
    `Tu es ${speakerLabel}, animateur unique d'un podcast dentaire (format monologue). ${speakerStyle}`,
    ``,
    `Format de sortie strict : chaque ligne non vide commence par "${speakerLabel}: " suivi du texte (avec audio_tags optionnels entre crochets). Une seule voix sur tout le script — n'introduis jamais l'autre personnage.`,
    ``,
    `Audio tags disponibles : [curious], [excited], [concerned], [impressed], [reassuring], [explaining], [serious], [enthusiastic], [laughs], [sighs], [pause], [pause-short]. Max 1 tag toutes 2-3 répliques.`,
    ``,
    `Cible : ${targetWords} mots ± 10%.`,
    `Cite systématiquement : auteurs + journal + année.`,
    `Interdiction absolue d'inventer une donnée.`,
    ``,
    `Adaptation du ton (${editorial_tone}) : ${toneLine}`,
    ``,
    `--- MATÉRIAU ---`,
    sourceBlock,
    ...contextBlocks,
  ].join('\n')
}

// ---------------------------------------------------------------------------
// 3. Validation de format
// ---------------------------------------------------------------------------

const SPEAKER_LINE_RE = /^(Sophie|Martin):\s+.+$/

export interface ScriptValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Vérifie qu'un script LLM respecte le format Sophie:/Martin: ligne par ligne.
 *
 *   - Chaque ligne non vide doit commencer par "Sophie: " ou "Martin: "
 *   - En monologue : seul le narrateur retenu peut parler
 *   - Au moins 10 répliques (sinon script trop court → invalide)
 *
 * Renvoie un agrégat d'erreurs (pas d'arrêt à la 1re erreur — l'admin
 * peut tout voir et décider de relancer ou éditer manuellement).
 */
export function validateScriptFormat(
  script: string,
  format: ScriptFormat,
  narrator?: ScriptNarrator,
): ScriptValidationResult {
  const errors: string[] = []

  if (!script || typeof script !== 'string') {
    return { valid: false, errors: ['Script vide ou invalide'] }
  }

  const rawLines = script.split('\n')
  const meaningfulLines = rawLines
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (meaningfulLines.length === 0) {
    return { valid: false, errors: ['Script sans ligne exploitable'] }
  }

  let speakerLines = 0
  const malformed: number[] = []
  const wrongSpeakerInMonologue: number[] = []
  const expectedMonologueSpeaker =
    narrator === 'sophie' ? 'Sophie' : narrator === 'martin' ? 'Martin' : null

  rawLines.forEach((rawLine, idx) => {
    const line = rawLine.trim()
    if (line.length === 0) return
    if (!SPEAKER_LINE_RE.test(line)) {
      malformed.push(idx + 1)
      return
    }
    speakerLines++
    if (format === 'monologue' && expectedMonologueSpeaker) {
      const actual = line.startsWith('Sophie:') ? 'Sophie' : 'Martin'
      if (actual !== expectedMonologueSpeaker) {
        wrongSpeakerInMonologue.push(idx + 1)
      }
    }
  })

  if (malformed.length > 0) {
    errors.push(
      `Lignes mal formatées (attendu "Sophie: ..." ou "Martin: ...") : lignes ${malformed.slice(0, 10).join(', ')}${malformed.length > 10 ? `… (+${malformed.length - 10} autres)` : ''}`,
    )
  }

  if (format === 'monologue' && wrongSpeakerInMonologue.length > 0) {
    errors.push(
      `Format monologue (${narrator}) mais lignes attribuées à l'autre voix : lignes ${wrongSpeakerInMonologue.slice(0, 10).join(', ')}${wrongSpeakerInMonologue.length > 10 ? '…' : ''}`,
    )
  }

  if (speakerLines < 10) {
    errors.push(
      `Script trop court (${speakerLines} répliques détectées, minimum 10).`,
    )
  }

  return { valid: errors.length === 0, errors }
}
