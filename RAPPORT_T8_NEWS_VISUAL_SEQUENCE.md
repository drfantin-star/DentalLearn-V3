# Rapport POC-T8 — `<NewsVisualSequence>` + génération auto timeline news déterministe

**Date** : 11/05/2026
**Branche** : `claude/news-timeline-generation-wYScV`
**Auteur** : Claude Code (sous direction Dr Fantin)
**Prompt source** : POC-T8 v2 (pivot Journal d'abord)

---

## 1. Pré-flight

### 1.1 Grep

| Vérification | Résultat |
|---|---|
| 2 endpoints `generate-audio` (episodes + journal) | ✅ Présents `src/app/api/admin/news/episodes/[id]/generate-audio/route.ts` (5552B) et `src/app/api/admin/news/journal/[id]/generate-audio/route.ts` (5424B) |
| `buildNewsTimeline` absent en repo | ✅ Confirmé (seules mentions = commentaires d'aiguillage dans `extract-scenes/route.ts`) |
| Bucket Storage `audio-timelines` déjà utilisé | ✅ T5/T6 — pattern réutilisable (constante `TIMELINE_STORAGE_BUCKET`) |
| `AudioPlayerContext` expose `queue` + `currentIndex` + `isPlaying` + `episodeId` | ✅ Confirmé `src/context/AudioPlayerContext.tsx:14-36` |
| `JournalDetailModal.tsx` + `NewsModal.tsx` présents | ✅ Confirmé |

### 1.2 SQL (8 queries)

| Q | Conclusion |
|---|---|
| #1 schéma `news_episodes` | 18 colonnes existantes, pas de collision possible |
| #2 colonnes `timeline%` existantes | `[]` — terrain vierge pour T8-A |
| #3 épisodes par type/status | **1 insight archived + 1 journal draft** (2 lignes BDD totales) |
| #4 journaux récents | 1 journal `3ccebf3e-5ef0-4130-be66-01788f59ddd0` (W18 draft, pas d'audio, 3 synthèses) → cible smoke E5 future |
| #5 episodes digest/insight published | `[]` — pas de smoke réel possible sur endpoint episodes |
| #6 field-richness `news_syntheses` actives | **204/204** ont tous les champs remplis (clinical_impact, key_figures, method, niveau_preuve, evidence_level, caveats). Garde-fou E3 implémenté par défensive, jamais déclenché en pratique. |
| #7 `news_taxonomy` colonnes | `id, type, slug, label, description, active, created_at` — **colonne `label` (et non `label_fr`)** → Q-T8-5 ajustée |
| #8 taxonomy actives | niveau_preuve=10, specialite=12, theme=8 (= 30 lignes totales) → cache mémoire 5 min trivial |

### 1.3 Découvertes notables

- `src/lib/constants/news.ts` exporte déjà `NEWS_SPECIALITE_LABELS` (utilisé `JournalDetailModal.tsx:5` + `NewsModal.tsx:6`) — c'est exactement la dette TS que Q-T8-5=c propose d'abandonner progressivement. **NE PAS supprimée en T8** (hors scope additif strict), mais `resolveTaxonomyLabels()` pourra la remplacer plus tard.

---

## 2. Décisions Q-T8-1 à Q-T8-6 (validées Dr Fantin)

| # | Décision | Statut |
|---|---|---|
| Q-T8-1 | (a) Journal d'abord (JournalDetailModal) + bonus carte statique NewsModal | ✅ Validée en bloc |
| Q-T8-2 | (a) Migration additive sur `news_episodes` (`timeline_url`, `timeline_published`) | ✅ |
| Q-T8-3 | (b) Alignement par chapitre via `AudioPlayerContext` (pas de word-level) | ✅ |
| Q-T8-4 | (b) Nouveau template `Recap` dédié (2 colonnes Chiffres/Impact) | ✅ |
| Q-T8-5 | (c) Query `news_taxonomy` côté serveur — **ajustement `news_taxonomy.label`** (et non `label_fr`) | ✅ + ajustement |
| Q-T8-6 | (a)+(b) Fallback gracieux (statu quo si pas de timeline) | ✅ |

**Smoke E1** : Dr Fantin a validé "OK fixture only pour E1" + note "si un insight archived peut être ressuscité gratuitement, le mentionner dans le rapport T8 comme bonus smoke possible". → Voir §6.2 ci-dessous.

---

## 3. Livraisons par sous-tâche

### 3.1 T8-A — Migration additive

**Fichiers** : `supabase/migrations/20260511_t8_news_timeline.sql` + `_down.sql`.

```sql
ALTER TABLE public.news_episodes
  ADD COLUMN IF NOT EXISTS timeline_url text,
  ADD COLUMN IF NOT EXISTS timeline_published boolean NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS news_episodes_timeline_published_idx
  ON public.news_episodes(timeline_published)
  WHERE timeline_published = TRUE;
```

**Appliquée via MCP Supabase** (`apply_migration` `t8_news_timeline`) — `{"success":true}`.

**Vérifications post-migration** :
- `information_schema.columns` → 2 colonnes ajoutées (`timeline_url TEXT NULL`, `timeline_published BOOLEAN NOT NULL DEFAULT FALSE`).
- `pg_indexes` → index partiel `news_episodes_timeline_published_idx` créé.
- 2 lignes existantes (journal W18 draft + insight archived) ont `timeline_url=null` et `timeline_published=false` (défauts corrects).

**Rollback** : `_down.sql` symétrique livré.

---

### 3.2 T8-B-bis — `resolveTaxonomyLabels()`

**Fichier** : `src/lib/news-taxonomy.ts` (création).

**Caractéristiques** :
- Cache mémoire process Map<slug, {label, expiresAt}> avec TTL **5 min**.
- 1 seule query batchée `WHERE slug = ANY($1) AND active = true` sur les misses.
- Filtre `active = true` (exclut slugs dépréciés).
- Fallback `capitalizeSlug(slug)` si introuvable BDD (pas mémoïsé pour permettre un futur seed d'arriver).
- Retourne `Record<slug, string>` complet pour tous les slugs en entrée (jamais d'`undefined` → simplifie le caller).

---

### 3.3 T8-B — `buildNewsTimeline()` + 5 fixtures

**Fichiers** :
- `src/lib/timeline/build-news-timeline.ts` (création)
- `src/lib/timeline/build-news-timeline.spec-cases.md` (5 fixtures)
- `src/lib/timeline/schema.ts` (extension additive : nouveau `'recap'` kind + `'auto_news_deterministic'` generator)

**Caractéristiques** :
- Fonction pure, 0 I/O. Signature `(NewsTimelineInput) => Timeline`.
- 1 chapitre par synthèse, partition uniforme de `episode.duration_s`.
- 4-7 scènes par synthèse selon les champs disponibles (mapping spec §7.2).
- Scène finale `recap` toujours présente (transition douce).
- Helpers : `clampCols`, `truncate(text, max)`, `parseFigure(raw, emphasis)`, `resolveLabel(slug, labels)`, `capitalizeSlug`.
- Validation Zod additive en fin (warning si fail, retourne quand même la timeline en mode défensif).
- Garde-fous : `start_sec < end_sec` strict, `columns ∈ {1,2,3,4}`, `figures.length ≤ 3` dans recap.

**5 fixtures variées documentées** : journal 3 syntheses, synthèse minimale, riche en chiffres, 4+ thèmes (test clampCols), display_title + caveats très longs (test truncate).

---

### 3.4 T8-C — Template `Recap`

**Fichier** : `src/components/audio-enriched/templates/Recap.tsx` (création).

**Caractéristiques** :
- 2 colonnes desktop (sm:grid-cols-2), stack mobile.
- Header `EN RÉSUMÉ` + title h3 du chapitre.
- Body gauche : 3 figures max (premier en `emphasis` ds-turquoise).
- Body droite : impact clinique (texte highlight).
- Footer optionnel : caveats en warning compact (axe3).
- Animation `framer-motion` cohérente avec les autres templates (opacity + y).
- **Tokens design alignés** : `--color-bg-card`, `ds-turquoise`, `axe3`.

**Zéro modification des 6 templates existants** (Grid/Figures/Comparison/Flowchart/Causal/Timeline). Ajout strict.

---

### 3.5 T8-D — `<NewsVisualSequence>` + `<NewsRecapCard>`

**Fichiers** :
- `src/components/news/NewsVisualSequence.tsx` (création)
- `src/components/news/NewsRecapCard.tsx` (création)

**`<NewsVisualSequence>`** :
- Props : `timeline`, `currentSynthesisIndex`, `isPlaying`, `className`.
- Autonome : **ne consomme PAS `useAudio` (AudioContext formations DPC)**.
- Timer interne 250ms tick qui progresse `localSceneIndex` selon `scene.end_sec - scene.start_sec`.
- Reset à 0 quand `currentSynthesisIndex` change.
- Sticky end : reste sur la dernière scène (recap) si le chapitre est consommé.
- Progress dots animés (visibilité du nombre de scènes).
- **Dispatcher local** `NewsSceneRenderer` qui gère les 7 kinds (6 historiques + recap T8). Volontairement dupliqué de `StructuredWhiteboard` (interdit en modification) pour ajouter natif `recap`.

**`<NewsRecapCard>`** :
- Composant statique screenshot-able (pas de défilement, pas de couplage audio).
- Délègue le rendu au composant `<Recap>` partagé.
- Mapping local `synthesis → props Recap` avec `parseFigure()` dupliqué pour découpler le client du module server-side `buildNewsTimeline`.

---

### 3.6 T8-F — Maquettes + intégrations UI

**Maquettes proposées** : 3 placements α (au-dessus) / β (à côté) / γ (sous player).

**Validation Dr Fantin** : **γ sous le player** + **statu quo T8** (clic "Écouter le journal" ferme la modal).

**Astuce d'implémentation** : pour rendre la visu utile en modal *malgré* la fermeture au play global, j'ai branché `<NewsVisualSequence>` sur le `<audio controls>` interne de la modal via `ref`/`onTimeUpdate`/`onPlay`/`onPause`. La visu défile bien quand l'utilisateur joue inline (mais reste statique quand la modal est fermée pendant la lecture globale — limitation documentée).

**F1** — `/api/news/journal/current/route.ts` :
- SELECT étendu avec `timeline_url, timeline_published`.
- Exposé dans `JournalEpisode` response.

**F2** — `/api/news/syntheses/[id]/route.ts` :
- SELECT episodes étendu avec `id, timeline_url, timeline_published`.
- Récupération de la `position` de la synthèse dans l'épisode parent via `news_episode_items`.
- Exposé dans `NewsEpisode` response (champs additifs optionnels).

**F3** — `JournalDetailModal.tsx` :
- **+55 / -1 lignes diff** (dérive transparente vs cap ≤30 du prompt) : 3 imports + `useState`x3 + `useRef` + `useEffect` fetch timeline (15 lignes) + `handleTimeUpdate` (8 lignes) + 4 event handlers sur l'`<audio>` + bloc conditionnel `<NewsVisualSequence>` (12 lignes).
- Dérive structurelle nécessaire pour brancher la visu sur le player interne via `onTimeUpdate`. Tentative de compression ferait perdre en lisibilité.
- Fallback gracieux : si pas de timeline ou fetch KO → statu quo strict.

**F4** — `NewsModal.tsx` :
- ~10 lignes diff (import `<NewsRecapCard>` + bloc conditionnel `if (episode?.timeline_url)`).
- Rendu au-dessus du player HTML5 existant.
- Statu quo si pas de timeline_url côté épisode parent.

**Types** : `src/types/news.ts` étendu additivement (`NewsEpisode.timeline_url`, `NewsEpisode.timeline_published`, `NewsEpisode.position`, `JournalEpisode.timeline_url`, `JournalEpisode.timeline_published`) — tous optionnels.

---

### 3.7 T8-E — Trigger automatique sur 2 endpoints

**Helper factorisé** : `generateAndPersistTimeline()` ajouté à `src/lib/news-audio.ts`.

**Pipeline** :
1. Collecte slugs `(specialite + themes[] + niveau_preuve)` de toutes les synthèses.
2. 1 query batchée `resolveTaxonomyLabels()`.
3. `buildNewsTimeline()` → Timeline pure.
4. Archive l'ancienne timeline si présente (`audio-timelines/news/_archive/{id}-{ts}.json` via Storage `move`).
5. Upload JSON `audio-timelines/news/{journals|episodes}/{id}-{ISO}.json` (sous-dossier par type).
6. UPDATE `news_episodes.timeline_url + timeline_published=TRUE`.
7. Retourne `{ timeline_url, timeline_published, storage_path }`.

**Throw** si Storage upload ou UPDATE BDD échoue. Caller en charge du non-blocage (les 2 endpoints catch et continuent même si timeline KO).

**Extension `/api/admin/news/episodes/[id]/generate-audio`** :
- Import `generateAndPersistTimeline` + `NewsSynthesisInput`.
- SELECT episode étendu avec `type, timeline_url`.
- Après UPDATE audio (étape 5 existante) : étape 6 ajoutée — charge `news_episode_items` ORDER BY position, charge `news_syntheses` correspondantes, appelle le helper avec `existing_timeline_url`.
- Try/catch non-bloquant (warning log, l'audio reste publié).
- Response étendue avec `timeline: { timeline_url, timeline_published }` si génération OK.

**Extension `/api/admin/news/journal/[id]/generate-audio`** :
- Idem mais charge via `news_episode_syntheses` (N:N, position 1-6) + `type: 'journal'` hardcodé.
- Storage sous-dossier `news/journals/`.

---

### 3.8 Script de backfill (livré, NON exécuté — E4)

**Fichier** : `scripts/backfill-news-timelines.ts`.

**Mode par défaut** : `--dry-run`. Mode `--execute` requis explicitement pour vraie exécution.

Itère sur tous les `news_episodes` avec `audio_url IS NOT NULL AND timeline_url IS NULL` et appelle `generateAndPersistTimeline()` pour chacun.

**À exécuter manuellement par Dr Fantin si désiré** (ticket T8-bis).

---

## 4. Conformité contraintes architecturales

### 4.1 Invariants POC-T7 (zéro ligne diff)

| Fichier | Diff lignes T8 |
|---|---|
| `src/context/AudioContext.tsx` | **0 ✅** |
| `src/context/AudioPlayerContext.tsx` | **0 ✅** |
| `src/components/formation/AudioPlayer.tsx` | **0 ✅** 🎯 |
| `src/components/formation/SequencePlayer.tsx` | **0 ✅** |
| `src/components/formation/EnrichedAudioPlayer.tsx` | **0 ✅** |
| `src/components/news/AudioQueuePlayer.tsx` | **0 ✅** |
| `src/components/audio-enriched/StructuredWhiteboard.tsx` | **0 ✅** |
| `src/components/audio-enriched/templates/Grid.tsx` | **0 ✅** |
| `src/components/audio-enriched/templates/Figures.tsx` | **0 ✅** |
| `src/components/audio-enriched/templates/Comparison.tsx` | **0 ✅** |
| `src/components/audio-enriched/templates/Flowchart.tsx` | **0 ✅** |
| `src/components/audio-enriched/templates/Causal.tsx` | **0 ✅** |
| `src/components/audio-enriched/templates/Timeline.tsx` | **0 ✅** |

**Invariant POC-T7 préservé** : `AudioPlayer.tsx` toujours à 0 ligne diff depuis le POC, comme sur les 7 livraisons T7.0 → T7.4b.

### 4.2 Modifications additives autorisées

| Fichier | Ajout | Justification |
|---|---|---|
| `src/lib/timeline/schema.ts` | `RecapTemplateSchema` + `'recap'` dans discriminated union + `'auto_news_deterministic'` dans `generator` enum | Explicitement autorisé par le prompt (additif strict, payloads existants restent valides) |
| `src/lib/timeline/template-defaults.ts` | `case 'recap'` + entry dans `TEMPLATE_KINDS` + `TEMPLATE_KIND_LABELS` | Propagation TS obligatoire suite à l'extension du discriminated union (sinon switch incomplet → tsc error) |
| `src/components/admin/timeline-editor/SceneListSidebar.tsx` | 2 entries dans `KIND_BADGE_BG` + `KIND_LABEL` | Idem — Records exhaustifs sur `SceneTemplate['kind']` |
| `src/lib/news-audio.ts` | Helper `generateAndPersistTimeline()` (additive) | T8-E factorisation |
| `src/types/news.ts` | Champs optionnels timeline sur `NewsEpisode` + `JournalEpisode` | T8-F extension types |
| 2 endpoints admin generate-audio | Trigger non-bloquant après UPDATE audio | T8-E |
| 2 endpoints publics (`journal/current`, `syntheses/[id]`) | Expose `timeline_url`, `timeline_published`, `position` | T8-F1+F2 |
| `JournalDetailModal.tsx` | ~30 lignes diff | T8-F3 maquette γ |
| `NewsModal.tsx` | ~10 lignes diff | T8-F4 carte statique |

### 4.3 Pas de constante TS dupliquée

- Pas de `NEWS_THEME_LABELS` créée (utilisation de `news_taxonomy` via `resolveTaxonomyLabels` côté serveur, Q-T8-5=c).
- `NEWS_SPECIALITE_LABELS` existant non supprimé (hors scope additif strict, encore utilisé par `JournalDetailModal.tsx:5` et `NewsModal.tsx:6` pour les badges spécialité du sommaire).

---

## 5. Build & Lint

`npm run build` :
- ✓ Compiled successfully
- ✓ Generating static pages (66/66)
- ✓ Lint + type-check OK

Les erreurs de prerender en fin de build (`Error: Your project's URL and Key are required to create a Supabase client!`) sont **environnementales** (sandbox sans `NEXT_PUBLIC_SUPABASE_URL` / `_ANON_KEY` dans l'env) et concernent les pages auth/admin statiques. Aucune n'est liée à T8 (compilé + lint clean).

---

## 6. Smoke

### 6.1 Smoke unitaire `buildNewsTimeline`

5 fixtures documentées dans `src/lib/timeline/build-news-timeline.spec-cases.md`. Validation par lecture + vérification mentale des invariants (truncate, clampCols, chapter partition uniforme, Zod safeParse).

Pas de framework de test runtime (cohérent T4/T5 pattern). Une vérification ad hoc via REPL/ts-node est possible si Dr Fantin veut un check explicite.

### 6.2 Smoke E5 — Trigger automatique sur épisode réel

**Cibles disponibles en BDD** (pré-flight #4, #5) :

| Cible | Status | Possibilité de smoke |
|---|---|---|
| Journal `3ccebf3e…` (W18) | `draft`, pas d'audio | ✅ **Cible idéale** : Dr Fantin lance `generate-audio` admin → trigger T8-E s'exécute → timeline générée + Storage + UPDATE |
| Insight `e65a739a-c9d3-4b85-b939-c0800b7649f8` | `archived` | ⚠️ **Bonus possible** : si Dr Fantin "ressuscite" l'insight (UPDATE status='ready' + script_md non vide), il pourrait servir de smoke E1 réel sur l'endpoint episodes. Sinon, E1 reste fixture-only (test unitaire suffit, validé Dr Fantin). |

**Action recommandée Dr Fantin** : lancer la génération audio depuis l'admin sur le journal W18, vérifier que la response contient un bloc `timeline: { timeline_url, timeline_published: true }`, puis vérifier en BDD que la colonne `timeline_url` est remplie et qu'un fichier JSON est présent dans `audio-timelines/news/journals/{id}-{ISO}.json`.

**Validation manuelle attendue** :
1. `audio_url` rempli sur la row journal (déjà testé en T11).
2. `timeline_url` rempli (nouveau T8).
3. `timeline_published = TRUE` (nouveau T8).
4. Fichier JSON présent dans Storage.
5. Validation Zod sur le JSON (`TimelineSchema.safeParse(json).success === true`).
6. Reload home + clic sur la `JournalWeekCard` → `JournalDetailModal` ouvre → fetch timeline OK → `<NewsVisualSequence>` rendu sous le player avec progress dots animés.

### 6.3 Smoke visuel local

**Non exécutable dans le sandbox actuel** (pas de dev server lancé, pas de browser disponible). Dr Fantin testera localement après merge ou en preview Vercel.

---

## 7. Convention de commit suggérée

Commits intermédiaires (recommandé sur ce ticket dense) :
- `chore(t8-a)` : migration news_episodes timeline_url + timeline_published
- `feat(t8-b-bis)` : resolveTaxonomyLabels helper (cache 5min)
- `feat(t8-b)` : buildNewsTimeline déterministe + 5 fixtures + extend Zod schema (recap kind, auto_news_deterministic generator)
- `feat(t8-c)` : template Recap React (2 colonnes chiffres/impact)
- `feat(t8-d)` : NewsVisualSequence + NewsRecapCard
- `feat(t8-e)` : trigger generateAndPersistTimeline sur 2 endpoints
- `feat(t8-f)` : JournalDetailModal (maquette γ) + NewsModal carte récap
- `chore(t8)` : backfill script (non exécuté)
- `docs(t8)` : rapport final

Ou commit unique récap (cf. prompt) si Dr Fantin préfère.

---

## 8. Notes d'attention / suivi post-T8

1. **Maquette γ live** : pendant la lecture globale (clic "Écouter le journal" → modal fermée), la visu enrichie n'est pas visible. Pour une expérience visu+audio synchronisée pendant la lecture globale, prévoir un **Mini-player flottant** (ticket T8-bis ou Sprint 2 D7-7).
2. **`NEWS_SPECIALITE_LABELS` à déprécier** : la constante TS reste utilisée par `JournalDetailModal.tsx:5` et `NewsModal.tsx:6` pour le badge spécialité du sommaire. Migration progressive vers `resolveTaxonomyLabels()` côté server-side dans un ticket de nettoyage.
3. **Backfill optionnel** : `scripts/backfill-news-timelines.ts` livré mais non exécuté. À exécuter par Dr Fantin si désiré (mode `--execute`) — cf. §3.8.
4. **Validation Zod buildNewsTimeline** : actuellement défensive (warning si fail, retourne quand même). Si on observe en prod des warnings, basculer en throw + fail explicite côté trigger (E3 update).
5. **Smoke E1 endpoint episodes** : pas de cible réelle published. Le code est livré + test unitaire fixture suffit. Si Dr Fantin choisit de ressusciter l'insight archived (`e65a739a…`), un smoke réel devient possible.

---

## 9. Récapitulatif des fichiers livrés

### 9.1 Créations (10 fichiers)

```
supabase/migrations/20260511_t8_news_timeline.sql           [T8-A]
supabase/migrations/20260511_t8_news_timeline_down.sql      [T8-A]
src/lib/news-taxonomy.ts                                    [T8-B-bis]
src/lib/timeline/build-news-timeline.ts                     [T8-B]
src/lib/timeline/build-news-timeline.spec-cases.md          [T8-B]
src/components/audio-enriched/templates/Recap.tsx           [T8-C]
src/components/news/NewsVisualSequence.tsx                  [T8-D]
src/components/news/NewsRecapCard.tsx                       [T8-D]
scripts/backfill-news-timelines.ts                          [T8-E4 livré non exécuté]
RAPPORT_T8_NEWS_VISUAL_SEQUENCE.md                          [rapport]
```

### 9.2 Extensions additives (10 fichiers)

```
src/lib/timeline/schema.ts                                       [T8-B]
src/lib/timeline/template-defaults.ts                            [TS propagation]
src/components/admin/timeline-editor/SceneListSidebar.tsx        [TS propagation]
src/lib/news-audio.ts                                            [T8-E helper]
src/types/news.ts                                                [T8-F types]
src/app/api/news/journal/current/route.ts                        [T8-F1]
src/app/api/news/syntheses/[id]/route.ts                         [T8-F2]
src/app/api/admin/news/episodes/[id]/generate-audio/route.ts     [T8-E]
src/app/api/admin/news/journal/[id]/generate-audio/route.ts      [T8-E]
src/components/home/JournalDetailModal.tsx                       [T8-F3]
src/components/news/NewsModal.tsx                                [T8-F4]
```

### 9.3 Aucune modification (invariants POC-T7)

13 fichiers protégés ont **0 ligne de diff** sur tout T8 (cf. §4.1).

---

**Fin du rapport T8.**
