// Prompts Sonnet pour l'extraction structurelle des scènes pédagogiques
// (T5 — POC visualisation audio §6.2).
//
// Adaptation du prompt §6.2 spec POC au schéma Timeline post-T4 (cf. divergences
// recap T4 §6) :
//   - templates effectifs : flowchart (orientation), grid (columns), comparison,
//     causal (mode nodes+edges, max 5 nodes, edges référençant des id), figures
//     (avec emphasis), timeline (mode events at_label/text)
//   - cards : text ≤ 60 chars, subtitle ≤ 40 chars, variant 'highlight'/'warning'/'success'
//   - approche hybride spec décidée Q1 : Sonnet raisonne en `trigger_at_word_index`
//     (entier — fiable) + `display_duration_sec` (entier 20-45) ; le serveur
//     convertit en start_sec/end_sec AVANT validation Zod finale.
//
// Le prompt système est intentionnellement court : la consigne forte sur le
// format de sortie est dans le user prompt (avec le schéma TypeScript exact),
// car Sonnet 4.6 suit mieux les contraintes formelles quand elles sont près
// du contenu à traiter.

import type { Timeline } from './schema'

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const EXTRACTION_SYSTEM_PROMPT = `Tu es un agent qui transforme des scripts de podcast médical dentaire en
scènes pédagogiques visuelles structurées. Le script alterne deux voix :
Sophie (praticienne curieuse) et Martin (expert pédagogue).

Tu produis UNIQUEMENT du JSON valide, sans wrapper \`\`\`json, sans préambule,
sans commentaire. Le caller appliquera JSON.parse() directement sur ta réponse.`

// ---------------------------------------------------------------------------
// User prompt builder
// ---------------------------------------------------------------------------

/**
 * Construit le user prompt complet :
 *  - schéma TypeScript exact attendu en sortie
 *  - heuristiques pour le choix du template
 *  - 3 few-shot examples (succession d'étapes / classification / chiffres clés)
 *  - script_text complet entre marqueurs
 *  - transcript "aplati" word-by-word avec index global pour
 *    `trigger_at_word_index` et `at_word_index` (concept).
 */
export function buildFormationPrompt(
  scriptText: string,
  transcript: Timeline['transcript']
): string {
  const wordsBlock = renderWordsWithIndex(transcript)

  return `OBJECTIF
Identifie 3 à 5 PASSAGES STRUCTURELS du script où une visualisation
pédagogique enrichirait significativement la compréhension du praticien.

CONTRAINTES STRICTES
- Maximum 5 scènes, minimum 3 scènes
- Chaque scène doit durer 20-45 secondes audio (display_duration_sec)
- Espacement minimum 30 secondes entre 2 scènes successives
- PAS de scène sur les passages introductifs / conclusifs / transitions

POUR CHAQUE SCÈNE, RETOURNE UN JSON STRICT CONFORME AU SCHÉMA TYPESCRIPT :

type Scene = {
  id: string;                              // "scene-1", "scene-2", ...
  title: string;                           // 3-6 mots, sentence case
  trigger_at_word_index: number;           // index du mot dans le transcript ci-dessous
  display_duration_sec: number;            // entier 20-45
  pedagogical_intent: string;              // 1 phrase, debug
  template:
    | { kind: 'flowchart'; cards: CardContent[]; orientation?: 'horizontal' | 'vertical' }
    | { kind: 'grid'; columns: 2 | 3 | 4; cards: CardContent[] }
    | { kind: 'comparison'; left: { title: string; cards: CardContent[] }; right: { title: string; cards: CardContent[] } }
    | { kind: 'causal'; nodes: Array<CardContent & { id: string }>; edges: Array<{ from: string; to: string; label?: string }> }
    | { kind: 'figures'; figures: Array<{ value: string; label: string; emphasis?: boolean }> }
    | { kind: 'timeline'; events: Array<{ at_label: string; text: string }> };
};

type CardContent = {
  text: string;                            // ≤ 60 caractères, sentence case, sans point final
  subtitle?: string;                       // ≤ 40 caractères
  variant?: 'highlight' | 'warning' | 'success';
};

CHOIX DU TEMPLATE — Heuristique
- flowchart : succession d'étapes (max 5 cards), processus clinique, arbre diagnostic
- grid : classification, typologie, énumération de catégories (2-4 cards)
- comparison : opposition entre 2 options, avant/après, technique A vs B
- causal : relation de cause à effet, mécanisme physiopatho — 2 à 5 nodes,
           edges OBLIGATOIRES (from/to qui référencent des id de nodes existants)
- figures : mise en avant de chiffres clés (taux, durées, prévalence) — 1 à 3 items
- timeline : chronologie d'événements, étapes temporelles d'un protocole

CONTRAINTES SUR LES CARDS
- text : MAXIMUM 60 caractères, sentence case, sans point final
- subtitle : MAXIMUM 40 caractères, optionnel
- variant 'highlight' : pour le résultat / la conclusion / le diagnostic principal
- variant 'warning' : pour mises en garde, contre-indications
- variant 'success' : pour résolution, validation

CONCEPTS — Identifie 5 à 12 termes médicaux importants. Pour chaque terme :

type Concept = {
  term: string;                            // exactement comme prononcé
  definition: string;                      // 1-2 phrases, ton clinique pro, ≤ 300 chars
  at_word_index: number;                   // index du mot où le terme commence
  source?: string;                         // "Wikipédia" / "Larousse Médical" / "généré"
};

NE PAS inclure de termes triviaux (patient, dent, soin, traitement).
Privilégier termes anatomiques, syndromes, protocoles, instruments, acronymes,
classifications.

VOCABULAIRE
- Reste strictement dans le vocabulaire médical/dentaire utilisé par le formateur
- Ne PAS reformuler les termes techniques en langage simplifié
- Préserve l'orthographe exacte des noms de syndromes, instruments, classifications

FORMAT DE RÉPONSE
Retourne UNIQUEMENT cet objet JSON, sans wrapper, sans commentaire :

{
  "scenes": [...],   // 3 à 5 scènes
  "concepts": [...]  // 5 à 12 concepts
}

EXEMPLES (3 few-shots — formats représentatifs, pas à recopier littéralement)

[FEW-SHOT 1 — passage diagnostic dent fêlée → flowchart]
{
  "id": "scene-X",
  "title": "Diagnostic d'une dent fêlée",
  "trigger_at_word_index": 412,
  "display_duration_sec": 30,
  "pedagogical_intent": "Donner une checklist d'examen clinique séquentielle",
  "template": {
    "kind": "flowchart",
    "orientation": "horizontal",
    "cards": [
      { "text": "Test au mordu sur coton" },
      { "text": "Transillumination" },
      { "text": "Test au froid" },
      { "text": "Diagnostic confirmé", "variant": "highlight" }
    ]
  }
}

[FEW-SHOT 2 — passage classification ASA → grid]
{
  "id": "scene-X",
  "title": "Classification ASA simplifiée",
  "trigger_at_word_index": 815,
  "display_duration_sec": 25,
  "pedagogical_intent": "Visualiser les 4 niveaux de risque anesthésique",
  "template": {
    "kind": "grid",
    "columns": 2,
    "cards": [
      { "text": "ASA I — patient sain", "subtitle": "Aucun risque" },
      { "text": "ASA II — pathologie légère", "subtitle": "HTA contrôlée" },
      { "text": "ASA III — pathologie sévère", "subtitle": "Risque modéré", "variant": "warning" },
      { "text": "ASA IV — menace vitale", "subtitle": "Avis spécialisé", "variant": "warning" }
    ]
  }
}

[FEW-SHOT 3 — passage chiffres prévalence → figures]
{
  "id": "scene-X",
  "title": "Prévalence carie en France",
  "trigger_at_word_index": 1240,
  "display_duration_sec": 22,
  "pedagogical_intent": "Ancrer les ordres de grandeur épidémiologiques",
  "template": {
    "kind": "figures",
    "figures": [
      { "value": "33 %", "label": "enfants 6-12 ans", "emphasis": true },
      { "value": "92 %", "label": "adultes 35-44 ans" },
      { "value": "2,1", "label": "indice CAO moyen" }
    ]
  }
}

SCRIPT À TRAITER
---
${scriptText}
---

TRANSCRIPT AVEC INDEX MOTS (format : index|mot, un mot par ligne)
---
${wordsBlock}
---`
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Sérialise transcript.segments[].words[] en un tableau "index|mot" — un mot
 * par ligne — adapté pour qu'un LLM puisse pointer sur un index entier
 * (au lieu de tenter de calibrer un timestamp en secondes, ce qu'il fait mal).
 *
 * L'index global est strictement croissant et continu (0..N-1) — le caller
 * (buildTimelineFromRaw, T5.2) doit utiliser le MÊME flatten pour garantir
 * la cohérence de la lookup `at_word_index → start_sec`.
 */
function renderWordsWithIndex(transcript: Timeline['transcript']): string {
  if (!transcript || !transcript.segments?.length) return '(transcript vide)'
  const lines: string[] = []
  let idx = 0
  for (const segment of transcript.segments) {
    for (const word of segment.words ?? []) {
      lines.push(`${idx}|${word.text}`)
      idx++
    }
  }
  return lines.join('\n')
}
