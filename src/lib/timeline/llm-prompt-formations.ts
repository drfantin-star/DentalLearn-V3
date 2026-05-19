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
//     (entier — fiable) + `display_duration_sec` (entier 15-35) ; le serveur
//     convertit en start_sec/end_sec AVANT validation Zod finale.
//
// T5-bis (16 mai 2026) — densification timeline : cible 8-12 scènes par script
// (≥ 90 % couverture temporelle) au lieu de 3-5 scènes (32 % couverture mesurée
// sur séquence pilote "Communication non verbale"). Fenêtre display_duration
// resserrée à 15-35s et espacement min réduit à 15s.
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
Identifie 8 à 12 PASSAGES STRUCTURELS du script où une visualisation
pédagogique enrichirait significativement la compréhension du praticien.
La timeline doit être DENSE et couvrir l'essentiel du contenu pédagogique
(≥ 80 % de la durée audio totale, idéalement ~1 scène par minute d'audio).

CONTRAINTES STRICTES
- 8 à 12 scènes par script (proportionnel à la durée : ~1 scène par minute d'audio)
- Minimum 5 scènes, maximum 12 scènes
- Chaque scène doit durer 15-35 secondes audio (display_duration_sec, entier)
- Espacement minimum 15 secondes entre 2 scènes successives
- Couvrir au minimum 80 % de la durée totale du script
- Privilégier les passages avec : définitions cliniques, chiffres/statistiques,
  classifications, protocoles cliniques, comparaisons, mécanismes de cause à effet,
  étapes séquentielles, contre-indications, points de vigilance
- Tolérance limitée pour les passages introductifs / conclusifs / transitions :
  ne PAS visualiser si purement narratif ou rhétorique, MAIS visualiser dès qu'un
  élément structurel (annonce de plan structuré, récap synthétique) le permet

POUR CHAQUE SCÈNE, RETOURNE UN JSON STRICT CONFORME AU SCHÉMA TYPESCRIPT :

type Scene = {
  id: string;                              // "scene-1", "scene-2", ...
  title: string;                           // 3-6 mots, sentence case
  trigger_at_word_index: number;           // index du mot dans le transcript ci-dessous
  display_duration_sec: number;            // entier 15-35
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
  "scenes": [...],   // 8 à 12 scènes — DENSE, couvre ≥ 80 % du script
  "concepts": [...]  // 5 à 12 concepts
}

EXEMPLE COMPLET (timeline dense, 9 scènes réparties sur tout un script de ~9 min)
Format représentatif uniquement — ne PAS recopier les contenus, conserver la
structure JSON exacte (mêmes champs, mêmes \`kind\`). Noter la répartition :
~1 scène par minute, début/milieu/fin couverts.

[
  {
    "id": "scene-1",
    "title": "Trois piliers de l'examen clinique",
    "trigger_at_word_index": 52,
    "display_duration_sec": 25,
    "pedagogical_intent": "Annoncer la structure méthodologique de la séquence",
    "template": {
      "kind": "flowchart",
      "orientation": "horizontal",
      "cards": [
        { "text": "Anamnèse ciblée" },
        { "text": "Examen exobuccal" },
        { "text": "Examen endobuccal", "variant": "highlight" }
      ]
    }
  },
  {
    "id": "scene-2",
    "title": "Classification ASA simplifiée",
    "trigger_at_word_index": 285,
    "display_duration_sec": 30,
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
  },
  {
    "id": "scene-3",
    "title": "Diagnostic dent fêlée — checklist",
    "trigger_at_word_index": 520,
    "display_duration_sec": 28,
    "pedagogical_intent": "Séquencer l'examen clinique d'une fêlure suspectée",
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
  },
  {
    "id": "scene-4",
    "title": "Prévalence carie en France",
    "trigger_at_word_index": 780,
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
  },
  {
    "id": "scene-5",
    "title": "Composite vs amalgame",
    "trigger_at_word_index": 1020,
    "display_duration_sec": 30,
    "pedagogical_intent": "Comparer les deux matériaux de restauration directe",
    "template": {
      "kind": "comparison",
      "left": {
        "title": "Composite",
        "cards": [
          { "text": "Esthétique" },
          { "text": "Adhésif", "variant": "success" },
          { "text": "Sensible à l'humidité", "variant": "warning" }
        ]
      },
      "right": {
        "title": "Amalgame",
        "cards": [
          { "text": "Durabilité supérieure" },
          { "text": "Pose simple" },
          { "text": "Esthétique limitée", "variant": "warning" }
        ]
      }
    }
  },
  {
    "id": "scene-6",
    "title": "Cascade physiopatho de la carie",
    "trigger_at_word_index": 1310,
    "display_duration_sec": 32,
    "pedagogical_intent": "Mécanisme cause-effet de la déminéralisation",
    "template": {
      "kind": "causal",
      "nodes": [
        { "id": "n1", "text": "Plaque bactérienne" },
        { "id": "n2", "text": "Acides organiques" },
        { "id": "n3", "text": "Déminéralisation émail" },
        { "id": "n4", "text": "Cavitation", "variant": "warning" }
      ],
      "edges": [
        { "from": "n1", "to": "n2", "label": "métabolisme" },
        { "from": "n2", "to": "n3", "label": "pH < 5,5" },
        { "from": "n3", "to": "n4", "label": "perte tissulaire" }
      ]
    }
  },
  {
    "id": "scene-7",
    "title": "Protocole post-extraction",
    "trigger_at_word_index": 1580,
    "display_duration_sec": 28,
    "pedagogical_intent": "Chronologie des consignes au patient",
    "template": {
      "kind": "timeline",
      "events": [
        { "at_label": "J0", "text": "Mordre la compresse 1 h" },
        { "at_label": "J1", "text": "Bain de bouche tiède salé" },
        { "at_label": "J7", "text": "Retrait sutures si non résorbables" },
        { "at_label": "J21", "text": "Cicatrisation tissulaire complète" }
      ]
    }
  },
  {
    "id": "scene-8",
    "title": "Contre-indications biphosphonates",
    "trigger_at_word_index": 1820,
    "display_duration_sec": 26,
    "pedagogical_intent": "Mises en garde clés avant chirurgie",
    "template": {
      "kind": "grid",
      "columns": 2,
      "cards": [
        { "text": "Voie IV récente", "variant": "warning" },
        { "text": "Cancer ostéolytique", "variant": "warning" },
        { "text": "Voie orale > 4 ans", "subtitle": "Risque ONJ" },
        { "text": "Avis oncologue requis", "variant": "highlight" }
      ]
    }
  },
  {
    "id": "scene-9",
    "title": "Trois points à retenir",
    "trigger_at_word_index": 2050,
    "display_duration_sec": 24,
    "pedagogical_intent": "Synthèse mémorisable en fin de séquence",
    "template": {
      "kind": "flowchart",
      "orientation": "vertical",
      "cards": [
        { "text": "Anamnèse avant tout geste" },
        { "text": "ASA III = vigilance accrue", "variant": "warning" },
        { "text": "Documenter chaque décision", "variant": "highlight" }
      ]
    }
  }
]

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
// Variante approx_sec (§1 handoff 19 mai 2026)
// ---------------------------------------------------------------------------

/**
 * Variante du prompt utilisée quand on n'a PAS de transcript word-level
 * (séquence dashboard sans alignment ElevenLabs — D-S4-T5dette-02).
 *
 * Sonnet positionne les scènes via `trigger_at_sec` (float, secondes) qu'il
 * estime proportionnellement à la position du passage dans le script. Idem
 * pour les concepts via `at_sec`. La précision attendue est de l'ordre de
 * la dizaine de secondes — la timeline est étiquetée "approximative" côté
 * UI admin.
 */
export function buildFormationPromptApprox(
  scriptText: string,
  durationSec: number
): string {
  // Arrondi durée pour le prompt — Sonnet n'a pas besoin de la précision
  // au centième et un entier est plus stable dans son raisonnement.
  const durationLabel = Math.round(durationSec)

  return `OBJECTIF
Identifie 8 à 12 PASSAGES STRUCTURELS du script où une visualisation
pédagogique enrichirait significativement la compréhension du praticien.
La timeline doit être DENSE et couvrir l'essentiel du contenu pédagogique
(≥ 80 % de la durée audio totale, idéalement ~1 scène par minute d'audio).

DURÉE TOTALE DE L'AUDIO : ${durationLabel} secondes
Tu dois positionner chaque scène via \`trigger_at_sec\` (float, secondes,
0 ≤ trigger_at_sec ≤ ${durationLabel}, 2 décimales max). Estime
\`trigger_at_sec\` proportionnellement à la position du passage dans le
script : début du script ≈ 0, fin du script ≈ ${durationLabel}.

CONTRAINTES STRICTES
- 8 à 12 scènes par script (proportionnel à la durée : ~1 scène par minute d'audio)
- Minimum 5 scènes, maximum 12 scènes
- Chaque scène doit durer 15-35 secondes audio (display_duration_sec, entier)
- Espacement minimum 15 secondes entre 2 scènes successives
- Couvrir au minimum 80 % de la durée totale du script
- Privilégier les passages avec : définitions cliniques, chiffres/statistiques,
  classifications, protocoles cliniques, comparaisons, mécanismes de cause à effet,
  étapes séquentielles, contre-indications, points de vigilance
- Tolérance limitée pour les passages introductifs / conclusifs / transitions :
  ne PAS visualiser si purement narratif ou rhétorique, MAIS visualiser dès qu'un
  élément structurel (annonce de plan structuré, récap synthétique) le permet

POUR CHAQUE SCÈNE, RETOURNE UN JSON STRICT CONFORME AU SCHÉMA TYPESCRIPT :

type Scene = {
  id: string;                              // "scene-1", "scene-2", ...
  title: string;                           // 3-6 mots, sentence case
  trigger_at_sec: number;                  // float secondes, 0..${durationLabel}
  display_duration_sec: number;            // entier 15-35
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
  at_sec: number;                          // float secondes, 0..${durationLabel}
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
  "scenes": [...],   // 8 à 12 scènes — DENSE, couvre ≥ 80 % du script
  "concepts": [...]  // 5 à 12 concepts
}

EXEMPLE COMPLET (timeline dense, 9 scènes réparties sur tout un script ~9 min)
Format représentatif uniquement — ne PAS recopier les contenus, conserver la
structure JSON exacte (mêmes champs, mêmes \`kind\`). Noter la répartition :
~1 scène par minute, début/milieu/fin couverts. Les valeurs \`trigger_at_sec\`
ci-dessous correspondent à un audio de ~540 s — adapte-les proportionnellement
à ${durationLabel} s.

[
  {
    "id": "scene-1",
    "title": "Trois piliers de l'examen clinique",
    "trigger_at_sec": 18.5,
    "display_duration_sec": 25,
    "pedagogical_intent": "Annoncer la structure méthodologique de la séquence",
    "template": {
      "kind": "flowchart",
      "orientation": "horizontal",
      "cards": [
        { "text": "Anamnèse ciblée" },
        { "text": "Examen exobuccal" },
        { "text": "Examen endobuccal", "variant": "highlight" }
      ]
    }
  },
  {
    "id": "scene-2",
    "title": "Classification ASA simplifiée",
    "trigger_at_sec": 78.0,
    "display_duration_sec": 30,
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
  },
  {
    "id": "scene-3",
    "title": "Prévalence carie en France",
    "trigger_at_sec": 215.0,
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
  },
  {
    "id": "scene-4",
    "title": "Cascade physiopatho de la carie",
    "trigger_at_sec": 360.0,
    "display_duration_sec": 32,
    "pedagogical_intent": "Mécanisme cause-effet de la déminéralisation",
    "template": {
      "kind": "causal",
      "nodes": [
        { "id": "n1", "text": "Plaque bactérienne" },
        { "id": "n2", "text": "Acides organiques" },
        { "id": "n3", "text": "Déminéralisation émail" },
        { "id": "n4", "text": "Cavitation", "variant": "warning" }
      ],
      "edges": [
        { "from": "n1", "to": "n2", "label": "métabolisme" },
        { "from": "n2", "to": "n3", "label": "pH < 5,5" },
        { "from": "n3", "to": "n4", "label": "perte tissulaire" }
      ]
    }
  },
  {
    "id": "scene-5",
    "title": "Trois points à retenir",
    "trigger_at_sec": 510.0,
    "display_duration_sec": 24,
    "pedagogical_intent": "Synthèse mémorisable en fin de séquence",
    "template": {
      "kind": "flowchart",
      "orientation": "vertical",
      "cards": [
        { "text": "Anamnèse avant tout geste" },
        { "text": "ASA III = vigilance accrue", "variant": "warning" },
        { "text": "Documenter chaque décision", "variant": "highlight" }
      ]
    }
  }
]

SCRIPT À TRAITER
---
${scriptText}
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
