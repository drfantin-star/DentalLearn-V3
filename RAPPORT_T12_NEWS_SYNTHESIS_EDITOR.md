# RAPPORT POC-T12 — Éditeur admin synthèse News + régénération audio/timeline

**Statut** : ✅ Livré T12 le 13/05/2026, ✅ Patch T12-D-bis-3 livré le 14/05/2026 (régénération script journal — cf. §10).
**Date** : 13 mai 2026 (T12) + 14 mai 2026 (T12-D-bis-3)
**Branche T12** : `claude/t12-news-synthesis-editor-v1` (mergée `main` via PR #267)
**Branche T12-D-bis-3** : `claude/fix-journal-regeneration-TjWpa`
**Commits** : 9 commits T12 + 3 commits T12-D-bis-3 (A backend, B frontend, C docs)

---

## 1. Synthèse exécutive

T12 livre le **chaînon manquant entre ingestion Sonnet et publication journal/episode** : un éditeur admin pleine page permettant de corriger une synthèse news en 5 min (texte + taxonomie + catégorie éditoriale) et de régénérer audio + timeline dans la foulée si la synthèse est déjà liée à un episode publié/archived.

T12 débloque T9 (boucle de feedback beta testeurs) en rendant les feedbacks éditoriaux ("cette synthèse est fausse", "ce chiffre est faux", "ce thème ne va pas") traitables entre 2 vagues, ce qui était impossible jusqu'au 12/05/2026.

**Périmètre livré V1** :
- Édition manuelle de 11 champs `news_syntheses` (display_title, summary_fr, method, key_figures, evidence_level, clinical_impact, caveats, specialite, themes, niveau_preuve, category_editorial)
- Validation slug taxonomy active type-aware côté serveur (rejet 400 explicite)
- Audit log soft (`last_edited_at` + `last_edited_by`) mis à jour à chaque PATCH
- Régénération audio + timeline multi-episodes liés, séquentielle stricte avec status/published_at préservés

**Hors périmètre V1** (reportés post-POC) :
- Régénération depuis Sonnet (LLM re-prompt avec abstract enrichi) — T12-bis ou T5-bis ingestion
- Audit log complet (table dédiée) — D-T12-02
- Rôle "éditeur scientifique / comité scientifique" — D-T12-03
- Workflow publication propre `ready_for_review` — T13 dédié
- `keywords_libres` édition — D-T12-05
- Responsive mobile éditeur — D-T12-06

---

## 2. Décisions ad hoc tranchées

5 décisions tranchées par Dr Fantin avant code (Q-T12-5 supprimée — déjà satisfaite par invariant `isSuperAdmin()` déployé partout) :

| Question | Décision retenue | Justification |
|---|---|---|
| Q-T12-1 | (a) Page dédiée `/admin/news/[id]/edit` | Séparation lecture/édition la plus lisible, cohérence pattern T11 journal |
| Q-T12-2 | (a)+(b)+`category_editorial` | Bloc texte + bloc taxonomy + radio category. `keywords_libres` + `formation_category_match` reportés/séparés |
| Q-T12-3 | (a) Bouton "Régénérer depuis Sonnet" ABSENT en V1 | Édition manuelle suffit pour débloquer T9 (15 min sur 3 synthèses W18). Régénération LLM = T12-bis |
| Q-T12-4 | (a) Visible si ≥1 episode published/archived + (iii) picker checkboxes séquentiel | Pas d'auto-régénération sur tous les liens, l'admin choisit |
| ~~Q-T12-5~~ | **Invariant satisfait** : `isSuperAdmin()` déjà sur 18+ routes `/api/admin/news/*` | Aucune migration auth nécessaire (audit v1→v2 phase 2) |
| Q-T12-6 | (b) Audit soft (2 colonnes additives `last_edited_at` + `last_edited_by`) | Coût minimal, bénéfice immédiat. Table d'audit complète reportée post-POC |

---

## 3. Architecture livrée

### 3.1 Migration BDD (1 migration additive)

`supabase/migrations/20260513_t12_news_syntheses_audit_soft.sql` + `_down.sql` :
- `ALTER TABLE news_syntheses ADD COLUMN last_edited_at timestamptz NULL`
- `ALTER TABLE news_syntheses ADD COLUMN last_edited_by uuid NULL REFERENCES profiles(id) ON DELETE SET NULL`
- Index partiel `news_syntheses_last_edited_at_idx ON (last_edited_at DESC NULLS LAST) WHERE last_edited_at IS NOT NULL`
- Application via MCP Supabase `apply_migration`. 0 row impactée (197 synthèses pré-T12 conservent `last_edited_at = NULL` par défaut).
- 4 vérifs MCP post-apply OK : colonnes, FK ON DELETE SET NULL (`confdeltype = 'n'`), index, `UPDATE COUNT = 0`.

### 3.2 Endpoints API

| Méthode | Route | Statut | Note |
|---|---|---|---|
| PATCH | `/api/admin/news/syntheses/[id]` | **étendu T12-A** | Schema Zod additif, validation taxonomy slug, audit `last_edited_*`, rétro-compat `formation_category_match` strict |
| GET | `/api/admin/news/taxonomy?type=specialite\|theme\|niveau_preuve` | **nouveau T12-B** | Liste slugs + labels FR actifs, tri par label |
| GET | `/api/admin/news/syntheses/[id]/linked-episodes` | **nouveau T12-D-2** | 2 jointures distinctes (`news_episode_items` insight + `news_episode_syntheses` journal), filtre status published/archived |
| POST | `/api/admin/news/syntheses/[id]/regenerate-linked-episodes` | **nouveau T12-D-2** | Orchestration séquentielle, body `{ episode_ids: uuid[].max(20) }`, maxDuration 300s |
| POST | `/api/admin/news/episodes/[id]/generate-audio` | **étendu T12-D-1** | Flag `?regenerate=true` skip status check + skip UPDATE status/published_at/validated_by. Défaut byte-identique pré-T12 |
| POST | `/api/admin/news/journal/[id]/generate-audio` | **étendu T12-D-1** | Idem |

Tous endpoints sous `isSuperAdmin()` (invariant `/api/admin/news/*`).

### 3.3 Page admin

`src/app/admin/news/[id]/edit/page.tsx` (Server Component, 91 lignes) :
- Fetch synthèse + raw + display name de `last_edited_by` via `user_profiles` (best-effort)
- Auth `isSuperAdmin()`, redirect si non-admin
- Délégation rendering au Client Component `<SynthesisEditForm>`

### 3.4 Composants client (4 nouveaux)

| Composant | Fichier | Lignes | Rôle |
|---|---|---|---|
| `SynthesisEditForm` | `src/components/admin/news/SynthesisEditForm.tsx` | ~680 | Form complet layout M1 finale (sidebar sticky 360px + drawer fallback < 1280px), dirty check strict, diff payload PATCH |
| `TaxonomyPicker` | `src/components/admin/news/TaxonomyPicker.tsx` | ~270 | Custom, zéro npm. Single `<select>` natif + Multi chips + dropdown filtrable custom |
| `KeyFiguresEditor` | `src/components/admin/news/KeyFiguresEditor.tsx` | ~105 | Liste ordonnée ↑↓×+, pattern T11 journal |
| `EpisodeRegenerationPanel` | `src/components/admin/news/EpisodeRegenerationPanel.tsx` | ~325 | Picker checkboxes + bouton régénération + toast progression "k/N" séquentiel, section entièrement cachée si 0 episode lié |

Patch additionnel sur page détail existante : +5 lignes sur `src/app/admin/news/[id]/page.tsx` pour bouton "Modifier la synthèse" (toujours under seuil ≤5).

### 3.5 Récapitulatif diff total

| Type | Compte |
|---|---|
| Fichiers nouveaux | 11 (1 migration UP + 1 migration DOWN + 4 endpoints + 1 page + 4 composants) |
| Fichiers modifiés | 3 (PATCH route extension T12-A + 2 routes generate-audio flag T12-D-1) + 1 page détail (+5 lignes) |
| Total commits | 9 sur `claude/t12-news-synthesis-editor-v1` |

---

## 4. Smoke validé

| Phase | Cas | Résultat |
|---|---|---|
| Migration | 4 vérifs MCP (colonnes, FK ON DELETE SET NULL, index, UPDATE COUNT=0) | ✅ |
| T12-A | 9 étapes fetch DevTools sur fixture `aa37895f` (GET initial, 6 PATCH régression+OK+3×400+vide, restore, GET final) | ✅ |
| T12-B | Validé par usage T12-C (composants intégrés à la page édition) | ✅ |
| T12-C | Cas (a) accès page, (d) picker themes multi, (g) footer "Dernière modif", (h) section régénération cachée | ✅ |
| T12-D-1 | Régression byte-perfect par lecture diff (branches `if (!isRegenerate)` isolées) | ✅ par diff |
| T12-D-2 | Validé par usage T12-D-3 | ✅ |
| T12-D-3 | Cas (vii-1) insight visible, (vii-2) journal visible, (vii-3) régénération réelle multi, (vii-cache) section cachée sur W18-B | ✅ |
| T12-D-3 réel | Régénération episode `0c2a9efe` (insight aa37895f) → audio créé Storage `news-audio/0c2a9efe-....mp3` 2,29 Mo, status `archived` préservé, `published_at = null` préservé, `updated_at` mis à jour à 12:35:22 | ✅ MCP-confirmé |
| T12-D-bis-1/2 | Lisibilité contraste sur tous les éléments page édition | ✅ |

---

## 5. Dette technique (à reprendre post-merge)

### Cosmétique non-bloquant

- **`D-T12-A-01`** — Field `field='theme'` (singulier) retourné dans payload erreur PATCH au lieu de `'themes'` (pluriel, nom de colonne BDD). Cosmétique. À aligner dans un futur commit (T13 ou ticket dédié).
- **`D-T12-A-02`** — `display_title` peut contenir trailing whitespace après édition admin (observé sur fixture Dahl `8b3cf1dc` : "...meuler " avec 2 espaces fin). Ajouter `.trim()` server-side dans le PATCH Zod. Cosmétique, non bloquant.
- **`D-T12-C-01`** — Contraste menus déroulants `<select>` natifs illisibles. **✅ RÉSOLU** par T12-D-bis-1.
- **`D-T12-CONTRAST-01`** — Contraste étendu T12-C/T12-D root cause `globals.css color-scheme:dark`. **✅ RÉSOLU** par T12-D-bis-2.

### Architecture / méthodologie

- **`D-T12-D-AUDIT-MISS`** — Audit v1→v2 §3 pt 4 a vérifié la parité archive Storage entre endpoints generate-audio (insight + journal) mais PAS les préconditions status (insight `!== 'ready'` → 409, journal `!== 'draft'` → 409). Le trou a été détecté en début T12-D et résolu par option B (flag `?regenerate=true`). **Apprentissage rituel session** : à chaque audit pré-cadrage de réutilisation d'endpoint existant, vérifier explicitement les préconditions status/auth/CRUD ET la sémantique des UPDATE downstream, pas seulement les helpers partagés.
- **`D-T12-D-AUDIT-MISS-2`** *(ajoutée T12-D-bis-3, 14/05)* — 2e trou d'audit consécutif sur T12-D : l'audit T12 a vérifié que generate-audio régénérait bien le MP3 ElevenLabs mais a manqué la **cascade script → audio**. L'orchestrateur `regenerate-linked-episodes` n'appelait pas `generate-script`, donc une correction de synthèse propagée à un journal published régénérait l'audio sur l'ANCIEN script_md. Bug détecté pendant reprise W18-A le 14/05. Résolu par T12-D-bis-3-A (flag `?regenerate=true` sur `journal/[id]/generate-script` + body optionnel fallback BDD) + T12-D-bis-3-B (orchestration script→audio côté client EpisodeRegenerationPanel). **Apprentissage durable** : pattern audit pré-cadrage v3 à 6 dimensions (préconditions, sémantique UPDATE, helpers, effets de bord cascade, dependencies amont, cohérence multi-callers) — cf. §11.
- **`D-T12-D-bis-3-CLIENT-ORCHESTRATION`** *(ajoutée T12-D-bis-3, 14/05)* — La chaîne script→audio pour journal en T12-D-bis-3-B est orchestrée côté client (browser fetch séquentiel : `generate-script?regenerate=true` puis `generate-audio?regenerate=true`). Si l'admin ferme l'onglet entre le succès de la phase 1 et le déclenchement de la phase 2, le journal reste en état incohérent (`script_md` nouveau + `audio_url` ancien). Acceptable V1 : warning explicite affiché, durée totale ~90s donc improbable de fermer. Mitigation présente : statut `partial_success` + toast amber "⚠️ Script régénéré mais audio non resync, recliquer pour resynchroniser". **À refactor côté serveur** dans le ticket T13 helper audio partagé (orchestration atomique backend, progress via SSE ou polling). Combiné avec `D-T12-D-REGEN-FLAG` ci-dessous.
- **`D-T12-INSIGHT-MANUAL-WORKFLOW`** *(ajoutée T12-D-bis-3, 14/05)* — Le patch T12-D-bis-3 résout la régénération du script pour les **journaux uniquement**. Le path insight single-synthèse conserve son workflow manuel 2-temps : (1) bouton "🔄 Régénérer le script" dans AudioPodcastBlock (page detail synthèse), (2) bouton "Régénérer audio + timeline" depuis T12 editor. Cause : l'endpoint `syntheses/[id]/generate-script` fait INSERT nouveau row + archivage de l'ancien (vs UPDATE in-place pour journal), donc l'orchestration script→audio nécessiterait de tracker le nouveau `episodeId` côté client + re-fetch des liens, asymétrie trop coûteuse pour V1. **À unifier** dans le ticket T13 helper audio partagé (option : convertir le path insight en UPDATE in-place lui aussi).
- **`D-T12-D-bis-3-MITIGATION-PARTIAL-NOT-TESTED`** *(ajoutée T12-D-bis-3, 14/05)* — Le statut `partial_success` (échec audio après succès script sur journal) est implémenté côté client mais **non testé en smoke réel** sur preview : simuler un échec ElevenLabs nécessite de désactiver la clé `ELEVENLABS_API_KEY` côté Vercel ou de mocker la lib. Validé uniquement par lecture de diff (branche `if (res.ok) { success } else { partial_success }` isolée). **À couvrir** lors du prochain incident ElevenLabs réel ou via fixture mockée dans le ticket T13 helper audio partagé.
- **`D-T12-D-REGEN-FLAG`** — Mode régénération exposé via flag querystring `?regenerate=true` sur les 2 endpoints generate-audio. Pattern temporaire choisi en T12 pour ne pas refactorer prod en fin de ticket. **T13 doit extraire la logique audio dans un helper partagé** (`src/lib/news-audio-regenerate.ts` ou équivalent) appelé par 3 callers : initial publish (T11 actuel), regenerate T12, republish T13. C'était l'option C de l'arbitrage T12-D v2, reportée pour préserver l'horizon court de T12.
- **`D-T12-D-REGEN-REGRESSION`** — Test régression path première publication (`status='ready' → published` insight, `status='draft' → published` journal) non joué en T12-D faute de fixture en ready/draft disponible. Validé indirectement par lecture diff (branches `if (!isRegenerate)` isolées, path par défaut byte-identique pré-T12). **À couvrir par smoke T13** quand le workflow publication produira naturellement des fixtures en `ready_for_review`.
- **`D-T12-MIG-01`** — Migration `_down.sql` écrite symétriquement (DROP INDEX → DROP COLUMN by → DROP COLUMN at, IF EXISTS partout) mais **non testée en sandbox** (Supabase CLI absente de l'environnement Claude Code). À valider à la première occasion de rollback réel ou en créant une branche dev Supabase via MCP `create_branch` puis `apply_migration` sur cette branche test.
- **`D-T12-DARK-MODE`** — `src/app/globals.css:17-20` force `color-scheme: dark` + body `color: #e5e5e5` + body `background: #0F0F0F`. Tout styling Tailwind qui repose sur inheritance casse en mode admin. Pattern défensif obligatoire dans T12 (et tout ticket admin futur) : `text-gray-X` + `bg-white` EXPLICITES sur chaque élément. **T13 ou refactor design system** devrait envisager soit (a) racine `.light` dans l'admin avec `color-scheme:light` + color/bg défauts clairs, soit (b) supprimer le forced dark de `globals.css` au profit d'un dark mode opt-in via media query ou classe parent.

### Données

- **`D-TAX-01`** — Taxonomy `news_taxonomy` thèmes actuelle **trop restrictive** (8 slugs au 13/05/2026 : aligneurs, apnee, bruxisme, endocrown, greffe-gencive, ids, peri-implantite, retraitement-endo). Aucun ne couvre les sujets W18 (full-mouth perio, antibioprophylaxie endocardite, encombrement enfant, sinus lift, alkasite, Dahl, hygiéniste scolaire). **Cause racine probable du tagging "ids" systémique W18 par Sonnet** : fallback pauvre quand aucun slug ne matche le sujet. **Prioritaire post-T12, avant T13** — sans extension, chaque ingestion future recrée le même biais. Cible : ~15-20 slugs nouveaux. Ticket dédié.
- **`D-T12-W18`** — Deux dettes éditoriales W18 distinctes à reprendre via T12 mergé :
  - **W18-A historique** : 3 synthèses (`095c6778` Full-mouth perio, `f689c88b` Antibioprophylaxie endocardite, `9696ec64` Encombrement enfant) liées au journal `3ccebf3e` archived. T12 corrige (themes/specialite/title) + bouton "Régénérer audio + timeline" sur le journal lié.
  - **W18-B ingestion** : 7 synthèses 04→11/05 (cohorte PF1 : `aa37895f`, `d4526b9f`, `1c791c3d`, `101992e6`, `08fd98dd`, `e5642798`, `8b3cf1dc`) toutes mal taggées `themes=["ids"]`, toutes en `status=draft/ready`. T12 corrige en édition simple sans régénération (panneau caché car 0 episode published/archived lié).
  - **Action post-merge** : session dédiée Dr Fantin pour corriger les 10 synthèses via éditeur T12. Estimation : 30 min total.
- **`D-T12-EPISODES-ORPHAN`** — 2 episodes coquilles créés pendant smoke T12-D-3 sur synthèse `aa37895f` : `352e405e` (draft, sans audio) + `0c2a9efe` (archived, audio régénéré 2,29 Mo Storage). À cleaner via SQL DELETE post-merge OU via UI T13 quand le workflow archivage sera propre. Ne PAS cleaner en T12-E (hors scope cosmétique).

### Captures

- **Dette captures** : Claude Code n'a pas de navigateur interactif. Tous les smoke visuels (T12-C cas a/d/g/h, T12-D-3 cas vii-*, T12-D-bis lisibilité) sont à la charge de Dr Fantin côté preview Vercel. Captures non livrées dans ce rapport, à fournir séparément si besoin pour archivage.

---

## 6. Tickets adjacents post-merge T12

| Ticket | Priorité | Description |
|---|---|---|
| **Reprise W18-A + W18-B** | 🔴 immédiate | Session dédiée Dr Fantin via éditeur T12 mergé. 10 synthèses, ~30 min |
| **D-TAX-01 extension taxonomy** | 🟠 avant T13 | Étendre `news_taxonomy` (~15-20 nouveaux slugs theme). Ticket dédié |
| **T13 — workflow publication** | 🟠 enchaîné T12 | Séparation "Générer" vs "Publier", `ready_for_review`, archivage propre, helper audio partagé (D-T12-D-REGEN-FLAG resolution) |
| **T5-bis ingestion** | 🟢 parallélisable | Fetch full abstract Cochrane via DOI. Indépendant |
| **Cleanup orphelins** | 🟢 ad-hoc | SQL DELETE des 2 episodes coquilles `352e405e` + `0c2a9efe`. À faire post-merge T12 ou en T13 |

---

## 7. Checklist §9 prompt v2 — intégrale

### Fonctionnels

- [x] Page `/admin/news/[id]/edit` accessible depuis `/admin/news/[id]` via bouton "Modifier la synthèse" (diff page parent = 5 lignes)
- [x] Tous les champs Q-T12-2 = (a)+(b)+`category_editorial` éditables
- [x] Pickers taxonomy alimentés via endpoint `/api/admin/news/taxonomy?type=...`
- [x] **Aucune dépendance npm ajoutée** (TaxonomyPicker, KeyFiguresEditor, EpisodeRegenerationPanel tous custom)
- [x] `display_title` rejeté côté serveur si > 70 chars (message "70 caractères max")
- [x] `summary_fr` rejeté si < 50 chars
- [x] Slugs taxonomy validés côté serveur (rejet 400 si inactif ou type incorrect)
- [x] `last_edited_at` + `last_edited_by` mis à jour à chaque PATCH (via session.user.id)
- [x] Panneau régénération visible uniquement si ≥1 episode published/archived lié
- [x] Régénération séquentielle stricte (pas `Promise.all`), toast progression "k/N", archive Storage `_archive/...` créée
- [x] Échec sur un episode = on continue le batch (pas d'abort)
- [x] Régénération T12 **ne modifie pas** le status de l'episode (confirmé MCP : `archived` reste `archived`, `published_at = null` préservé)

### Régression

- [x] PATCH `{ formation_category_match: ... }` continue à fonctionner exactement comme avant T12 (test 1 smoke T12-A)
- [x] Pages `/admin/news`, `/admin/news/pending`, `/admin/news/approved`, `/admin/news/failed`, `/admin/news/manual`, `/admin/news/journal/*` **inchangées** (5 lignes diff sur `/admin/news/[id]/page.tsx` pour bouton "Modifier", limite respectée)
- [x] `AudioPodcastBlock` (T7) inchangé
- [x] **Aucun contrôle de vitesse audio nulle part** (userpref absolue)
- [x] Auth `isSuperAdmin()` préservée sur tous les endpoints `/api/admin/news/*`

### BDD

- [x] Migration `20260513_t12_news_syntheses_audit_soft.sql` appliquée via MCP
- [x] `_down.sql` symétrique fonctionnel (non testé sandbox — D-T12-MIG-01)
- [x] Pas d'index sur colonnes texte longues
- [x] RLS `news_syntheses` inchangée (écritures via service role API)

### Documentation

- [x] `RAPPORT_T12_NEWS_SYNTHESIS_EDITOR.md` à la racine repo (ce fichier)
- [x] Dette technique exhaustive documentée (12 items)

---

## 8. Apprentissages méthodologiques

- **Audit v1→v2 pré-cadrage** — l'audit Phase 1 a correctement remonté 4 incohérences bloquantes (tables liaison, migration auth fictive, UI primitives, docs absents). Mais **a manqué les préconditions status** des endpoints generate-audio (D-T12-D-AUDIT-MISS). À reproduire systématiquement en début de chaque audit de réutilisation d'endpoint : grep `status !==` + `eq('status'` + précondition validations côté downstream.
- **Maquette M1 finale validée explicitement avant patch** — pattern T7.4-UX / T8 / T12 respecté strict, évite les itérations UX coûteuses post-code.
- **Commits granulaires** — T12-A/B/C/D-1/D-2/D-3/D-bis-1/D-bis-2 (9 commits) permettent une lecture git log claire, audit/rollback ciblé, smoke commit-by-commit.
- **Rituel "stop & remonter"** — application correcte du rituel à 2 reprises (T12-D blocker préconditions + T12-D-bis-2 root cause globals.css). Pas de décision unilatérale.
- **Dette captures sandbox** — Claude Code n'a pas de navigateur interactif, les smoke visuels sont systématiquement à la charge de Dr Fantin sur preview Vercel.

---

## 9. État de livraison

- ✅ Branche `claude/t12-news-synthesis-editor-v1` rebasée sur `origin/main` (post-PR #266 T3.5, 0 conflit)
- ✅ 9 commits granulaires lisibles dans le git log
- ✅ Migration BDD appliquée et vérifiée MCP
- ✅ Smoke T12-A à T12-D-bis-2 OK (cf. §4)
- ✅ PR #267 mergée sur `main`
- ✅ Patch T12-D-bis-3 livré le 14/05/2026 (cf. §10)

---

## 10. Patch T12-D-bis-3 post-livraison — régénération script journal manquante

### 10.1 Chronologie

- **14/05/2026 09:43** — Reprise dette `D-T12-W18` (W18-A) par Dr Fantin : corrections des 3 synthèses W18 liées au journal `3ccebf3e` (`095c6778`, `f689c88b`, `9696ec64`) via éditeur T12 mergé. `news_syntheses.last_edited_at` mis à jour pour les 3 synthèses.
- **14/05/2026 09:46** — Dr Fantin clique "Régénérer audio + timeline" depuis EpisodeRegenerationPanel sur le journal `3ccebf3e` (`status='archived'`). Toast "1/1 — Terminé" affiché.
- **14/05/2026 vérif MCP** — `news_episodes.audio_url` mis à jour (nouveau MP3 Storage), MAIS `news_episodes.script_md` identique au pré-T12 (md5 inchangé). Les corrections de synthèses sont invisibles dans le podcast final → bug fonctionnel confirmé.
- **14/05/2026** — Audit 9 points G-SCRIPT-1 à G-SCRIPT-9 exécuté à 100% via 3 agents Explore en parallèle. Scénario B confirmé : endpoint `journal/[id]/generate-script` existe avec sémantique UPDATE in-place correcte, mais rejette en 409 sur `status !== 'draft'`. Pattern flag `?regenerate=true` à étendre comme POC-T12-D-1 l'a fait pour generate-audio.
- **14/05/2026** — Plan validé Dr Fantin avec 3 précisions (mitigation `partial_success`, body optionnel fallback BDD, smoke cas 4 régression contrat).
- **14/05/2026 — Commit T12-D-bis-3-A** (`c630f5c`) — Backend `src/app/api/admin/news/journal/[id]/generate-script/route.ts` : flag `?regenerate=true` + précondition status conditionnée + body optionnel avec fallback BDD (format/narrator/target_duration_min/editorial_tone, `editorial_notes` reste éphémère).
- **14/05/2026 — Smoke régression contrat OK** : cas 2 (sans flag sur archived → 409), cas 3 (avec flag sur archived → 200), cas 4 critique (flag + body `{}` → 4 colonnes fallback BDD préservées, script_md mis à jour). MCP-confirmé.
- **14/05/2026 — Commit T12-D-bis-3-B** (`6361c9b`) — Frontend `src/components/admin/news/EpisodeRegenerationPanel.tsx` : titre/warning/bouton renommés "script + audio + timeline", `onRegenerate()` refondu avec branchement par type (journal = 2 appels client séquentiels avec toast multi-phases, insight/digest = path inchangé), mitigation `partial_success` (⚠️ amber-700 si script OK mais audio KO).
- **14/05/2026 14:56 — Smoke critique OK** : édition synthèse `f689c88b` (key_figures[4] "10 jours" → "14 jours") → régénération journal `3ccebf3e` depuis T12 UI → `script_md` du journal contient "14 jours" et ne contient plus "10 jours" (vérif MCP md5 + grep texte). status `archived` préservé, format/narrator/target_duration_min/editorial_tone préservés, audio_url overwritten Storage (5,8 Mo → 6,46 Mo), timeline JSON régénérée. **Bug T12-D-bis-3 résolu**.
- **14/05/2026 — Commit T12-D-bis-3-C** — Documentation : enrichissement du présent rapport + création RECAP_SESSION_T12_NEWS_SYNTHESIS_EDITOR_13MAI2026.md.

### 10.2 Cause racine

L'orchestrateur `POST /api/admin/news/syntheses/[id]/regenerate-linked-episodes` (livré T12-D-2) appelait uniquement `generate-audio?regenerate=true`, jamais `generate-script`. Pour un journal `published`/`archived`, aucun chemin UI existant ne permettait de régénérer le script (la page T11 admin journal masque le bouton "Régénérer le script" hors `status='draft'`).

Asymétrie identifiée : `journal/[id]/generate-script` fait **UPDATE in-place** (idéal pour régénération) tandis que `syntheses/[id]/generate-script` fait **INSERT + archivage de l'ancien episode** (asymétrie qui complique l'orchestration côté insight — d'où dette `D-T12-INSIGHT-MANUAL-WORKFLOW`).

### 10.3 Scope livré

| Item | Fichier | Type |
|---|---|---|
| Flag `?regenerate=true` + body optionnel + fallback BDD | `src/app/api/admin/news/journal/[id]/generate-script/route.ts` | Backend (Commit A) |
| Orchestration script→audio côté client + toast multi-phases + mitigation `partial_success` | `src/components/admin/news/EpisodeRegenerationPanel.tsx` | Frontend (Commit B) |
| Documentation post-livraison | `RAPPORT_T12_NEWS_SYNTHESIS_EDITOR.md` + `RECAP_SESSION_T12_NEWS_SYNTHESIS_EDITOR_13MAI2026.md` | Docs (Commit C) |

### 10.4 Hors scope (reporté T13)

- Unification du path insight (cf. `D-T12-INSIGHT-MANUAL-WORKFLOW`).
- Refactor orchestration script→audio côté serveur (cf. `D-T12-D-bis-3-CLIENT-ORCHESTRATION`).
- Smoke réel du statut `partial_success` (cf. `D-T12-D-bis-3-MITIGATION-PARTIAL-NOT-TESTED`).
- Précondition `status='active'` manquante côté `news_syntheses` dans le SELECT de `journal/[id]/generate-script` (cosmétique, géré par contrainte FK `ON DELETE RESTRICT`).

---

## 11. Apprentissage méthodologique — audit pré-cadrage v3 (6 dimensions)

Après 2 trous d'audit consécutifs sur T12-D (`D-T12-D-AUDIT-MISS-1` préconditions status + `D-T12-D-AUDIT-MISS-2` cascade script/audio), le pattern audit pré-cadrage T8 v2 est enrichi à 6 dimensions à vérifier systématiquement pour tout ticket de réutilisation d'endpoint existant :

1. **Préconditions** — `status`, auth, RBAC, payloads requis.
2. **Sémantique UPDATE downstream** — quelles colonnes BDD sont touchées, INSERT vs UPDATE.
3. **Helpers partagés** — déjà couvert (audit v1→v2).
4. **Effets de bord cascade** — colonnes / endpoints invalidés implicitement (ex: régénérer le script touche-t-il `audio_url` ? Non, mais on doit le savoir).
5. **Dependencies en amont** — l'endpoint A dépend-il qu'un endpoint B ait été appelé d'abord ? (ex: ici, `generate-audio` lit `script_md` mais ne le régénère pas).
6. **Cohérence multi-callers** — insight vs journal vs autres types : sémantique alignée ? (ex: INSERT vs UPDATE asymétrie révélée pendant T12-D-bis-3).

À reproduire pour T13 audit pré-cadrage et tout ticket futur impliquant réutilisation d'endpoint. Le coût audit est largement amorti par la prévention des trous AUDIT-MISS qui ont fait perdre du temps Dr Fantin entre le 13/05 et le 14/05.
