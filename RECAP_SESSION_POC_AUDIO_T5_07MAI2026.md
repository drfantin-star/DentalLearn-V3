# RECAP — Session POC Visualisation Audio · Ticket 5 (Agent extraction Sonnet)

> **Date** : 2026-05-07
> **Branche** : `claude/agent-extraction-sonnet-8h4uh`
> **Spec** : `spec_poc_visualisation_audio_v1_0` §6 + §10 Ticket 5
> **Sessions précédentes** : T1 (migration), T2 (pipeline Python), T3 (karaoké),
> T4.1/T4.2/T4.3 (whiteboard 6 templates) — toutes mergées sur `main`.

---

## 1. Périmètre livré

Quatre sous-tickets séquentiels, 4 commits sur la branche
`claude/agent-extraction-sonnet-8h4uh`.

| Sub-ticket | SHA       | Fichiers                                                                                                                                                    | LOC      |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| T5.0       | `bbcb08b` | `src/lib/timeline/schema.ts` (modifié)                                                                                                                       | +9       |
| T5.1       | `a77d046` | `route.ts`, `llm-extraction.ts`, `llm-prompt-formations.ts`, `parse-json-recovery.ts` + bump `package.json` (`@anthropic-ai/sdk`)                            | +996     |
| T5.2       | `921e35a` | `llm-extraction.ts` (étendu), `word-index-lookup.ts`, `llm-extraction.spec-cases.md`, `route.ts` (étendu)                                                    | +713/-19 |
| T5.3       | `30fd67a` | `extract-scenes/page.tsx`, `extract-scenes/ExtractScenesClient.tsx`, `extract-scenes/pricing.ts`, `route.ts` (persistance Storage)                          | +530/-1  |

### Fichiers créés

```
src/lib/timeline/parse-json-recovery.ts          # JSON parse strict avec recovery
src/lib/timeline/llm-prompt-formations.ts        # Prompt §6.2 + 3 few-shots
src/lib/timeline/llm-extraction.ts               # Orchestration Sonnet + buildTimelineFromRaw
src/lib/timeline/word-index-lookup.ts            # Lookup `word_index → start_sec`
src/lib/timeline/llm-extraction.spec-cases.md    # 22 cas limites documentés
src/app/api/admin/timeline/extract-scenes/route.ts
src/app/admin/poc/extract-scenes/page.tsx
src/app/admin/poc/extract-scenes/ExtractScenesClient.tsx
src/app/admin/poc/extract-scenes/pricing.ts
```

### Fichiers modifiés

- `src/lib/timeline/schema.ts` : 5 champs additifs optionnels sur
  `TimelineConceptSchema` (`term`, `definition`, `at_sec`, `at_word_index`,
  `source`). Aucun consommateur cassé.
- `package.json` : ajout `@anthropic-ai/sdk ^0.95.1`.

### Branche poussée
`claude/agent-extraction-sonnet-8h4uh` → `origin`. Pas de PR ouverte
(à créer manuellement vers `main` quand validation utilisateur OK).

---

## 2. Quality run pilote

> **À EXÉCUTER POST-DEPLOY VERCEL** — la session locale n'a pas accès à
> ANTHROPIC_API_KEY ni au runtime Vercel pour mesurer un appel réel.

Procédure recommandée pour Dr Fantin après merge :

1. Push de la branche → preview Vercel auto-déployée.
2. Login super_admin sur le preview.
3. Aller sur `/admin/poc/extract-scenes`.
4. Sélectionner « #2 — La communication non verbale au fauteuil ».
5. Laisser dry-run ON, cliquer « Extraire les scènes via LLM ».
6. Mesurer :
   - `duration_ms` (cible : 15-25s pour Sonnet 4.6 sur ~900 mots)
   - `input_tokens` (cible : 3000-5000 — le prompt + transcript words)
   - `output_tokens` (cible : 1500-3000)
   - `scenes_count` (cible : 3-5)
   - `concepts_count` (cible : 5-12)
   - `attempts` (cible : 1, sinon Sonnet a drift)
   - Warnings : 0 attendu sur scénario nominal ; logguer si `text_truncated`,
     `duration_clamped`, ou `word_index_out_of_bounds`.
7. Coût indicatif visible dans la card "Métadonnées LLM" — vérifier que
   ça reste sous 5 cents par run (cible budget POC).
8. Inspection qualitative du JSON généré :
   - Les scènes ciblent bien des passages structurels (pas de scène sur l'intro
     ou la conclusion)
   - Les `template.kind` sont pertinents par rapport au contenu
   - Les `card.text` sont en sentence case sans point final, ≤ 60 chars
   - Les concepts sont des termes médicaux (pas "patient", "soin", etc.)
   - Les définitions sont cliniquement justes (~1-2 phrases)

Si tout est OK : retoggle dry-run OFF, refaire un run pour persister
réellement dans `audio-timelines/poc/` et update `sequences.timeline_url`.

---

## 3. Décisions arbitrées

### Confirmées (Q1 à Q6 — décisions de début de session)

- **Q1 — Format hybride** : Sonnet raisonne en `trigger_at_word_index` +
  `display_duration_sec` entiers. Conversion `word_index → start_sec` côté
  serveur via `getSecAtWordIndex` (lookup `flattenTranscript`). End_sec
  calculé par addition. Validation Zod stricte appliquée APRÈS conversion.
  ✅ Implémenté `buildTimelineFromRaw` + `word-index-lookup.ts`.
- **Q2 — Scenes ET concepts dans le même appel** : confirmé. Le prompt §6.2
  produit `{ scenes[], concepts[] }` en un seul JSON.
- **Q3 — Sous-ticket T5.0 préalable** : confirmé. 5 champs additifs
  optionnels sur `TimelineConceptSchema` (`term`, `definition`, `at_sec`,
  `at_word_index`, `source`). Rétro-compat 100 % avec T2 (pipeline Python).
- **Q4 — Pas de pattern `{"limit": N}`** : confirmé. Route mono-appel avec
  `maxDuration=60` + `AbortController` 45s côté SDK. Retry 1..3 sur stages
  json_parse / structure_check (constante `MAX_EXTRACTION_RETRIES=3`).
- **Q5 — DEFAULT_SONNET_MODEL** : lu exact depuis
  `supabase/functions/synthesize_articles/types.ts:18` →
  `"claude-sonnet-4-6"`. Dupliqué dans `llm-extraction.ts` sous
  `SONNET_MODEL_T5` avec commentaire pointant vers la source.
- **Q6 — Refus explicite news** : confirmé. La route POST refuse 400 si
  `source_type === 'news_synthesis'` avec message pointant vers T8
  (`buildNewsTimeline()` déterministe).

### Nouvelles décisions T5

- **D-T5-1 (route source loading)** : la route lit le `timeline_url` existant
  de la séquence pour récupérer transcript + audio_url + duration_sec, et
  reconstitue le `script_text` par concat `${SPEAKER}: ${segment.text}`. Le
  client admin peut donc envoyer un body minimal `{ source_type, source_id }`
  sans transporter le transcript complet. Les champs body restent optionnels
  pour permettre l'override (test curl manuel).
- **D-T5-2 (Storage path)** : `audio-timelines/poc/${source_id}-${ISO}.json`.
  Le timestamp évite l'écrasement entre deux runs LLM successifs sur la même
  séquence (utile pour comparaison admin). Le `timeline_url` de la séquence
  pointe sur le DERNIER fichier uploadé.
- **D-T5-3 (timeline_published à false)** : on ne publie PAS automatiquement
  la timeline générée — l'admin valide via l'éditeur T6. La colonne
  `timeline_published` reste à sa valeur antérieure après un run T5.
- **D-T5-4 (concept end_sec)** : un concept reste highlightable 4s autour de
  son `at_sec`. Choix arbitraire pour donner un `end_sec` valide au schéma
  (`TimelineConceptSchema` exige `end_sec >= 0`) sans introduire un nouveau
  champ Sonnet. La constante est exportée (`CONCEPT_HIGHLIGHT_DURATION_SEC`)
  pour ajustement rapide.
- **D-T5-5 (auth pattern API)** : utilise `getUser()` (et non `getSession()`)
  côté API route — meilleur contrôle de la chaîne JWT. Pour les Server
  Components admin, on garde `getSession()` (pattern T3/T4 inchangé).
- **D-T5-6 (cost estimate côté UI)** : tarifs Sonnet alignés sur
  `synthesize_articles/types.ts` (3 USD/MTok input + 15 USD/MTok output).
  Pas de conversion EUR (affichage USD direct dans la page admin).

---

## 4. Patterns techniques retenus

### Différences vs Edge Function

| Aspect              | Edge Function (synthesize_articles)              | Route Next.js T5                                       |
| ------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| Runtime             | Deno + IDLE_TIMEOUT 150s                         | Node.js + `maxDuration = 60`                           |
| Pattern bounding    | `MAX_BATCH_LIMIT=5` (multi-articles)             | Mono-appel, `AbortController` 45s                      |
| Anthropic client    | `fetch` direct (`_shared/anthropic.ts` Deno)     | SDK officiel `@anthropic-ai/sdk`                       |
| Retry stages        | `json_parse` / `tag_validation` / `anthropic_call` | `json_parse` / `structure_check` / `anthropic_call`    |
| Logger              | `Logger("synthesize_articles.sonnet_call")` Deno | `console.log(JSON.stringify({...}))` Node              |
| Persistance         | `news_syntheses` upsert + `validation_errors`    | Storage upload + `sequences.timeline_url` UPDATE       |
| Validation          | `validateTags` + `validateAndFilterQuestions`    | `TimelineSchema.safeParse` post-conversion             |

### Approche hybride (Q1)

Sonnet est meilleur en raisonnement entier qu'en calibration float (timestamps).
Pattern :

1. Le prompt embarque un `transcript words with index` (un mot par ligne,
   `${index}|${word}`) pour donner à Sonnet une référence stable.
2. Sonnet retourne `trigger_at_word_index` (entier) + `display_duration_sec`
   (entier 20-45).
3. Côté serveur, `getSecAtWordIndex(transcript, idx)` flatte les segments
   (réutilise `flattenTranscript` de T3) et retourne `start_sec` du mot.
4. `end_sec = start_sec + clamp(display_duration_sec, [20, 45])`.
5. Validation Zod stricte sur la `Timeline` finale — pas avant.

Cette approche évite tout drift de timing dû aux capacités limitées de Sonnet
sur les float et préserve la garantie `TimelineSchema.parse()` côté front.

### Defensive validation

`buildTimelineFromRaw` produit toujours une Timeline VALIDE ou un échec
explicite — jamais une Timeline approximative qui passerait Zod mais
crasherait visuellement. Tout drift Sonnet est :

- soit corrigé silencieusement (`scenes_truncated`, `text_truncated`,
  `duration_clamped`, `id` réécrits) avec warning log
- soit bloqué via Zod (causal edges orphelines, structure incohérente) avec
  retour 422 + `partial_timeline` exposé pour debug admin

---

## 5. Dettes loggées

| ID                  | Description                                                                                                                                     | Priorité |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| **POC-T5-D1**       | Pas de framework de tests installé — `llm-extraction.spec-cases.md` documente 22 cas limites mais aucun test runner. Porter en vitest avant T7. | Moyen    |
| **POC-T5-D2**       | Le `script_text` reconstitué par concat `${SPEAKER}: ${text}` est une approximation du dialogue source. Si T6 ajoute une colonne dédiée pour le script brut, ré-aligner la route. | Bas      |
| **POC-T5-D3**       | Le `timeline_url` est écrasé à chaque run T5 — les anciennes versions restent dans le bucket mais ne sont plus pointées par la BDD. Pas de TTL ni de listing UI. À adresser en T6 (admin éditeur peut comparer/restaurer une version). | Bas      |
| **POC-T5-D4**       | Pas de rate limiting côté route — un super_admin peut spam-clicker le bouton et brûler le quota Anthropic. À ajouter quand T7 ouvre la route en self-service éventuel.                  | Moyen    |
| **POC-T5-D5**       | `causal` template avec `edges: []` passe le `refine()` (vacuously true). Ajouter une règle stricte `edges.length >= 1` quand un cas pathologique remonte. | Bas      |
| **POC-T5-D6**       | Pas de logger structuré côté Node.js (`console.log(JSON.stringify(...))` ad hoc). Aligner avec un Pino/Winston quand on connecte un APM.        | Bas      |
| **POC-T5-D7**       | `npm run build` échoue à prerender plusieurs pages auth (`/login`, `/verify-email/confirm`, `/admin/*`) faute d'env vars Supabase au build. Pré-existant à T5. | Hors-scope |

---

## 6. NOTE T8 — buildNewsTimeline déterministe

Reprise des points à implémenter en T8 (cf. spec POC §7) :

- T8 livre `buildNewsTimeline(synthesis)` côté serveur Node.js, **sans LLM**.
- Mapping déterministe `news_syntheses` → templates :
  - `themes` + `specialite` → un template `grid` (cards = themes filtrés
    + chip spécialité en first-card highlight)
  - `key_figures[]` → template `figures` (1-3 items, première en `emphasis: true`)
  - `evidence_level` → card highlight dans le `figures` ou un `figures`
    dédié si pertinent
  - `method` → card pleine largeur dans un `flowchart` à 1 step
  - `clinical_impact` → card highlight dans un `flowchart` final
  - `caveats` → card `variant: 'warning'` dans un template adapté
- Trigger : extension du endpoint `/api/admin/news/episodes/[id]/generate-audio`
  (pas de nouvelle route admin nécessaire, pas de page T8.3 analogue à T5.3).
- Storage path proposé : `audio-timelines/news/${episode_id}-${ISO}.json`
  (cohérent avec `audio-timelines/poc/` de T5).
- **Réutilisation** : la fonction `buildTimelineFromRaw` de T5.2 N'EST PAS
  réutilisable telle quelle (elle suppose un `SonnetExtractionRaw` LLM).
  Mais sa logique de validation Zod finale + génération de `chapters` ASC
  doit être factorisée en une utility `assembleAndValidateTimeline()` que
  T5 et T8 partagent. Plan d'action proposé :
  1. Extraire `assembleTimeline({ source_type, source_id, audio_url,
     duration_sec, transcript, scenes, concepts })` en helper exporté de
     `llm-extraction.ts` ou nouveau module `timeline-assembler.ts`.
  2. T8 appelle `assembleTimeline` avec `source_type='news_synthesis'`,
     `transcript` éventuellement absent (news = pas de karaoké), `scenes`
     produites par mapping déterministe, `concepts: []`.
  3. La validation Zod finale reste centralisée — pas de duplication.

- **Pas de page d'extraction analogue à T5.3** — la timeline news est
  générée automatiquement à la création de l'épisode (post-publication
  des syntheses), via un appel server-side dans le pipeline existant.

---

## 7. Tickets POC restants

| Ticket | Description                                                              | Statut    |
| ------ | ------------------------------------------------------------------------ | --------- |
| **T6** | Éditeur admin de timeline (drag-drop scènes, retouche cards/concepts)    | À faire   |
| **T7** | Intégration formation user — branchement sur `AudioContext` (DPC tracking, anti-skip) | À faire |
| **T8** | News : `buildNewsTimeline` déterministe + intégration epissode        | À faire   |
| **T9** | Tests utilisateurs (formateurs Dr Fantin + 1-2 praticiens externes)      | À faire   |

---

## 8. Prompt d'amorçage T6

```
# Ticket POC-T6 — Éditeur admin de timeline

## Contexte
Spec : `spec_poc_visualisation_audio_v1_0.md` §8.
Sessions précédentes : T1-T5 mergées sur main.
Output de T5 : timelines générées par LLM dans `audio-timelines/poc/${source_id}-${ISO}.json`,
pointées par `sequences.timeline_url`.

## Objectif
Page admin `/admin/poc/timeline-editor` qui permet à un super_admin :
- Charger la timeline pointée par `timeline_url` d'une séquence
- Visualiser les scènes en preview (réutiliser `<StructuredWhiteboard>` de T4)
- Retoucher : drag-and-drop pour réordonner ; éditer titre/cards/variant ;
  ajouter/supprimer une scène ; retoucher concept term/definition ; bouger
  un `start_sec` via slider ou saisie directe
- Re-validation Zod côté client à chaque édit
- Sauvegarder une nouvelle version dans Storage (path daté) et mettre à jour
  `sequences.timeline_url`. Optionnellement : toggle `timeline_published`.

## Décisions à arbitrer début session
- Q1 : format de sauvegarde — re-uploader un fichier JSON avec timestamp
  (T5 D-T5-2) ou écraser le fichier courant ?
- Q2 : auto-save ou sauvegarde explicite ?
- Q3 : versioning visible côté UI (lister les anciens fichiers Storage) ?
- Q4 : preview real-time ou bouton « Visualiser » ?
- Q5 : si on touche `concepts.at_word_index`, doit-on recalculer `at_sec` côté
  client ou attendre la sauvegarde serveur ?

## Périmètre
- Une seule page admin, un seul commit.
- Pas de modification de schema.ts (la T5.0 couvre les besoins concept).
- Pas de modification du composant `<StructuredWhiteboard>` (T4) — réutiliser
  tel quel pour la preview.
- Pas de toggle `timeline_published` automatique — laisser l'admin décider.

## Préalable obligatoire
- Confirmer que `getActiveScene` (T4) fonctionne sur la timeline générée
  par T5 (run sur Communication et Écoute Active S2).
- Vérifier qu'un round-trip JSON load → édit → save → load passe
  `TimelineSchema.parse()` sans warning.
```

---

**Fin du RECAP T5.** Ne PAS clore le ticket en main avant validation manuelle
de Dr Fantin sur le preview Vercel (cf. §2 — "Quality run pilote").
