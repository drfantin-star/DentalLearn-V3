# RECAP — Session T12 News Synthesis Editor + patch T12-D-bis-3

> **Date** : 2026-05-13 (T12 livré) + 2026-05-14 (T12-D-bis-3 livré post-merge)
> **Branche T12** : `claude/t12-news-synthesis-editor-v1` → mergée `main` via PR #267
> **Branche T12-D-bis-3** : `claude/fix-journal-regeneration-TjWpa`
> **Rapport livraison** : `RAPPORT_T12_NEWS_SYNTHESIS_EDITOR.md` (§10 patch post-livraison)

---

## 1. Sommaire

T12 livre l'éditeur admin synthèse News (page `/admin/news/[id]/edit`) avec
régénération audio + timeline multi-episodes liés. Mergé le 13/05/2026 via
PR #267.

Le 14/05/2026, pendant la reprise W18-A (correction des 3 synthèses W18 puis
régénération du journal `3ccebf3e`), Dr Fantin détecte un bug fonctionnel :
les corrections de synthèses ne se propagent pas au podcast final. L'audio
ElevenLabs est régénéré, mais sur l'ANCIEN `script_md`. Cause racine :
`regenerate-linked-episodes` n'appelle pas `generate-script`.

Patch T12-D-bis-3 livré le 14/05 en 3 commits (A backend, B frontend, C docs)
sur la branche `claude/fix-journal-regeneration-TjWpa`. Smoke critique
validé MCP : propagation correction synthèse → script journal → audio
podcast → écoute aurifère du nouveau chiffre.

---

## 2. Commits T12-D-bis-3

| Commit | Sha | Fichier | Description |
|---|---|---|---|
| T12-D-bis-3-A | `c630f5c` | `src/app/api/admin/news/journal/[id]/generate-script/route.ts` | Flag `?regenerate=true` + body optionnel avec fallback BDD |
| T12-D-bis-3-B | `6361c9b` | `src/components/admin/news/EpisodeRegenerationPanel.tsx` | Orchestration script→audio côté client, toast multi-phases, mitigation `partial_success` |
| T12-D-bis-3-C | _(ce commit)_ | `RAPPORT_T12_*.md` + ce fichier | Documentation patch post-livraison |

---

## 3. Smoke validé post T12-D-bis-3

### 3.1 Régression contrat T12-D-bis-3-A (backend, après push commit A)

- **Cas 2** : `POST .../generate-script` sans flag sur journal `archived` → 409 avec message `"... (utiliser ?regenerate=true pour bypass)"` ✓
- **Cas 3** : `POST .../generate-script?regenerate=true` sur journal `archived` → 200, `script_md` régénéré, paramètres retournés correctement ✓
- **Cas 4 critique** : `POST .../generate-script?regenerate=true` avec body `{}` sur journal `archived` → 200, `script_md` régénéré, **4 colonnes fallback BDD préservées** (format=monologue, narrator=martin, target_duration_min=3, editorial_tone=standard), status `archived` préservé, published_at `null` préservé, audio_url inchangé ✓
- **Cas 1** : path initial publish draft sans flag — non testé en smoke réel (pas de fixture draft disponible), validé par lecture diff (pattern identique POC-T12-D-1). Dette `D-T12-D-REGEN-REGRESSION` couvre ce cas.

### 3.2 Cas critique post T12-D-bis-3-B (propagation correction synthèse → podcast journal)

- Édition synthèse `f689c88b` (Antibioprophylaxie) : `key_figures[4]` `"10 jours..."` → `"14 jours..."`. `last_edited_at = 14:51:56` MCP-confirmé.
- Régénération depuis EpisodeRegenerationPanel sur journal `3ccebf3e`. Toast multi-phases observé par Dr Fantin (script → audio + timeline → succès).
- Vérif MCP post-smoke :
  - `script_md` md5 `ef198a2b...` → `e6f64532...` (régénéré) ✓
  - `script_md` contient `"14 jours"` position 3399 (zone Antibioprophylaxie) ✓
  - `script_md` ne contient plus `"10 jours"` position 0 ✓
  - status `archived` préservé, published_at `null` préservé ✓
  - 4 colonnes fallback BDD préservées ✓
  - `audio_url` même path (overwrite Storage), taille 5,8 Mo → 6,46 Mo (script plus long) ✓
  - updated_at `14:56:15` ✓
- Vérif Storage : MP3 overwritten à 14:56:13, timeline JSON nouvelle (12 017 octets), 4 archives historiques empilées dans `_archive/` (cohérent T12-D-1) ✓

### 3.3 Cas mitigation `partial_success`

Non testé en smoke réel (simulation échec audio complexe en preview, nécessite désactivation `ELEVENLABS_API_KEY` côté Vercel). Validé par lecture code uniquement. Dette `D-T12-D-bis-3-MITIGATION-PARTIAL-NOT-TESTED`.

---

## 4. Architecture livrée T12-D-bis-3

### 4.1 Backend (`generate-script` journal)

- Flag `?regenerate=true` (pattern identique POC-T12-D-1 sur generate-audio).
- Précondition `episode.status !== 'draft'` conditionnée par `!isRegenerate`.
- Body optionnel : si mode regenerate ET champ absent du body → fallback sur la valeur BDD existante de l'episode pour `format`, `narrator`, `target_duration_min`, `editorial_tone`.
- `editorial_notes` reste **éphémère par design** (RECAP T7 v1.3) — jamais persisté en BDD, donc jamais de fallback, toujours `null` par défaut.
- SELECT episode élargi pour récupérer les 4 colonnes de fallback (une seule query, +4 colonnes lues).
- UPDATE in-place inchangé — préserve `status`, `published_at`, `audio_url`, `validated_by`.

### 4.2 Frontend (EpisodeRegenerationPanel)

- Map `episode_id → type` construite localement depuis `data.insight` et `data.journals` (pas de query supplémentaire).
- Branchement par type d'episode dans `onRegenerate()` :
  - **journal** : 2 appels client séquentiels —
    1. `POST /api/admin/news/journal/[id]/generate-script?regenerate=true` avec body `{}` → fallback BDD côté serveur.
    2. Si OK → `POST /api/admin/news/journal/[id]/generate-audio?regenerate=true`.
    3. Si script KO → push `error`, skip phase 2, continue batch.
    4. Si script OK mais audio KO → push `partial_success` avec toast d'erreur explicite "⚠️ Script régénéré mais audio non resync. Recliquer 'Régénérer' pour resynchroniser l'audio."
  - **insight/digest** : path inchangé via `regenerate-linked-episodes`. Workflow manuel script preservé (cf. dette `D-T12-INSIGHT-MANUAL-WORKFLOW`).
- Toast multi-phases côté UI : `"k/N — journal: script en cours…"` puis `"k/N — journal: audio + timeline en cours…"` puis `"Terminé : k/N succès"` (ou `"... k/N succès, p partiel(s)"` si `partial_success` détecté).
- Affichage résultats : ✓ vert pour `success`, ⚠️ amber pour `partial_success`, ✗ rouge pour `error`.

### 4.3 Pas de modification de `regenerate-linked-episodes`

L'orchestrateur backend `POST /api/admin/news/syntheses/[id]/regenerate-linked-episodes` reste inchangé : il continue de servir le path insight/digest (audio seulement). Le path journal le bypass désormais côté client.

**Alternative envisagée et rejetée** : étendre l'orchestrateur pour chaîner script+audio backend-side. Rejetée car incompatible avec la demande de toast multi-phases (granularité perdue). À refactor en T13 avec helper audio partagé + SSE/polling (cf. dette `D-T12-D-bis-3-CLIENT-ORCHESTRATION`).

---

## 5. Décisions tranchées Dr Fantin pendant T12-D-bis-3

1. **Scope insight** : journal uniquement en V1, insight reste manuel 2-temps. Dette `D-T12-INSIGHT-MANUAL-WORKFLOW` documentée.
2. **Libellé bouton** : "Régénérer script + audio + timeline" + warning enrichi + toast multi-phases 2 étapes (script → audio+timeline, timeline non séparable car incluse dans generate-audio).
3. **Body optionnel** : option (b) du plan retenue — modifier backend pour rendre le body optionnel et fallback BDD plutôt que fetch préalable côté client.
4. **Mitigation échec partiel** : ajouter statut `partial_success` côté client + toast explicite plutôt que retry automatique (admin doit décider de recliquer manuellement).
5. **Séquencement** : 3 commits séparés A→B→C avec validation Vercel + smoke entre chaque, pas de batch.

---

## 6. Documentation produite

- `/root/.claude/plans/prompt-t12-d-bis-3-r-g-n-ration-purring-lighthouse.md` — plan validé Dr Fantin via ExitPlanMode après 3 précisions intégrées.
- `RAPPORT_T12_NEWS_SYNTHESIS_EDITOR.md` §10 — chronologie T12-D-bis-3 + §11 apprentissage audit v3.
- `RAPPORT_T12_NEWS_SYNTHESIS_EDITOR.md` §5 — dette enrichie (4 nouvelles dettes).
- Ce fichier — RECAP_SESSION T12 avec contexte session 13/05 + 14/05.

---

## 10. Dette consolidée

Reprise depuis `RAPPORT_T12_NEWS_SYNTHESIS_EDITOR.md` §5 + ajouts T12-D-bis-3.

### Cosmétique non-bloquant (T12 d'origine)

- `D-T12-A-01` — Field `theme` (singulier) au lieu de `themes` (pluriel) dans payload erreur PATCH.
- `D-T12-A-02` — `display_title` trailing whitespace à trimmer server-side.
- ~~`D-T12-C-01`~~ / ~~`D-T12-CONTRAST-01`~~ — Résolus T12-D-bis-1/2.

### Architecture / méthodologie

- `D-T12-D-AUDIT-MISS` — Préconditions status manquées en audit T12 (résolu T12-D).
- **`D-T12-D-AUDIT-MISS-2`** *(nouvelle)* — Cascade script/audio manquée en audit T12 (résolu T12-D-bis-3). 2e AUDIT-MISS consécutif → pattern audit pré-cadrage v3 à 6 dimensions formalisé (cf. §11 et `RAPPORT_T12.md` §11).
- `D-T12-D-REGEN-FLAG` — Pattern `?regenerate=true` à extraire dans helper audio partagé T13.
- `D-T12-D-REGEN-REGRESSION` — Test path première publication non joué en smoke, à couvrir T13.
- **`D-T12-D-bis-3-CLIENT-ORCHESTRATION`** *(nouvelle)* — Chaîne script→audio orchestrée côté client. Risque état incohérent si onglet fermé entre phases. Mitigation `partial_success` présente. À refactor backend en T13 avec SSE/polling.
- **`D-T12-INSIGHT-MANUAL-WORKFLOW`** *(nouvelle)* — Path insight conserve workflow manuel 2-temps. Asymétrie INSERT (insight) vs UPDATE (journal) à unifier en T13.
- **`D-T12-D-bis-3-MITIGATION-PARTIAL-NOT-TESTED`** *(nouvelle)* — Statut `partial_success` validé par lecture code uniquement. À couvrir lors du prochain incident ElevenLabs réel ou fixture mockée T13.
- `D-T12-MIG-01` — Migration `_down.sql` non testée sandbox.
- `D-T12-DARK-MODE` — `globals.css` force `color-scheme:dark`, pattern défensif texte/bg explicite obligatoire en admin.

### Données

- `D-TAX-01` — `news_taxonomy` thèmes trop restrictive (8 slugs). Prioritaire avant T13.
- `D-T12-W18` — W18-A traitée le 14/05 via T12 mergé. W18-B (7 synthèses cohorte PF1) reste à corriger en session dédiée Dr Fantin.
- `D-T12-EPISODES-ORPHAN` — 2 episodes coquilles `352e405e` + `0c2a9efe` à cleaner SQL DELETE post-merge ou T13.
- `D-T11-NAV-01` — Navigation cliquable "Au sommaire" → synthèse edit. Reste en attente, à bundler T13.

### Captures

- Smoke visuels à la charge de Dr Fantin sur preview Vercel (Claude Code sans navigateur interactif).

---

## 11. Apprentissages méthodologiques

### 11.1 Audit pré-cadrage v3 — pattern 6 dimensions

Après `D-T12-D-AUDIT-MISS-1` (préconditions status) + `D-T12-D-AUDIT-MISS-2` (cascade script/audio), formalisation du pattern audit pré-cadrage à 6 dimensions pour tout ticket de réutilisation d'endpoint existant :

1. **Préconditions** — `status`, auth, RBAC, payloads requis.
2. **Sémantique UPDATE downstream** — quelles colonnes BDD sont touchées, INSERT vs UPDATE.
3. **Helpers partagés** — couvert depuis audit v1→v2.
4. **Effets de bord cascade** — colonnes ou endpoints invalidés implicitement.
5. **Dependencies en amont** — endpoint A dépend-il qu'un endpoint B ait été appelé d'abord ?
6. **Cohérence multi-callers** — sémantique alignée entre insight, journal, autres types ?

Pré-flight obligatoire avant tout cadrage : 9 vérifications `G-SCRIPT-1` à `G-SCRIPT-9` (cf. plan T12-D-bis-3) exécutées via 3 agents Explore en parallèle. Le coût audit (~20 min de Claude exploration) est largement amorti par la prévention des trous AUDIT-MISS.

### 11.2 Plan mode + ExitPlanMode avec révisions

Pattern qui a bien fonctionné en T12-D-bis-3 :
- Phase 1 : audit 3 agents Explore parallèles.
- Phase 2 : plan structuré dans `/root/.claude/plans/...`.
- Phase 3 : ExitPlanMode → Dr Fantin rejette avec 3 précisions.
- Phase 4 : plan révisé in-place, ExitPlanMode → approuvé.
- Phase 5 : implémentation séquentielle A→B→C avec smoke entre chaque commit.

Évite les retours en arrière coûteux. À reproduire pour tout ticket de patch post-livraison.

### 11.3 Séquencement commits avec validation intermédiaire

Pattern T12-D-bis-3 : Commit A (backend) → push → Vercel build READY → smoke régression contrat MCP → si OK, Commit B (frontend) → push → smoke critique → si OK, Commit C (docs) + PR.

Bénéfice : si un commit échoue au build ou au smoke, la régression est isolée (pas de "tout ou rien"). Coût : 2-3 builds Vercel au lieu d'1, acceptable vu la valeur.

---

## 12. État de livraison T12-D-bis-3

- ✅ Branche `claude/fix-journal-regeneration-TjWpa` à jour avec 3 commits (A `c630f5c` + B `6361c9b` + C).
- ✅ Backend type-check : 0 régression réelle (erreurs préexistantes liées à environnement Claude Code sans `@types/node` chargés, Vercel build clean).
- ✅ Smoke régression contrat T12-D-bis-3-A OK (MCP-confirmé cas 2/3/4).
- ✅ Smoke critique T12-D-bis-3-B OK (propagation correction synthèse → script journal → audio podcast vérifiée MCP + Storage).
- ⏳ PR ouverte vers `main` (créée dans la foulée de ce commit C).
- ⏳ Merge manuel par Dr Fantin après lecture du rapport et review PR.
- ⏳ Post-merge : reprise dette `D-T12-W18` (W18-B cohorte PF1) en session dédiée Dr Fantin.
