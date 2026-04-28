# RECAP Session — Ticket 4 News (Filtrage Claude Haiku)

**Date** : 27 avril 2026
**Branche** : `claude/news-section-filtering-weVWW` → mergée sur `main`
**Statut** : ✅ Validé et mergé

---

## 1. Périmètre livré

Edge Function `score_articles` qui score chaque article de `news_raw` non scoré via Claude Haiku, et marque `selected` si score ≥ 0.70 pour passer à la synthèse au Ticket 5.

### Composants livrés

| Fichier | Rôle |
|---|---|
| `supabase/functions/_shared/anthropic.ts` | Lib pure : client Anthropic Messages API avec retry/backoff exponentiel sur 429/5xx, helpers `extractTextContent()` et `parseJsonFromText()`. **Réutilisable Tickets 5/7**. |
| `supabase/functions/score_articles/index.ts` | Handler Deno.serve : load → tri cross-source → dedup pré-LLM → batch 10 → Haiku → parse retry × 3 → INSERT. Borne par invocation `{"limit": N}` après patch IDLE_TIMEOUT. |
| `supabase/functions/score_articles/deno.json` | Identique au pattern Tickets 2-3 |
| `supabase/migrations/20260427_news_score_articles_cron.sql` | `cron.schedule('news_score_articles','0 14 * * 1', …)` body `{"limit": 50}` |
| `supabase/migrations/20260427_news_score_articles_cron_down.sql` | Rollback symétrique |

### Cron actif (4 jobs hebdomadaires en place)

| jobname | schedule | description |
|---|---|---|
| `news_check_retractions` | `30 3 * * 1` | Lundi 03h30 UTC (Ticket 2) |
| `news_ingest_pubmed` | `0 4 * * 1` | Lundi 04h00 UTC (Ticket 2) |
| `news_ingest_rss` | `30 4 * * 1` | Lundi 04h30 UTC (Ticket 3) |
| **`news_score_articles`** | **`0 14 * * 1`** | **Lundi 14h00 UTC (Ticket 4)** |

Cadence hebdo complète pour la phase d'ingestion + filtrage.

### Validation live (backfill 504 articles)

| Status | Count |
|---|---|
| selected | 196 |
| candidate | 191 |
| duplicate | 224 |
| **Total lignes scorées** | **611** |

- Articles scorés via Haiku : 387 (les 224 duplicates n'ont pas d'appel API, dedup pré-LLM)
- spe_tags = NULL partout ✅ (arbitrage v1.3 respecté, tagging déplacé au Ticket 5)
- Coût total : **~0,45 €** (sous cible <0,50 €)
- Idempotence prouvée : `already_scored=504, candidates_loaded=0` au curl final

### Distribution scores selected

| Bucket | Count |
|---|---|
| 0.85-0.95 | 23 |
| 0.75-0.85 | 99 |
| 0.70-0.75 | 74 |

Aucun score à 1.00 — Haiku reste prudent, bon signe (pas de surconfiance).

---

## 2. Décisions arbitrées en début de session

Avant le démarrage du code, 3 questions tranchées :

| Q | Décision | Raison |
|---|---|---|
| Q1 — Articles sans abstract (RSS, HAS) | Scorer quand même sur titre + journal | Haiku intègre l'incertitude dans le score, on garde le signal pour les recos HAS et éditos BDJ. Coût marginal négligeable. |
| Q2 — Articles rétractés | Skip (option a) — exclus du SELECT initial | `raw_payload->>'retracted_at_ingestion' = 'true'` détecté trivialement, pas d'appel Haiku, pas d'INSERT. Économie + clarté. |
| Q3 — Dedup cross-source | PubMed-first : `published_at DESC NULLS LAST → source.type='pubmed' first → ingested_at ASC` | Quand 2 articles partagent le même `dedupe_hash`, la version PubMed gagne (DOI fiable, abstract complet), les autres → `status='duplicate'`. |

Décisions complémentaires intégrées dans le prompt Code :
- Modèle figé : `claude-haiku-4-5-20251001` (override possible via `NEWS_HAIKU_MODEL`)
- Seuil figé : 0.70 (override via `NEWS_SCORE_THRESHOLD`)
- Batch size : 10 articles par appel API
- Sortie Haiku minimale : `score + reasoning + dedupe_hash` (pas de tagging 3D — déplacé au Ticket 5 par v1.3 §6.3)
- Lib partagée `_shared/anthropic.ts` à créer pour réutilisation Tickets 5/7

---

## 3. Itérations / corrections (4 patches en cascade)

### PATCH 1 — IDLE_TIMEOUT (limite 150s Edge Functions Supabase)

**Symptôme** : 1er run du backfill → la fonction est tuée par Supabase à 150s côté gateway, mais la worker continue en orphelin et insère des données.

**Cause racine** : volume sous-estimé. Code prévoyait ~265 articles, en réalité 504 (411 PubMed + 93 RSS, le double cron PubMed des semaines précédentes avait gonflé `news_raw`). À ~12s par batch Haiku, ça fait ~10 min nécessaires soit 4× la limite.

**Fix** : 
- Body POST `{"limit": N}` optionnel (default 50, configurable via env `NEWS_SCORE_BATCH_LIMIT`)
- Slice côté run() après le tri global (cohérence cross-source préservée par `existing_hashes` BDD rechargé)
- RunSummary enrichi : `limit_applied`, `total_remaining_estimate`, `has_more`
- Cap silencieux à 200 max (log warn `limit_capped`) pour éviter qu'un appel manuel trop ambitieux ne re-déclenche le timeout
- Migration cron mise à jour : body `{"limit": 50}`

### PATCH 2 — Variable shell vide

**Symptôme** : la boucle de backfill renvoie tous les champs JSON à `null`. Le serveur scorait correctement, mais le caller voyait du vide.

**Cause racine** : `unset SERVICE_ROLE_KEY` après le 1er test avait nettoyé la variable. Le `read -s SUPABASE_SERVICE_ROLE_KEY` de relance a été oublié dans la copie. Header `Authorization: Bearer ` (vide après "Bearer") → 401 silencieux côté Supabase.

**Fix** : ré-injection de la clé via `read -s`, vérification avec `echo "${#SUPABASE_SERVICE_ROLE_KEY}"`.

### PATCH 3 — Migration cron oubliée par Code

**Symptôme** : le fichier `_score_articles_cron.sql` contenait toujours `body := '{}'::jsonb` au lieu de `{"limit": 50}`.

**Cause racine** : Code a annoncé dans son diff résumé qu'il avait mis à jour la migration cron, mais en réalité le commit n'a pas été produit (oubli côté Code). Vérification via `git log -p` : 1 seul commit historique, sans modification du body.

**Fix** : patch manuel via `sed`, commit local, push.

→ Mais entre-temps Code avait pushé son patch correct (`6ee3885`) après avoir redécouvert l'oubli, donc collision de fix au push. Reset `--hard` sur la version Code (plus complète, avec commentaires explicatifs au-dessus du body).

### PATCH 4 — Bug critique enum `point_reason` découvert en cours de nettoyage

**Hors scope Ticket 4 mais découvert dans le nettoyage final des branches**.

**Symptôme** : la branche `claude/remove-preview-mode-YaAZL` contenait un commit orphelin (`6f0962f`) jamais mergé depuis le 22 avril 2026 :
```diff
- reason: 'sequence_completed',
+ reason: 'perfect_sequence',
```

**Cause racine** : `'sequence_completed'` n'existe pas dans l'enum BDD `point_reason`. À chaque fin de séquence, l'INSERT dans `user_points` plantait silencieusement (logué dans `pointsErr` ignoré par le hook). Bug en prod depuis 5 jours.

**Impact mesuré** : 0 perte effective. Dr Fantin était la seule user et n'a complété aucune séquence dans cette fenêtre. Mais le risque sur un beta-tester était réel.

**Fix** : cherry-pick du commit `6f0962f` directement sur `main`, build Vercel vert, fix en prod.

---

## 4. Validation live (post-patches)

### Critères d'acceptation Ticket 4

| Critère | État |
|---|---|
| Edge Function `score_articles` créée et déployée | ✅ v2 |
| Lib partagée `_shared/anthropic.ts` réutilisable | ✅ |
| Insertion dans `news_scored` pour tous les `news_raw` non scorés | ✅ 504/504 traités |
| Champs persistés : `relevance_score`, `reasoning`, `dedupe_hash`, `status`, `llm_model`, `scored_at` | ✅ |
| `spe_tags` reste NULL (arbitrage v1.3) | ✅ 0 ligne avec spe_tags |
| `status='selected'` si score ≥ 0.70 (configurable env) | ✅ |
| `status='duplicate'` si dedupe_hash déjà présent | ✅ 224 duplicates trackés |
| Batch size : 10 articles / appel Anthropic | ✅ |
| Idempotence : 2 runs consécutifs ⇒ 0 nouvelle insertion | ✅ `already_scored=504, candidates_loaded=0` |
| Rate-limit Anthropic respecté (retry/backoff sur 429, max 3) | ✅ aucune erreur 429 |
| JSON parsing robuste (retry × 3, fallback gracieux) | ✅ `parse_failed=0` |
| Coût total <0,50 € | ✅ ~0,45 € |
| Cron lundi 14h00 UTC (figé spec v1.3 §4.4) | ✅ |
| Logs structurés | ✅ `run_start`, `inputs_loaded`, `batch_scored`, `parse_retry`, `article_failed`, `run_complete` |
| **Bonus IDLE_TIMEOUT** | ✅ Body `{"limit": N}` borné par invocation |

### Qualité du scoring Haiku — top 10 selected (échantillon)

| Score | Sujet | Journal |
|---|---|---|
| 0.90 | Diabète et thérapie parodontale | Int J Dent Hygiene |
| 0.88 | Biomatériaux paro chirurgicale | J Clin Periodontol |
| 0.88 | Composites Classe II | Med Sci Monit |
| 0.88 | Tabagisme et perte dentaire | J Clin Periodontol |
| 0.88 | Alerte HAS prescriptions médicamenteuses | HAS |
| 0.88 | Antibiotiques systémiques en paro | J Clin Periodontol |
| 0.88 | Pronostic dents fissurées (cracked teeth) | J Dentistry |
| 0.88 | Laser diode et restaurations cervicales | J Dentistry |
| 0.85 | Protocoles péri-implantite | J Clin Periodontol |
| 0.85 | Microchirurgie endodontique | Int Endod J |

→ Méta-analyses, RCT, cohortes robustes, alerte HAS pertinente. Aucun faux positif visible.

### Qualité du rejet — bottom 5 candidates (score < 0.30)

Tous à 0.05 :
- Incontinence urinaire (×3 — note de cadrage HAS)
- Article littéraire sur le romantisme
- Étude zoologique sur les tortues serpentines

→ Aucun faux négatif visible. Haiku rejette correctement les sujets hors champ dentaire.

---

## 5. Leçons techniques pour les prochains tickets

### Lz1 — IDLE_TIMEOUT 150s sur Edge Functions Supabase

Les Edge Functions Supabase ont un timeout gateway à 150s. **À ne jamais sous-estimer pour un job LLM en batch**. La worker peut continuer en orphelin après le timeout HTTP côté caller, mais c'est de la chance, pas du design.

**Pattern à reproduire pour Tickets 5 et 7** : tout job LLM en batch doit accepter un body POST `{"limit": N}` qui borne le nombre d'éléments par invocation, avec :
- default raisonnable (50 max si Sonnet à ~5s/élément, à recalculer pour Sonnet vs Haiku)
- cap silencieux (200) pour protéger d'un appel ad-hoc trop ambitieux
- compteurs `total_remaining_estimate` + `has_more` dans la réponse pour piloter la boucle côté caller
- cron en régime stationnaire envoie un body explicite (pas `{}` qui dépend du default Deno)

### Lz2 — Hygiène secrets côté shell

Le pattern `read -s VAR_NAME` + `unset VAR_NAME` après usage est solide, mais il faut **vérifier la longueur de la variable avant chaque usage** :

```bash
echo "Longueur clé : ${#SUPABASE_SERVICE_ROLE_KEY}"
```

→ Si 0, la variable a été nettoyée et le `curl` partira avec un header `Authorization: Bearer ` vide. Symptôme insidieux : le serveur retourne 401 mais le `curl -s` masque l'erreur, et `jq` extrait `null` partout sans message clair.

### Lz3 — Vérifier les commits orphelins avant de supprimer une branche

Avant de supprimer une branche non mergée, **toujours** lancer :

```bash
git log origin/main..origin/branche-name --oneline
git show <sha> --stat
```

Cas observé sur `claude/remove-preview-mode-YaAZL` : 1 commit orphelin (`6f0962f`) qui contenait un fix critique enum `point_reason` jamais mergé. La branche s'appelait "remove-preview-mode" mais son commit unique faisait juste le fix enum. Sans inspection, on aurait perdu 1 ligne de code qui empêche un bug en prod.

→ **Pattern Git Code** : Code peut commiter un fix correct sur une branche puis oublier de pousser/merger la PR. Vérification systématique requise avant suppression.

### Lz4 — `user_points` sans trigger ni RPC

Confirmé via `information_schema.triggers` et `information_schema.routines` : aucun trigger ni RPC n'écrit dans `user_points`. Le hook JS `useSubmitSequenceResult` (`src/lib/supabase/hooks.ts:387-397`) est la **seule source d'écriture**. Toute modif du système de points doit passer par ce hook.

### Lz5 — Code peut annoncer des modifs non commitées

Cas observé : Code a annoncé dans son diff résumé qu'il avait modifié la migration cron pour `{"limit": 50}`, mais en réalité le commit n'a jamais été produit. **Toujours vérifier `git log -p <fichier>` avant de faire confiance au diff résumé Code**.

---

## 6. Risques et points ouverts

### Suivi à mettre en place

- **Lundi 4 mai 2026 — 1er cron réel** : vérifier que le run automatique de `score_articles` fonctionne après le pipeline d'ingestion matinal. Compter les nouveaux articles scorés (devrait être ~30-50/sem en régime stationnaire).
- **Sur les premiers cron** : surveiller le coût hebdo Haiku via les logs `run_complete.estimated_cost_eur`. Cible <2 €/sem (cf. spec v1.3 §9).
- **Backlog dev** : les `[fallback dedup race]` dans le `reasoning` des duplicates suggèrent que la dédup pré-LLM via `existing_hashes` n'attrape pas toujours les collisions intra-batch. Comportement actuel correct (race condition gérée par INSERT defensif), mais à monitorer si le ratio race augmente.

### Dette technique reportée

- Les 3 migrations BDD v1.3 (épisodes format, syntheses categories cover, questions news link) restent à appliquer **avant le Ticket 5**. Cf. `addendum_handoff_claude_code_v1_3.md` §1.
- Variable d'env `OPENAI_API_KEY` à ajouter avant Ticket 5 (embeddings `text-embedding-3-small` pour la KB).

---

## 7. Repo Git — grand nettoyage

En clôture de session, suppression des branches mergées :
- **101 branches mergées** supprimées en masse (toutes les branches Claude Code des semaines précédentes : EPP, redesign Netflix, fixes audio, attestations PDF, etc.)
- **3 branches non mergées** triées au cas par cas :
  - `add-image-support-reward-k61GR` : fix MIME types bucket Storage déjà appliqué côté Supabase → suppression
  - `generate-pdf-attestations-xMNKL` : fix Helvetica TTF caduc (jspdf a remplacé pdfkit) → suppression
  - `remove-preview-mode-YaAZL` : fix enum `point_reason` cherry-pické sur main → suppression après cherry-pick

État final : 1 seule branche `main` côté distant et local. Repo propre.

---

## 8. Prochaine étape : Ticket 5

**Synthèse + tagging 3D + tagging éditorial + display_title + 3-4 questions quiz + embedding** — un seul appel Sonnet par article sélectionné.

C'est **le plus gros ticket de la Phase 1** (cf. spec v1.3 §6.4 et addendum v1.3 §3 — Ticket 5 RÉVISÉ). Trois pré-requis avant de coder :

1. **3 migrations BDD v1.3 à appliquer** (cf. `addendum_handoff_claude_code_v1_3.md` §1) :
   - `0010_news_v1_3_episodes_format.sql`
   - `0011_news_v1_3_syntheses_categories_cover.sql`
   - `0012_news_v1_3_questions_link.sql`

2. **Clé OpenAI** à provisionner pour les embeddings `text-embedding-3-small`

3. **Vérifier la taxonomy news en BDD** : la spec v1.3 §6.4 demande au LLM de choisir `specialite` parmi une liste fermée — il faut confirmer que les 30 lignes seedées au Ticket 1 sont à jour, et fournir la liste à Sonnet via un prompt structuré.

Voir les 2 prompts d'amorçage en §9 et §10 ci-dessous.

---

## 9. Prompt d'amorçage — Nouveau chat Claude (analyse + brief Ticket 5)

À coller dans **un nouveau chat Claude.ai au sein du projet DentalLearn** (pour avoir accès aux fichiers projet) :

```
On attaque le Ticket 5 du pipeline News (synthèse + tagging + quiz +
embedding via Sonnet). Récap Ticket 4 dans
RECAP_SESSION_27AVRIL2026_TICKET4_NEWS.md.

Avant de produire le prompt d'amorçage Claude Code, je veux qu'on fasse
un brief en 3 étapes :

1. Pré-requis BDD : confirmer le statut des 3 migrations v1.3 listées
   dans addendum_handoff_claude_code_v1_3.md §1 (épisodes format,
   syntheses categories cover, questions news link). Si pas appliquées,
   on les applique avant le Ticket 5.

2. Pré-requis env : variable OPENAI_API_KEY à provisionner. Tu me dis
   les démarches (création clé, budget mensuel, configuration secret
   Supabase).

3. Décisions produit à arbitrer avant le code, notamment :
   - Modèle Sonnet exact (claude-sonnet-4-6 vs claude-sonnet-4-7 ?)
   - Comportement si tagging hors taxonomy (rejeter le résultat ou
     tagger 'autre' ?)
   - Stratégie quand un article génère 0 question quiz exploitable
     (l'inclure quand même dans la KB sans question ?)
   - Politique embedding sur les articles déjà synthétisés en cas de
     re-run (re-générer ou skip ?)
   - Volume max d'articles à synthétiser par invocation (rappel
     leçon Lz1 du Ticket 4 : IDLE_TIMEOUT 150s — Sonnet est plus lent
     que Haiku, donc limite plus basse)

Lis le RECAP Ticket 4 + spec_news_podcast_pipeline_v1_3.md §6.4 +
addendum_handoff_claude_code_v1_3.md §3 "Ticket 5 RÉVISÉ", puis pose-moi
les questions nécessaires pour que je tranche les points 1, 2, 3 dans
l'ordre. À la fin, tu me produis le prompt d'amorçage à coller dans la
nouvelle session Claude Code.
```

---

## 10. Prompt d'amorçage — Nouvelle session Claude Code (Ticket 5)

⚠️ **À ne pas coller directement** — il faut d'abord faire le brief de la §9 ci-dessus, qui produira le prompt final calibré sur les arbitrages du moment. Le squelette ci-dessous est une base de travail pour le brief.

```
Tu travailles sur le projet DentalLearn (repo DentalLearn-V3, stack
Next.js 14 / TypeScript / Supabase / Vercel). Editeur : EROJU SAS,
marque Dentalschool Formations.

MISSION : implémenter le Ticket 5 RÉVISÉ de la Phase 1 du pipeline
Section News — synthèse + tagging 3D + tagging éditorial + display_title
+ 3-4 questions quiz + embedding, en un seul appel Sonnet par article
sélectionné.

CONTEXTE PROJET
===============

[à remplir pendant le brief §9 ci-dessus, basé sur les arbitrages]

DOCUMENTS DE RÉFÉRENCE À LIRE EN PREMIER
=========================================

⚠️ HIÉRARCHIE — la spec v1.3 fait foi sur les Tickets 4+, le handoff
v1.2 reste valide pour le plan général, et l'addendum v1.3 prime sur
le handoff v1.2 en cas de conflit.

1. spec_news_podcast_pipeline_v1_3.md (racine repo) — SPEC FAISANT FOI
   pour le Ticket 5, notamment §6.4 (Edge Function synthesize_articles
   ENRICHI v1.3).
2. addendum_handoff_claude_code_v1_3.md (racine repo) — §3 Ticket 5
   RÉVISÉ pour les modifs v1.3 par rapport à v1.2.
3. handoff_claude_code_v1_2.md (racine repo) — §3 Ticket 5 (base v1.2,
   à compléter par v1.3 mais pattern général conservé).
4. RECAP_SESSION_27AVRIL2026_TICKET4_NEWS.md (racine repo) — Récap
   session précédente, leçons techniques (notamment IDLE_TIMEOUT et
   pattern body POST `{"limit": N}` à reproduire ici).
5. Voir aussi RECAP Tickets 1, 2, 3 pour le contexte général.

ÉTAT D'AVANCEMENT (au démarrage Ticket 5)
==========================================

✅ Ticket 1 (schéma BDD) — 10 tables news_*, pgvector, 16 sources seed
✅ Ticket 2 (ingest_pubmed + check_retractions + cron lundi 03h30/04h00)
✅ Ticket 3 (ingest_rss + cron lundi 04h30) — 4 sources RSS pilotes
✅ Ticket 4 (score_articles + cron lundi 14h00) — 504 articles scorés
   (196 selected, 191 candidate, 224 duplicate)
✅ 3 migrations BDD v1.3 appliquées avant Ticket 5
   (épisodes format, syntheses categories cover, questions news link)
🔄 Ticket 5 — TICKET ACTUEL
⏳ Tickets 5bis (tagging étendu) à 11 — non commencés

Patterns établis (réutiliser à l'identique) :
- _shared/ncbi.ts (lib pure, fetch + parse + rate-limit)
- _shared/rss.ts (lib pure, parser multi-format)
- _shared/anthropic.ts (NEW Ticket 4, retry/backoff sur 429/5xx)
- _shared/supabase.ts (factory client service-role)
- _shared/logger.ts (JSON structuré)
- pg_cron migrations avec format(%L) + DO block + clean-slate défensif
- tsconfig.json#exclude couvre déjà supabase/functions
- Body POST {"limit": N} pour borner par invocation (pattern Ticket 4)

INFOS CRITIQUES À MÉMORISER
============================

- Supabase project ID : dxybsuhfkwuemapqrvgz (finit par 'z')
- URL dashboard : https://supabase.com/dashboard/project/dxybsuhfkwuemapqrvgz
- Dr Fantin n'a pas Docker Desktop. Toujours suggérer le flag
  `supabase functions deploy ... --use-api` pour bypass le bundling
  local.
- IDLE_TIMEOUT 150s côté Edge Functions Supabase. Sonnet étant ~3× plus
  lent que Haiku, le default `limit` doit être plus conservateur
  (proposer 5-10 articles par invocation, à valider pendant le brief).
- ANTHROPIC_API_KEY déjà en place côté Supabase secrets (Ticket 4).
- OPENAI_API_KEY à provisionner pour ce ticket (embeddings).

TICKET 5 — À IMPLÉMENTER
========================

[à finaliser pendant le brief §9 du RECAP Ticket 4]

CONTRAINTES NON-NÉGOCIABLES
============================

[à reprendre du prompt Ticket 4 en l'adaptant — notamment 11-15 du
handoff v1.3]

CRITÈRES D'ACCEPTATION
=======================

[à finaliser pendant le brief, basés sur §6.4 spec v1.3 et addendum §3]

WORKFLOW DE VALIDATION
======================

Pareil qu'aux Tickets 2-4 :
1. Tu produis ton plan d'attaque (20 lignes max), j'attends ma
   validation
2. Tu codes selon le plan validé, par commits ciblés
3. Tu pushes sur la branche, diff résumé en chat
4. Dr Fantin déploie depuis son terminal local (CLI Supabase --use-api,
   pas de Docker)
5. Tests live : 1er run sur N articles selected, vérifs SQL (qualité
   synthèse, tags conformes taxonomy, embedding non null, questions
   quiz format JSONB compatible), 2e run pour idempotence
6. Si bug détecté : patch sur la même branche, redéploiement, retests
7. Validation finale → PR sur main → merge

À TOI DE JOUER
==============

Démarre par la lecture des documents de référence et l'audit Supabase
(news_scored selected, taxonomy news), puis produis ton plan en 20
lignes max.
```

---

## 11. Pour reprendre avec Claude dans un nouveau chat

1. Ouvrir un nouveau chat **dans le projet DentalLearn** (pour accès fichiers projet)
2. Coller le prompt de §9 ci-dessus
3. Claude lit le RECAP Ticket 4 + spec v1.3 §6.4 + addendum §3, puis lance le brief des 3 étapes
4. À la fin du brief, Claude produit le prompt final pour la session Claude Code
5. Coller ce prompt final dans une nouvelle session Claude Code, et lancer le workflow plan-validation-code-tests-merge

---

## Statistiques de la session

- **Durée** : ~5 heures (matinée + soirée 27 avril 2026)
- **Commits sur la branche feature** : 4 (3 par Code + 1 reset/sync)
- **Commit cherry-pické sur main** : 1 (fix enum point_reason orphelin)
- **PR mergée** : 1 (Ticket 4)
- **Bugs résolus** : 4 (IDLE_TIMEOUT, variable shell vide, migration cron oubliée, enum point_reason en prod 5j)
- **Articles scorés** : 504 (196 selected pour le Ticket 5)
- **Coût Haiku 1er run** : ~0,45 €
- **Branches Git supprimées** : 105 (101 mergées + 3 non mergées arbitrées + 1 du Ticket 4)
- **Décisions produit arbitrées** : 3 en début de session + 4 en cours de patches

*Session dense, démarrée comme un ticket "simple" et ayant mis à jour 3 patterns techniques structurants pour le reste de la Phase 1 (body limit, hygiène secrets shell, vérification commits orphelins). En bonus : un bug critique enum 5 jours en prod découvert et corrigé. Le pipeline News est désormais opérationnel sur 4 jobs hebdomadaires complets (check_retractions → ingest_pubmed → ingest_rss → score_articles), prêt pour la couche de synthèse et de tagging au Ticket 5.*

*Fin du récap. Ticket 4 clôturé.*
