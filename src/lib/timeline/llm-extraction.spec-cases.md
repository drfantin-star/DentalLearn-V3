# `llm-extraction.ts` — cas limites attendus

Pas de framework de test installé sur ce repo (cf. handoff §3 RECAP T4 §9 D14).
Ce document liste les cas que `extractScenesFromScript` et
`buildTimelineFromRaw` doivent couvrir, avec le comportement attendu pour
chaque. Sert de référence à un futur portage vers vitest/jest et à la
revue manuelle.

## `extractScenesFromScript`

### Cas 1 — Succès au 1er essai (cas nominal)
- **Entrée** : script + transcript valides, ANTHROPIC_API_KEY présente.
- **Mock Anthropic** : retourne `{"scenes":[...],"concepts":[...]}`.
- **Attendu** : `{ ok: true, raw_output, attempts: 1, warnings: [] }`.
- **Logs** : `extraction_succeeded`.

### Cas 2 — Recovery JSON wrap markdown
- **Mock Anthropic** : retourne ` ```json\n{...}\n``` `.
- **Attendu** : `{ ok: true, attempts: 1, warnings: ['json_recovered_from_wrap'] }`.
- **Logs** : `extraction_json_recovered_from_wrap`.

### Cas 3 — Réponse non parseable au 1er essai, OK au 2e
- **Mock** : 1er essai = "lorem ipsum"; 2e essai = JSON valide.
- **Attendu** : `{ ok: true, attempts: 2, warnings: [] }`, tokens cumul des 2 essais.

### Cas 4 — Échec parse 3 essais consécutifs
- **Mock** : 3× réponses invalides.
- **Attendu** : `{ ok: false, stage: 'json_parse', attempts: 3, errors[≥1], sonnet_raw tronqué }`.
- **Logs** : `extraction_exhausted` avec final_stage='json_parse'.

### Cas 5 — Structure manquante (top-level keys)
- **Mock** : retourne `{"scenes":[]}` (pas de `concepts`).
- **Attendu** : `{ ok: false, stage: 'structure_check', errors: ['missing top-level keys: concepts'], partial_output }`.

### Cas 6 — Erreur réseau Anthropic
- **Mock** : SDK throw une erreur durable (4xx/réseau coupé).
- **Attendu** : `{ ok: false, stage: 'anthropic_call', attempts: 1, partial_output: null }`.
- **Note** : pas de retry — le SDK retry déjà 429/5xx en interne.

### Cas 7 — Timeout AbortController 45s
- **Mock** : SDK ne répond pas.
- **Attendu** : abort après 45s, `{ ok: false, stage: 'anthropic_call', errors: ['Anthropic call aborted after 45000ms'] }`.

### Cas 8 — ANTHROPIC_API_KEY manquante
- **Env** : pas de `ANTHROPIC_API_KEY`.
- **Attendu** : `{ ok: false, stage: 'anthropic_call', errors: ['Missing ANTHROPIC_API_KEY env var'], attempts: 0 }`.

### Cas 9 — Réponse vide (pas de bloc text)
- **Mock** : `response.content = []`.
- **Attendu** : retry possible (stage='json_parse', errors: ['empty response from Sonnet']).

## `buildTimelineFromRaw`

### Cas 10 — Pipeline nominal
- **Input raw** : 4 scènes valides + 8 concepts valides + transcript 1500 mots.
- **Attendu** :
  - `timeline.scenes.length === 4`
  - `chapters.length === 4`, ASC sur `start_sec`
  - `warnings === []`
  - chaque `scene.start_sec` correspond au `start_sec` du mot d'index `trigger_at_word_index`

### Cas 11 — Plus de 5 scènes
- **Input** : 7 scènes.
- **Attendu** : `timeline.scenes.length === 5`, warning `scenes_truncated:7->5`.

### Cas 12 — Card text de 80 caractères
- **Input** : une `flowchart.cards[0].text` de 80 chars.
- **Attendu** : tronqué à 57+`...`, warning `text_truncated:scene-1`.

### Cas 13 — Card subtitle de 50 caractères
- **Input** : une `grid.cards[0].subtitle` de 50 chars.
- **Attendu** : tronqué à 37+`...`, warning `subtitle_truncated:scene-1`.

### Cas 14 — `trigger_at_word_index` hors bornes
- **Input** : scène avec `trigger_at_word_index: 999999`, transcript de 1500 mots.
- **Attendu** : fallback `start_sec = sceneIndex * (duration / count)`, warning
  `word_index_out_of_bounds:scene-N`.

### Cas 15 — `display_duration_sec` hors range
- **Input** : `display_duration_sec: 10` (< 20) ou `60` (> 45).
- **Attendu** : clamp à 20 / 45, warning `duration_clamped:scene-N`.

### Cas 16 — `id` scène absent ou doublon
- **Input** : 2 scènes avec `id` non fourni, ou 2 scènes avec `id: 'scene-1'`.
- **Attendu** : la 2e scène prend `scene-2` (fallback indexé), pas de warning
  (comportement attendu et silencieux).

### Cas 17 — Causal sans edges
- **Input** : `template: { kind: 'causal', nodes: [{id:'a',text:'x'},{id:'b',text:'y'}], edges: [] }`.
- **Attendu** : `TimelineSchema.safeParse` PASSE — le refine() exige des `nodes[≥2 with id]`
  ET des edges qui référencent ces id ; `edges: []` satisfait `every()` (vacuously true).
- **Note dette** : Sonnet est instruit via prompt de fournir au moins 1 edge — si
  ce cas pathologique remonte, on ajoutera une règle plus stricte au refine().

### Cas 18 — Causal avec edge orpheline
- **Input** : `nodes: [{id:'a',...}, {id:'b',...}], edges: [{from:'a', to:'c'}]`.
- **Attendu** : Zod refine fail → return `{ ok: false, stage: 'validation', errors[≥1],
  partial_timeline (l'objet brut pour debug) }`.

### Cas 19 — Concept `at_word_index` absent
- **Input** : concept sans `at_word_index` (ou hors bornes).
- **Attendu** : `at_sec = 0`, warning `concept_word_index_out_of_bounds:term`.
- **Note** : `start_sec=0` reste valide pour `TimelineConceptSchema.start_sec.nonnegative()`.

### Cas 20 — Concept `definition` > 300 chars
- **Input** : `definition` de 400 chars.
- **Attendu** : tronqué à 297+`...` côté serveur (avant Zod parse) — passe la
  contrainte `z.string().max(300).optional()` du schéma post-T5.0.

### Cas 21 — Transcript vide
- **Input** : `transcript.segments = []`.
- **Attendu** : tous les `getSecAtWordIndex` retournent null → fallback
  proportionnel partout, warnings `word_index_out_of_bounds:*` pour toutes
  les scènes/concepts. `scene[0].start_sec === 0`, `scene[N-1].start_sec`
  proche de `duration_sec`.

### Cas 22 — `audio_url` non-URL
- **Input** : `audio_url: 'not-a-url'`.
- **Attendu** : `TimelineSchema` n'exige PAS `.url()` sur `audio_url` (juste
  `z.string()`) → passe. Pas de warning.
- **Note** : le BodySchema de la route exige `.url()` sur le query param ;
  c'est la première ligne de défense. Si on charge l'`audio_url` depuis une
  timeline existante (loadFormationContextFromTimeline), on fait confiance à
  T2 pour avoir produit une URL valide.
