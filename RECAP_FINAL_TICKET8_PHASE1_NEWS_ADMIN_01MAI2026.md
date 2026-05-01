# RECAP FINAL — Ticket 8 Phase 1 — Interface admin News

**Date** : 1er mai 2026
**Branche** : `claude/news-admin-ticket-8-phase1`
**Status** : ✅ Livré, testé live, prêt pour PR sur `main`
**Commits** : 7 (1 → 7), poussés sur la branche

---

## 1. Contexte et stratégie

### Position dans la roadmap News

Le Ticket 8 **Phase 1** est la suite logique des Tickets 1 à 5 du pipeline news (livrés et mergés sur `main` au 29 avril 2026). Les tickets précédents ont délivré l'ingestion automatique (RSS + PubMed), le scoring Sonnet, la déduplication, la génération des synthèses + questions, et la liaison `questions ↔ news_syntheses` avec contrainte XOR. Au moment du démarrage de la Phase 1 :

- 196 synthèses `active` issues du backfill du 29 avril
- 782 questions news générées (`is_daily_quiz_eligible=false` par défaut)
- 6 jobs cron hebdomadaires en place (chaîne ingestion → scoring → synthèse)
- Aucune interface admin pour exploiter ce contenu

**Stratégie D3 retenue** (cf décision Dr Fantin, début Ticket 8) : livrer l'admin par couches successives. La **Phase 1 couvre tout sauf l'arbitrage script paramétrique** (qui dépend du Ticket 7 backend non encore livré).

### Périmètre Phase 1

| Inclus ✅ | Exclu ❌ |
|---|---|
| Page admin `/admin/news` (liste + filtres + tri + pagination) | Arbitrage format/durée/narrateur/ton |
| Détail synthèse `/admin/news/[id]` | Bouton "Générer le script" |
| Édition `formation_category_match` inline | Cover preview / régénération IA |
| Validation quiz quotidien (approve/reject questions) | Édition manuelle des questions |
| Vues spécialisées pending / approved | Gestion CRUD des sources news |
| Vue articles failed + bouton Retry | Responsive mobile |
| Ingestion manuelle ad hoc URL/DOI + chaînage pipeline | |

---

## 2. Décisions arbitrées en cours de phase

### PO1 — Bouton Retry sur articles failed

**Décision : reco (b) reset DB-only**, sans toucher aux Edge Functions existantes.

Le bouton Retry exécute `UPDATE news_syntheses SET status='failed', failed_attempts=0, validation_errors=NULL, validation_warnings=NULL`. L'article repassera dans la file du cron `synthesize_articles` au prochain run hebdo (lundi 20h ou 22h UTC). Message UI explicite côté admin.

**Justification** : aucune urgence opérationnelle pour un retraitement immédiat. Étendre les Edge Functions sortait du périmètre Phase 1.

### PO2 — Architecture ingestion manuelle

**Décision : Option B avec pré-remplissage Crossref**.

L'admin saisit elle-même les métadonnées via un formulaire (URL, DOI, titre, journal, abstract, spécialités suggérées). Le bouton "Pré-remplir depuis Crossref" automatise la saisie pour les articles avec DOI. Pas de scraping HTML automatique côté Node.

**Architecture chaînage** : fire-and-forget côté API Next.js (pas d'await sur les Edge Functions), pour éviter le timeout Vercel serverless 60s. Le polling page orchestre la séquence score → synthesize.

### PO3 — Slugs autorisés `formation_category_match`

**Décision : 27 slugs du CHECK constraint `formations.category`**, regroupés par axe dans le dropdown :

- Axe 1 — Connaissances cliniques (9 slugs)
- Axe 3 — Relation patient (9 slugs)
- Axe 4 — Santé praticien (6 slugs)
- Hors CP — bonus (3 slugs)

Plus l'option "Aucune correspondance" qui set `NULL`. Le dropdown ne se limite pas aux 5 slugs actuellement utilisés par des formations existantes (cohérent avec le tagging Sonnet qui s'appuie sur le référentiel complet).

### PO4 — Recherche full-text

**Décision : ILIKE sur `display_title + summary_fr`** côté API. Vector search reporté.

### Décisions secondaires

- **Auth admin** : pattern existant projet (email hardcodé `drfantin@gmail.com` + `createAdminClient()` service role). Pas de RLS basé sur `profiles.role`.
- **Date affichée sur cards** : `news_raw.published_at` (date publication scientifique réelle) avec fallback `news_syntheses.created_at` si NULL. Dénormalisation sur `news_syntheses.published_at` via trigger BDD pour permettre le tri (la limitation `foreignTable`/`referencedTable` du Supabase JS sur LEFT JOIN PostgREST imposait cette stratégie).
- **Compteur dashboard "Questions"** : filtré sur `sequence_id IS NOT NULL` pour exclure les questions news (374 formations vs 786 news, distinction sémantique nécessaire).
- **Responsive mobile** : non prioritaire, workflow admin = desktop.

---

## 3. Découpage en commits livrés

| # | Titre | Commit hash | Volume |
|---|---|---|---|
| 1 | API routes lecture syntheses + détail + questions | `d96aacf` | +357 lignes |
| 2 | Page liste + filtres + pagination + lien sidebar | `c0021d0` | +639 lignes |
| 2bis | Fix contraste selects et pagination | `717ddfa` | ~30 lignes |
| 2ter | Affichage `published_at` sur cards | `777f9ec` | +66 lignes |
| 2quater | Tri par `published_at` (asc/desc) | `986b29a` → `7a11427` → `6a41c8b` (3 itérations) | ~120 lignes |
| 3a | Page détail read-only | `52bbfba` | +780 lignes |
| 3b | Édition match + filtre Aucune correspondance | `c5c0c43` | +170 lignes |
| 4 | Approve/reject questions + vues pending/approved + pool quotidien | `7b07533` | +1 009 lignes |
| 5 | Vue articles failed + bouton Retry | `705de8c` | +739 lignes |
| 6a | Formulaire ingestion manuelle + INSERT raw + Crossref | `515fce2` | +904 lignes |
| 6b | Chaînage score+synth + page résultat polling | `81bcdd1` | +875 lignes |
| 6bis | Fix dashboard compteur Questions | `0e12379` | +2 lignes |
| 7 | Polish lint + cleanup no-op handler | `5ce4629` | -22 lignes |

**Total approximatif** : ~5 700 lignes ajoutées, ~80 lignes retirées sur la branche.

---

## 4. Architecture livrée

### Endpoints API (11)

Tous protégés par `ADMIN_EMAIL='drfantin@gmail.com'` + `createAdminClient()` (service role) :

| Méthode | Route | Usage |
|---|---|---|
| GET | `/api/admin/news/syntheses` | Liste paginée avec filtres + tri + recherche |
| GET | `/api/admin/news/syntheses/[id]` | Détail synthèse + raw + count questions |
| PATCH | `/api/admin/news/syntheses/[id]` | Édition `formation_category_match` |
| GET | `/api/admin/news/syntheses/[id]/questions` | Questions liées à une synthèse |
| POST | `/api/admin/news/syntheses/[id]/retry` | Reset DB-only pour retraitement cron |
| GET | `/api/admin/news/questions` | Liste paginée des questions news (pending/approved) |
| PATCH | `/api/admin/news/questions/[id]/approve` | Bascule `is_daily_quiz_eligible` |
| GET | `/api/admin/news/manual-ingest/preview-doi` | Pré-remplissage Crossref |
| POST | `/api/admin/news/manual-ingest` | INSERT `news_raw` + trigger score |
| GET | `/api/admin/news/manual-ingest/result/[raw_id]` | Polling état pipeline |
| POST | `/api/admin/news/manual-ingest/result/[raw_id]/trigger-synth` | Déclenchement synthèse |

### Pages UI (8)

- `/admin/news` — liste + card "Pool Quiz du jour" + card "Articles en échec"
- `/admin/news/[id]` — détail complet synthèse + questions interactives
- `/admin/news/[id]/loading.tsx` + `/not-found.tsx`
- `/admin/news/pending` — vue spécialisée questions à valider
- `/admin/news/approved` — vue spécialisée questions approuvées
- `/admin/news/failed` — vue articles en échec
- `/admin/news/manual` — formulaire ingestion ad hoc
- `/admin/news/manual/result/[raw_id]` — page polling pipeline

### Composants partagés (4)

- `QuestionApprovalButton` — toggle async approve/reject
- `QuestionsListPage` — composant générique pending/approved (factor avec status prop)
- `RetryButton` — POST retry + état verrouillé "Reset effectué"
- Helpers `src/lib/news-display.ts` (`describeCardDate`, `formatDate`)

### Constantes partagées (`src/lib/constants/news.ts`)

- `ALLOWED_FORMATION_CATEGORIES` (27 slugs)
- `FORMATION_CATEGORY_LABELS` (mapping slug → libellé français)
- `FORMATION_CATEGORY_GROUPS` (regroupement par axe pour `<optgroup>`)
- `NEWS_SPECIALITES` (12 valeurs taxonomy)

### Migrations BDD (2)

| Fichier | Effet |
|---|---|
| `20260430_news_syntheses_published_at.sql` | Ajout colonne `published_at` + index + trigger sync depuis `news_raw` |
| `20260501_news_source_manual_admin.sql` | INSERT source `'Ingestions manuelles admin'` (type='manual') |

---

## 5. État BDD final (snapshot 1er mai 2026)

| Métrique | Valeur |
|---|---|
| Synthèses actives | **197** (196 backfill + 1 Cochrane test ingestion manuelle) |
| Synthèses failed / failed_permanent | 0 / 0 (pipeline en bonne santé) |
| `news_raw` total | 505 (504 cron + 1 manuel) |
| Questions news total | 786 (782 backfill + 4 Cochrane) |
| Questions news approuvées pour quiz | 0 (curation à effectuer par Dr Fantin) |
| Questions formations (Axe 1) | 374 |
| Sources news actives | 17 (16 cron + 1 manual_admin) |
| Synthèses avec match formation | 77 / 197 (39%) |

---

## 6. Tests live validés

### Validation fonctionnelle (Dr Fantin, 30/04 → 01/05/2026)

| Fonctionnalité | Tests | Validé |
|---|---|---|
| Liste paginée + filtres + tri + recherche | 20+ scénarios | ✅ |
| Page détail read-only (synthèse + raw + questions) | Rendu 3 question_type, 404, responsive desktop | ✅ |
| Édition `formation_category_match` | 5 cas (set, change, null, cancel, persistence) | ✅ |
| Filtre "Aucune correspondance" | 118 résultats attendus = 118 obtenus | ✅ |
| Approve/reject questions | Persistence + UX optimiste + garde-fou anti-pollution | ✅ |
| Vues pending / approved | Recherche + filtre specialite + désapprobation | ✅ |
| Vue failed | Test SQL via injection temporaire d'un article failed → reset BDD vérifié | ✅ |
| Ingestion manuelle Crossref | DOI valide / invalide / mal formé / doublon | ✅ |
| Chaînage pipeline manuel | 3 cas validés en BDD : success (Cochrane endo, score 0.75) + not_eligible (exosomes, 0.45) + not_eligible pur (tarte aux pommes, 0.00) | ✅ |
| Dashboard compteur Questions | 374 affiché au lieu de 1160 | ✅ |

### Test 3G (charge réseau dégradée)
Page détail validée en mode 3G simulé via DevTools. Skeleton + chargement progressif fonctionnels.

---

## 7. Apprentissages techniques

### Limitation Supabase JS sur LEFT JOIN PostgREST

Le tri `news_raw.published_at` via `.order('published_at', { foreignTable: 'news_raw', ... })` (et son successeur `referencedTable`) **ne fonctionne pas** sur cette version du client (`^2.39.0`). PostgREST applique le `.order()` à la relation embarquée mais pas au tri principal de la requête.

**Solution retenue** : dénormalisation `published_at` directement sur `news_syntheses` via trigger BDD `BEFORE INSERT OR UPDATE OF raw_id`. Cohérence garantie 100% côté DB, aucune modification d'Edge Function nécessaire.

### Edge Functions news non paramétrées

Les fonctions `score_articles` et `synthesize_articles` n'acceptent pas de paramètre `raw_id` ciblé. Pour l'ingestion manuelle, on a retenu une stratégie **fire-and-forget orchestrée côté frontend** :

1. INSERT `news_raw` → fire-and-forget POST `score_articles {limit: 50}` (absorbe backlog éventuel)
2. Page polling détecte `scoring done && eligible && synthesis pending` → POST one-shot vers `trigger-synth` qui fire-and-forget `synthesize_articles {limit: 5}`
3. Pas de `setTimeout` côté Vercel serverless (incompatible cycle de vie lambda)

Cette stratégie est robuste mais contient une limite : si plusieurs `news_raw` sont insérés simultanément (cron PubMed concurrent), `score_articles` peut traiter un autre article avant. La page polling restera en `scoring` plus longtemps. Acceptable hors périmètre Phase 1.

### Pattern auth admin projet

Le pattern existant (email hardcodé + `createAdminClient`) a été reproduit à l'identique sur les 11 nouveaux endpoints, sans introduction de RLS basé sur `profiles.role`. Cohérence du codebase préservée.

### Pattern URL-as-source-of-truth pour les filtres

Toutes les pages liste (`/admin/news`, `/admin/news/pending`, `/admin/news/approved`, `/admin/news/failed`) utilisent `useSearchParams + router.replace` pour synchroniser filtres et pagination dans l'URL. **Bénéfices** : refresh préserve l'état, URL bookmarkable, partageable entre admins.

---

## 8. Cleanup BDD post-tests

3 lignes de test ingestion manuelle ont été créées en cours de validation. Décision finale (1er mai) :

| Article | Score | Décision |
|---|---|---|
| Cochrane endo (retraitement périapical) | 0.75 | **Conservé** (synthèse + 4 questions, contenu utilisable) |
| Exosomes diabète (recherche fondamentale) | 0.45 | Supprimé |
| Tarte aux pommes (test off-topic) | 0.00 | Supprimé |

Suppression effectuée via `DELETE FROM news_raw WHERE id IN (...)` avec cascade automatique sur `news_scored`.

---

## 9. Dette technique loggée

### Phase 2 du Ticket 8 (à planifier)

**Gestion des sources news via UI admin**

- CRUD sur `news_sources` (créer / modifier / désactiver)
- Validation `feed_url` ou requête MeSH avant INSERT
- Dashboard santé par source : `last_fetched_at`, `error_count`, articles ingérés / éligibles / synthétisés sur 30 jours
- Investigation des 3 sources PubMed actuellement à 0 article (Gérodontologie, Actu pro, Santé publique dentaire) — soit fix de la requête MeSH, soit désactivation
- Bouton "Tester la source" qui fait un fetch unitaire pour vérifier validité

### Dette technique (post-PR)

- **Pagination cron `synthesize_articles`** : à refondre quand `articles éligibles/semaine > 400`. Actuellement on est à ~50/semaine, marge confortable.
- **Responsive mobile pages admin News** : décision Dr Fantin du 30/04/2026, non prioritaire.
- **Articles PubMed en ahead-of-print** : `published_at` peut être dans le futur (cas légitime — date d'inclusion dans un fascicule à paraître). À surveiller si > 5 cas se présentent. 1 cas observé sur 197 actuellement (juin 2026).

### Anticipation montée en charge sources

| Action | Coût Sonnet/mois | Risque technique |
|---|---|---|
| Garder 17 sources actuelles | ~4 € | RAS |
| Ajouter 5-10 sources francophones (Le Fil Dentaire, Espace Dentaire, Dental Tribune FR…) | ~5-7 € | RAS |
| Ajouter 20+ sources sub-spécialités | ~8-10 € | À monitorer (limite IDLE_TIMEOUT 150s) |
| Ajouter 50+ sources | ~15-20 € | **Refonte cron nécessaire** |

---

## 10. Workflow opérationnel cible

À partir du merge sur `main`, Dr Fantin pourra :

**Curation hebdomadaire (estimation : 30 minutes / dimanche)**
1. Aller sur `/admin/news/pending` → parcourir les 786 questions en attente
2. Approuver les meilleures questions (score qualité visuel : pertinence clinique, formulation, distractors solides)
3. Le compteur "Approuvées" sur la card violette `/admin/news` reflète l'état du pool quotidien

**Ingestion ponctuelle (estimation : 2 minutes / article)**
1. Lecture d'un article intéressant sur LinkedIn / Twitter / newsletter pro
2. Récupération du DOI ou de l'URL
3. `/admin/news/manual` → pré-remplissage Crossref → submit
4. Page résultat avec progression en temps réel (~30s)
5. Synthèse + questions générées par Sonnet, prêtes à approuver

**Surveillance pipeline (estimation : 5 minutes / semaine)**
1. Card "Articles en échec" sur `/admin/news` → 0 idéalement
2. Si > 0, click "Voir →" → analyse `validation_errors` → click Retry si pertinent
3. Le retraitement aura lieu au prochain cron (lundi 20h/22h UTC)

---

## 11. Référence rapide pour reprise

**Branche** : `claude/news-admin-ticket-8-phase1`
**Dernier commit** : `5ce4629`
**Commits totaux** : 13 (incluant les itérations bugfix)
**Repo** : github.com/drfantin-star/DentalLearn-V3.git
**Production** : https://dental-learn-v3.vercel.app
**BDD** : projet Supabase `dxybsuhfkwuemapqrvgz`

**Prochaine étape** : ouvrir la PR `claude/news-admin-ticket-8-phase1` → `main` avec le présent RECAP en description.

**Tickets à venir** :
- Ticket 7 (backend) : arbitrage script paramétrique format/durée/narrateur/ton
- Ticket 8 Phase 2 : gestion sources news via UI admin
- Ticket 9 : exposition côté frontend utilisateur (carrousel news, daily quiz news)
- Ticket 10 : génération covers IA pour les synthèses

---

*Document généré le 01/05/2026 par Claude (chat) en clôture de la Phase 1 du Ticket 8.*
