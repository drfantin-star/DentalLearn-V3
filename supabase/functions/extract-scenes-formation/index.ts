// Edge Function : extract-scenes-formation
//
// T5-bis-B (POC visualisation audio — pattern fire-and-forget). Déclenchée
// par la route Vercel POST /api/admin/timeline/extract-scenes, qui crée d'abord
// un job en BDD puis fire ce worker sans attendre la fin. Ce worker s'exécute
// jusqu'à ~150 s (IDLE_TIMEOUT Supabase Edge Function) — largement suffisant
// pour les 30-45 s d'appel Sonnet T5-bis. La page admin polle ensuite
// /api/admin/timeline/extract-scenes/status?jobId=… pour récupérer le résultat.
//
// Flow (idempotent au mieux côté status, pas côté Storage) :
//   1. Auth Bearer service_role_key (req depuis la route Vercel)
//   2. Parse body { job_id, sequence_id }
//   3. UPDATE audio_generation_jobs → status='running' immédiatement
//   4. SELECT sequences.timeline_url
//   5. fetch(timeline_url) → JSON (transcript + audio_url + duration_sec)
//   6. Reconstitue script_text : segments.map(s => `${s.speaker.toUpperCase()}: ${s.text}`)
//   7. Appel Anthropic (sonnet-4-6, max_tokens=4096, temperature=0)
//   8. parseJsonFromText → { scenes, concepts }
//   9. Validation structure basique (deux arrays)
//   10. Conversion word_index → start_sec via lookup transcript (mêmes règles
//       que buildTimelineFromRaw côté TS : clamp [15,35]s, fallback proportionnel,
//       génération id scènes/concepts/chapters)
//   11. Upload bucket audio-timelines/poc/{sequence_id}-{ISO}.json
//   12. UPDATE sequences.timeline_url = publicUrl
//   13. UPDATE job → completed + metadata
//
// En cas d'erreur : UPDATE job → failed + error_log structuré. La route
// Vercel ne voit jamais ces erreurs directement (fire-and-forget) — elles
// sont surfacées au client via le polling endpoint.
//
// Le prompt buildFormationPrompt est INLINÉ ici (~250 lignes). Toute itération
// future (T5-ter, etc.) doit modifier simultanément les deux copies :
//   - src/lib/timeline/llm-prompt-formations.ts (chemin dry_run local)
//   - supabase/functions/extract-scenes-formation/index.ts (production async)
// Drift documenté et accepté en T5-bis-B (cf. CLAUDE.md "Vercel Pro
// dependencies" + rapport STOP fix3).

import { getServiceClient } from "../_shared/supabase.ts";
import { Logger } from "../_shared/logger.ts";
import {
  AnthropicClient,
  extractTextContent,
  parseJsonFromText,
} from "../_shared/anthropic.ts";

const logger = new Logger("extract-scenes-formation");

// ---------------------------------------------------------------------------
// Constantes — alignées sur src/lib/timeline/llm-extraction.ts (T5-bis)
// ---------------------------------------------------------------------------

const SONNET_MODEL = "claude-sonnet-4-6";
const MAX_OUTPUT_TOKENS = 4096;
const TIMELINE_STORAGE_BUCKET = "audio-timelines";
const TIMELINE_STORAGE_PREFIX = "poc";

// Bornes display_duration_sec (T5-bis) — clamping défensif côté worker.
const MIN_DURATION_SEC = 15;
const MAX_DURATION_SEC = 35;
// Cap dur scènes — prompt instruit 8-12, plafond défensif si dérive.
const MAX_SCENES = 15;
// Durée d'affichage par défaut d'un concept (alignée llm-extraction.ts:67).
const CONCEPT_HIGHLIGHT_DURATION_SEC = 4;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RequestBody {
  job_id: string;
  sequence_id: string;
}

interface TranscriptWord {
  start_sec: number;
  end_sec: number;
  text: string;
}

interface TranscriptSegment {
  start_sec: number;
  end_sec: number;
  speaker: "sophie" | "martin";
  text: string;
  words: TranscriptWord[];
}

interface Transcript {
  segments: TranscriptSegment[];
}

interface TimelineJson {
  audio_url: string;
  duration_sec: number;
  transcript: Transcript;
}

interface RawScene {
  id?: string;
  title: string;
  trigger_at_word_index: number;
  display_duration_sec: number;
  pedagogical_intent?: string;
  template: unknown;
}

interface RawConcept {
  term: string;
  definition: string;
  at_word_index: number;
  source?: string;
}

interface RawExtraction {
  scenes: RawScene[];
  concepts: RawConcept[];
}

// ---------------------------------------------------------------------------
// Prompts — copie miroir de src/lib/timeline/llm-prompt-formations.ts (T5-bis).
// ⚠️ Toute modif ici doit être appliquée à l'identique côté TS.
// ---------------------------------------------------------------------------

const EXTRACTION_SYSTEM_PROMPT =
  `Tu es un agent qui transforme des scripts de podcast médical dentaire en
scènes pédagogiques visuelles structurées. Le script alterne deux voix :
Sophie (praticienne curieuse) et Martin (expert pédagogue).

Tu produis UNIQUEMENT du JSON valide, sans wrapper \`\`\`json, sans préambule,
sans commentaire. Le caller appliquera JSON.parse() directement sur ta réponse.`;

function renderWordsWithIndex(transcript: Transcript): string {
  if (!transcript || !transcript.segments?.length) return "(transcript vide)";
  const lines: string[] = [];
  let idx = 0;
  for (const segment of transcript.segments) {
    for (const word of segment.words ?? []) {
      lines.push(`${idx}|${word.text}`);
      idx++;
    }
  }
  return lines.join("\n");
}

function buildFormationPrompt(
  scriptText: string,
  transcript: Transcript,
): string {
  const wordsBlock = renderWordsWithIndex(transcript);
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
---`;
}

// ---------------------------------------------------------------------------
// Helpers — conversion raw → Timeline shape (parité partielle avec
// buildTimelineFromRaw côté TS, sans validation Zod stricte).
// ---------------------------------------------------------------------------

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function flattenWords(transcript: Transcript): TranscriptWord[] {
  const out: TranscriptWord[] = [];
  for (const seg of transcript.segments ?? []) {
    for (const w of seg.words ?? []) out.push(w);
  }
  return out;
}

function makeWordIndexLookup(
  transcript: Transcript,
): (idx: number) => number | null {
  const flat = flattenWords(transcript);
  return (idx: number) => {
    if (!Number.isInteger(idx) || idx < 0 || idx >= flat.length) return null;
    return flat[idx].start_sec;
  };
}

function generateConceptId(): string {
  if (typeof crypto?.randomUUID === "function") return crypto.randomUUID();
  return `concept-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface BuildResult {
  timeline: Record<string, unknown>;
  warnings: string[];
  scenes_count: number;
  concepts_count: number;
}

function buildTimelineFromRaw(
  raw: RawExtraction,
  transcript: Transcript,
  sequenceId: string,
  audioUrl: string,
  durationSec: number,
): BuildResult {
  const warnings: string[] = [];
  const lookup = makeWordIndexLookup(transcript);

  const sourceScenes = raw.scenes ?? [];
  let scenes = sourceScenes;
  if (sourceScenes.length > MAX_SCENES) {
    scenes = sourceScenes.slice(0, MAX_SCENES);
    warnings.push(`scenes_truncated:${sourceScenes.length}->${MAX_SCENES}`);
  }

  const usedIds = new Set<string>();
  const convertedScenes = scenes.map((scene, index) => {
    const fallbackId = `scene-${index + 1}`;
    let safeId = typeof scene.id === "string" && scene.id.trim().length > 0
      ? scene.id.trim()
      : fallbackId;
    if (usedIds.has(safeId)) safeId = fallbackId;
    usedIds.add(safeId);

    let startSec = lookup(scene.trigger_at_word_index);
    if (startSec === null) {
      startSec = scenes.length > 0
        ? (index * durationSec) / scenes.length
        : 0;
      warnings.push(`word_index_out_of_bounds:${safeId}`);
    }

    const rawDuration = Number(scene.display_duration_sec ?? MIN_DURATION_SEC);
    let duration = Number.isFinite(rawDuration) ? rawDuration : MIN_DURATION_SEC;
    if (duration < MIN_DURATION_SEC || duration > MAX_DURATION_SEC) {
      duration = clamp(duration, MIN_DURATION_SEC, MAX_DURATION_SEC);
      warnings.push(`duration_clamped:${safeId}`);
    }

    return {
      id: safeId,
      title: typeof scene.title === "string" ? scene.title : safeId,
      start_sec: startSec,
      end_sec: Math.min(startSec + duration, durationSec),
      template: scene.template,
      ...(scene.pedagogical_intent
        ? { pedagogical_intent: scene.pedagogical_intent }
        : {}),
    };
  });

  const sourceConcepts = raw.concepts ?? [];
  const convertedConcepts = sourceConcepts.map((c, index) => {
    let atSec = lookup(c.at_word_index);
    if (atSec === null) {
      atSec = 0;
      warnings.push(
        `concept_word_index_out_of_bounds:${c.term ?? `idx-${index}`}`,
      );
    }
    const label = (c.term ?? "").trim() || `concept-${index + 1}`;
    const definition = typeof c.definition === "string"
      ? c.definition.length > 300
        ? c.definition.slice(0, 297) + "..."
        : c.definition
      : "";
    return {
      id: generateConceptId(),
      label,
      start_sec: atSec,
      end_sec: Math.min(atSec + CONCEPT_HIGHLIGHT_DURATION_SEC, durationSec),
      term: c.term,
      definition,
      at_sec: atSec,
      at_word_index: c.at_word_index,
      ...(c.source ? { source: c.source } : {}),
    };
  });

  const chapters = convertedScenes
    .slice()
    .sort((a, b) => a.start_sec - b.start_sec)
    .map((s, idx) => ({
      id: `chapter-${idx + 1}`,
      title: s.title,
      start_sec: s.start_sec,
      end_sec: s.end_sec,
    }));

  return {
    timeline: {
      schema_version: "1.0",
      source_type: "formation_sequence",
      source_id: sequenceId,
      audio_url: audioUrl,
      duration_sec: durationSec,
      generated_at: new Date().toISOString(),
      generator: "auto_llm_extraction",
      transcript,
      scenes: convertedScenes,
      concepts: convertedConcepts,
      chapters,
    },
    warnings,
    scenes_count: convertedScenes.length,
    concepts_count: convertedConcepts.length,
  };
}

// ---------------------------------------------------------------------------
// Job status helpers (UPDATE direct via service_role)
// ---------------------------------------------------------------------------

async function markJobRunning(jobId: string): Promise<void> {
  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("audio_generation_jobs")
    .update({ status: "running", started_at: nowIso, updated_at: nowIso })
    .eq("id", jobId);
  if (error) {
    logger.warn("job_running_update_failed", { job_id: jobId, error: error.message });
  }
}

async function markJobCompleted(
  jobId: string,
  meta: {
    timeline_url: string;
    duration_sec: number;
    scenes_count: number;
    concepts_count: number;
    duration_ms: number;
    tokens_input: number;
    tokens_output: number;
    warnings: string[];
  },
): Promise<void> {
  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("audio_generation_jobs")
    .update({
      status: "completed",
      completed_at: nowIso,
      updated_at: nowIso,
      timeline_url: meta.timeline_url,
      duration_sec: meta.duration_sec,
      error_log: {
        // On loggue les warnings + meta dans error_log (champ jsonb existant) :
        // pas idéal sémantiquement mais évite d'ajouter une colonne juste pour
        // ça. Le UI lit ces métadonnées via le polling endpoint.
        message: "scene_extraction_completed",
        timestamp: nowIso,
        scenes_count: meta.scenes_count,
        concepts_count: meta.concepts_count,
        duration_ms: meta.duration_ms,
        tokens_input: meta.tokens_input,
        tokens_output: meta.tokens_output,
        warnings: meta.warnings,
      },
    })
    .eq("id", jobId);
  if (error) {
    logger.warn("job_completed_update_failed", { job_id: jobId, error: error.message });
  }
}

async function markJobFailed(jobId: string, message: string): Promise<void> {
  const supabase = getServiceClient();
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from("audio_generation_jobs")
    .update({
      status: "failed",
      completed_at: nowIso,
      updated_at: nowIso,
      error_log: { message, timestamp: nowIso },
    })
    .eq("id", jobId);
  if (error) {
    logger.error("job_failed_update_failed", { job_id: jobId, error: error.message });
  }
}

// ---------------------------------------------------------------------------
// Run principal
// ---------------------------------------------------------------------------

async function runExtraction(jobId: string, sequenceId: string): Promise<void> {
  const startedAt = performance.now();
  await markJobRunning(jobId);

  const supabase = getServiceClient();

  // 1. Lire sequences.timeline_url
  const { data: seqRow, error: seqErr } = await supabase
    .from("sequences")
    .select("id, timeline_url")
    .eq("id", sequenceId)
    .maybeSingle();
  if (seqErr) throw new Error(`sequences read failed: ${seqErr.message}`);
  if (!seqRow) throw new Error(`sequence ${sequenceId} not found`);
  if (!seqRow.timeline_url) {
    throw new Error(
      "sequences.timeline_url is null — run T2 (Python pipeline) first.",
    );
  }

  // 2. Fetch timeline_url
  const resp = await fetch(seqRow.timeline_url, {
    headers: { "cache-control": "no-store" },
  });
  if (!resp.ok) {
    throw new Error(`timeline_url fetch failed (HTTP ${resp.status})`);
  }
  const tlJson = (await resp.json()) as TimelineJson;
  if (
    !tlJson || typeof tlJson !== "object" ||
    typeof tlJson.audio_url !== "string" ||
    typeof tlJson.duration_sec !== "number" ||
    !tlJson.transcript || !Array.isArray(tlJson.transcript.segments)
  ) {
    throw new Error(
      "timeline JSON missing required fields (audio_url / duration_sec / transcript.segments)",
    );
  }

  // 3. Reconstitue script_text
  const scriptText = tlJson.transcript.segments
    .map((s) => `${s.speaker.toUpperCase()}: ${s.text}`)
    .join("\n\n")
    .trim();
  if (scriptText.length < 50) {
    throw new Error("reconstructed script_text too short (< 50 chars)");
  }

  // 4. Appel Anthropic
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY env var missing");

  const client = new AnthropicClient({
    apiKey: anthropicKey,
    maxRetries: 2,
    timeoutMs: 90_000,
  });

  const response = await client.messages({
    model: SONNET_MODEL,
    system: EXTRACTION_SYSTEM_PROMPT,
    max_tokens: MAX_OUTPUT_TOKENS,
    temperature: 0,
    messages: [
      { role: "user", content: buildFormationPrompt(scriptText, tlJson.transcript) },
    ],
  });
  const sonnetText = extractTextContent(response);
  if (!sonnetText || !sonnetText.trim()) {
    throw new Error("Sonnet returned empty response");
  }

  // 5. Parse JSON
  const parsed = parseJsonFromText<RawExtraction>(sonnetText);
  if (!parsed) throw new Error("could not parse JSON from Sonnet output");
  if (!Array.isArray(parsed.scenes)) {
    throw new Error("Sonnet output missing scenes[] array");
  }
  if (!Array.isArray(parsed.concepts)) {
    throw new Error("Sonnet output missing concepts[] array");
  }

  // 6. Build Timeline shape (word_index → sec, clamp, ids, chapters)
  const built = buildTimelineFromRaw(
    parsed,
    tlJson.transcript,
    sequenceId,
    tlJson.audio_url,
    tlJson.duration_sec,
  );

  // 7. Upload Storage
  const isoStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const storagePath = `${TIMELINE_STORAGE_PREFIX}/${sequenceId}-${isoStamp}.json`;
  const bodyBytes = new TextEncoder().encode(
    JSON.stringify(built.timeline, null, 2),
  );

  const { error: uploadErr } = await supabase.storage
    .from(TIMELINE_STORAGE_BUCKET)
    .upload(storagePath, bodyBytes, {
      contentType: "application/json",
      cacheControl: "0",
      upsert: false,
    });
  if (uploadErr) {
    throw new Error(`storage upload failed: ${uploadErr.message}`);
  }

  const { data: pub } = supabase.storage
    .from(TIMELINE_STORAGE_BUCKET)
    .getPublicUrl(storagePath);
  const publicUrl = pub?.publicUrl ?? null;
  if (!publicUrl) {
    throw new Error("getPublicUrl returned no url");
  }

  // 8. UPDATE sequences.timeline_url
  const { error: updErr } = await supabase
    .from("sequences")
    .update({ timeline_url: publicUrl })
    .eq("id", sequenceId);
  if (updErr) {
    throw new Error(`sequences update failed: ${updErr.message}`);
  }

  // 9. UPDATE job → completed
  const durationMs = Math.round(performance.now() - startedAt);
  await markJobCompleted(jobId, {
    timeline_url: publicUrl,
    duration_sec: tlJson.duration_sec,
    scenes_count: built.scenes_count,
    concepts_count: built.concepts_count,
    duration_ms: durationMs,
    tokens_input: response.usage?.input_tokens ?? 0,
    tokens_output: response.usage?.output_tokens ?? 0,
    warnings: built.warnings,
  });

  logger.info("extraction_succeeded", {
    job_id: jobId,
    sequence_id: sequenceId,
    duration_ms: durationMs,
    scenes_count: built.scenes_count,
    concepts_count: built.concepts_count,
    tokens_input: response.usage?.input_tokens ?? 0,
    tokens_output: response.usage?.output_tokens ?? 0,
  });
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey || auth !== `Bearer ${serviceKey}`) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return new Response(
      JSON.stringify({ error: "invalid_json" }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }
  if (
    !body || typeof body.job_id !== "string" || body.job_id.length === 0 ||
    typeof body.sequence_id !== "string" || body.sequence_id.length === 0
  ) {
    return new Response(
      JSON.stringify({
        error: "invalid_body",
        message: "job_id and sequence_id are required strings",
      }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  // Lance l'extraction en background et renvoie 202 immédiatement.
  // EdgeRuntime.waitUntil() est le pattern documenté Supabase Edge Functions
  // pour garder l'isolate vivant après la réponse HTTP, jusqu'à IDLE_TIMEOUT
  // (~150 s) ou jusqu'à ce que la promise soit résolue.
  // cf. https://supabase.com/docs/guides/functions/background-tasks
  const work = (async () => {
    try {
      await runExtraction(body.job_id, body.sequence_id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logger.error("extraction_failed", {
        job_id: body.job_id,
        sequence_id: body.sequence_id,
        error: msg,
      });
      await markJobFailed(body.job_id, msg);
    }
  })();

  // @ts-ignore — EdgeRuntime est injecté par le runtime Supabase et n'est
  // pas typé dans Deno standard. Fallback silencieux si absent (dev local) :
  // la promise reste dans le scope et l'isolate Deno garde les promises
  // pendantes vivantes par défaut.
  if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
    // @ts-ignore
    EdgeRuntime.waitUntil(work);
  }

  return new Response(
    JSON.stringify({ ok: true, job_id: body.job_id, status: "running" }),
    { status: 202, headers: { "content-type": "application/json" } },
  );
});
