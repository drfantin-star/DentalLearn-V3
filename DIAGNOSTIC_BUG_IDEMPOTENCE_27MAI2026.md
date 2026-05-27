# Diagnostic — Bug d'idempotence `synthesize_articles` (27 mai 2026)

## Symptômes observés

Entre le 18 et le 27 mai 2026, l'Edge Function `synthesize_articles` a
créé **35 syntheses doublons** sur 2 articles distincts :

| `raw_id` | Article | Doublons |
|---|---|---|
| `552306b3-9db1-4b19-b441-f0e52101de99` | Guides pour mini-implants palatins | 20 (1 failed + 19 active) |
| `61ec594f-204e-46da-a8cb-2964c913e3ef` | Contention fixe vs amovible : quelle stabilité en 3D ? | 19 (1 failed + 18 active) |

Pattern temporel : 1 ligne `failed` initiale, puis cascade de lignes
`active` régénérées à chaque run cron (toutes les 2h pendant ~9 jours)
et lors du backfill du 18 mai.

Ce comportement viole la décision produit **A4 du Ticket 5** :
> Skip si active/failed_permanent ; retry auto si failed (cap 2) ;
> force=true → DELETE+INSERT.

## Cause racine

Dans `supabase/functions/synthesize_articles/article_processor/index.ts`,
le chemin success de l'étape 4 (`insertSynthesisAndQuestions`, lignes
357-376) effectue un **INSERT pur**, sans jamais supprimer la ligne
`failed` existante.

La cleanup `deleteSynthesisAndQuestions` n'est appelée que dans
l'étape 0 du chemin `force=true` (lignes 254-283 du même fichier).
Le chemin "retry naturel" sans `force` (cron classique) ne nettoie
jamais la ligne `failed` pré-existante avant l'INSERT de la nouvelle
ligne `active`.

### Séquence pas à pas

1. **Run N** : Sonnet échoue (raison initiale à investiguer — probable
   timeout ou validation tag). `upsertFailedSynthesis(existing=null)`
   → INSERT ligne #1 avec `status='failed'`, `failed_attempts=1`.

2. **Run N+1** : `loadCandidates` (`index.ts:239-334`) :
   - SELECT `news_scored.status='selected'` + embed
     `syntheses:news_syntheses(id, status, failed_attempts)`
   - L'article matche, `synArr = [failed_row]`, `syn = synArr[0]`.
   - `isEligible` : `status='failed'` ET `attempts<MAX_FAILED_ATTEMPTS (2)`
     → re-éligible (cf `index.ts:292-304`).
   - `processArticle` → Sonnet OK cette fois → étape 4
     `insertSynthesisAndQuestions` → **INSERT ligne #2 avec
     `status='active'`** (la ligne #1 `failed` reste en place,
     aucune cleanup).

3. **Run N+2** : `loadCandidates` SELECT retourne maintenant
   `syntheses = [failed_row, active_row]`. **Aucun ORDER BY dans
   l'embed PostgREST** (cf `index.ts:248-256`) → l'ordre des éléments
   du tableau n'est garanti par rien.
   - `syn = synArr[0]` (`index.ts:289`) renvoie le premier — en pratique
     PostgREST sans ORDER BY tend à renvoyer en ordre d'insertion
     physique, donc la `failed` (créée en premier).
   - `isEligible` voit `failed` + `attempts=1<2` → re-éligible.
   - Sonnet OK → étape 4 → **INSERT ligne #3 `active`**.

4. **Runs N+3, N+4, …** : la boucle se perpétue. Chaque run où
   `synArr[0]` retourne la ligne `failed` (statistiquement fréquent
   avec l'ordre d'insertion physique) crée une nouvelle ligne `active`.

5. **Le passage du cron à `0 */2 * * *`** le 20 mai (commit `d6cf6f8`,
   migration `20260520_fix_synthesize_cron_2h.sql`) a multiplié la
   fréquence d'exécution par ~12×/jour, transformant un bug latent en
   cascade de 19 doublons en 9 jours.

## Facteurs aggravants

### 1. Absence de UNIQUE constraint sur `news_syntheses.scored_id`

La table `news_syntheses` (`supabase/migrations/20260423_news_schema.sql`
lignes 95-124) n'a aucune contrainte UNIQUE sur `scored_id`. La
limitation est explicitement reconnue dans le code :

- `persist.ts:247` : « *Pas de UNIQUE constraint sur scored_id en BDD
  → pas de `ON CONFLICT` Postgres. On distingue UPDATE vs INSERT
  applicativement via `existing`…* »
- `index.ts:289-290` : « *0 ou 1 (pas de UNIQUE sur scored_id mais
  en pratique le pipeline n'en crée qu'1)* »

Ce postulat est invalidé par l'absence de cleanup en étape 4 du
chemin retry-success.

### 2. `synArr[0]` non-déterministe dans `loadCandidates`

Sans `ORDER BY` dans l'embed PostgREST (`index.ts:255`), l'ordre des
syntheses dans le tableau n'est pas garanti. Quand 2+ rows coexistent,
`synArr[0]` peut retourner aussi bien la `failed` que l'`active` selon
les runs, mais la tendance "ordre d'insertion physique" favorise
statistiquement la `failed`.

### 3. Schedule cron à 12 runs/jour

Le passage de `0 20 * * 1` (1×/semaine) à `0 */2 * * *` (12×/jour) le
20 mai a transformé un bug latent en cascade observable.

## Hypothèses du brief — verdict

| Hypothèse | Verdict | Justification |
|---|---|---|
| **H1** : SELECT ignore les `active` existantes | ❌ FAUX | `loadCandidates` filtre bien via `isEligible` (index.ts:292-304). La règle A4 est correcte tant qu'il n'y a qu'1 row par `scored_id`. |
| **H2** : Le retry sur `failed` ne fait pas DELETE avant INSERT | ✅ **VRAI — cause racine** | `processArticle` étape 4 appelle `insertSynthesisAndQuestions` qui fait INSERT pur. Aucune cleanup de la `failed` existante hors chemin `force=true`. |
| **H3** : Le cap retry ne se déclenche pas | ❌ FAUX | `upsertFailedSynthesis` (persist.ts:267-270) incrémente correctement et promeut à `failed_permanent` à attempts≥2. Mais le bug crée des `active` (pas des `failed` supplémentaires) donc le cap n'est pas sollicité pour les doublons. |
| **H4** : Race condition entre 2 runs cron | ❌ FAUX | La cascade lente (~1 doublon / 9h en moyenne) correspond à des runs séquentiels, pas concurrents. |

## Commit ayant introduit le bug

Le bug est présent **depuis l'implémentation initiale du Ticket 5**
(`9831314` merge PR #299, commits antérieurs sur la branche
`claude/t5bis-dense-timeline-1`). La logique de cleanup en étape 4 du
chemin retry n'a jamais été implémentée — seul le chemin `force=true`
(étape 0) a été couvert.

Les modifications récentes (mai 2026) n'ont pas introduit le bug mais
l'ont rendu visible :
- `d6cf6f8` (20 mai) : passage cron à 2h → fréquence ×12
- `cb2f083` (19 mai) : recalibrage `limit=1` (sans impact sur le bug)
- `3c620f1` (20 mai) : filtre abstract long (sans impact sur le bug)

## Comportement attendu vs actuel

| Scénario | Attendu (A4) | Actuel |
|---|---|---|
| Article jamais traité | INSERT 1 `active` ou 1 `failed` | ✅ OK |
| Retry d'un `failed` qui réussit | DELETE ligne `failed` + INSERT 1 `active` | ❌ INSERT 1 `active` sans DELETE → 2 rows |
| Retry d'un `failed` qui échoue (attempts=1) | UPDATE ligne `failed`, attempts→2, status→`failed_permanent` | ✅ OK |
| Existing `active` | Skip silencieux | ✅ OK |
| `force=true` + existing | DELETE + INSERT (1 row) | ✅ OK |

## Décisions de design appliquées au fix

### R1 — Comportement si cleanup étape 3bis échoue : Option A (incrémenter `failed_attempts`)

Si `deleteSynthesisAndQuestions` échoue à l'étape 3bis du fix, on
appelle `persistFailureAndReport` qui incrémente `failed_attempts`.
À 2 cleanup ratées consécutives → promotion à `failed_permanent` +
investigation manuelle via le log sentinel
`article_failed` avec `stage='synthesis_insert'` et `reason` préfixé
`failed-row cleanup before retry insert failed:`.

**Justification** :
- **Cohérence** avec le chemin force-reset cleanup-failed déjà existant
  (`index.ts:264-272`) qui fait exactement ce choix.
- **Sécurité** : une cleanup ratée laisse l'état BDD potentiellement
  incohérent (DELETE partielle des questions liées). Retenter en boucle
  sans cap risquerait de re-déclencher exactement la cascade de doublons
  qu'on cherche à fixer.
- **Respect A4** : le cap retries=2 reste la règle uniforme du Ticket 5,
  pas de cas particulier "cleanup ratée".
- **Debug** : `summary_fr` contiendra le préfixe explicite
  `[FAILED synthesis_insert] failed-row cleanup before retry insert failed: <err>`
  → grep direct en admin.

Le code aura un commentaire explicite expliquant cette décision.

### R3 — Couverture du scénario `backfill_synthesize.sh` (18 mai)

**Confirmé** : le fix étape 3bis couvre intégralement le scénario
backfill du 18 mai (200 invocations `limit=1` → 19 doublons en 2h).

Raison : `backfill_synthesize.sh` appelle l'Edge Function HTTP avec le
même body qu'un cron. Le code path traversé est strictement identique :
`loadCandidates` → `processArticle` → étape 4 INSERT. Le bug est dans
`processArticle` (chemin retry-de-failed sans cleanup), pas dans le
mode de déclenchement (cron vs HTTP manuel).

Aucune modification de `backfill_synthesize.sh` requise.

## Modifications de code apportées

Voir commits suivants sur la branche `claude/fix-synthesize-idempotence-27mai2026` :

1. **Étape 3bis dans `processArticle`** (`article_processor/index.ts`) :
   entre embedding OK et INSERT, cleanup explicite de la ligne `failed`
   existante via `deleteSynthesisAndQuestions`. Symétrique du chemin
   force-reset (étape 0).

2. **Hardening `loadCandidates`** (`synthesize_articles/index.ts`) :
   sélection déterministe de `syn` parmi `synArr` prioritisant les
   statuts "skip-wins" (`active` > `failed_permanent` > `failed`) +
   log sentinel `duplicate_syntheses_detected` si > 1 row trouvée.

3. **Partial UNIQUE INDEX** (migration
   `20260527a_news_syntheses_unique_active_scored.sql`) :
   défense en profondeur, interdit > 1 ligne (`active`, `failed`,
   `failed_permanent`) par `scored_id` au niveau schema.

## Tests SQL de non-régression

À exécuter post-déploiement (et inclus dans le plan de validation PR) :

```sql
-- Aucun raw_id ne doit avoir > 1 synthèse active
SELECT raw_id, COUNT(*)
FROM news_syntheses
WHERE status = 'active'
GROUP BY raw_id
HAVING COUNT(*) > 1;

-- Idem par scored_id sur les 3 statuts "vivants"
SELECT scored_id, COUNT(*)
FROM news_syntheses
WHERE status IN ('active', 'failed', 'failed_permanent')
GROUP BY scored_id
HAVING COUNT(*) > 1;
```

Les deux requêtes doivent retourner 0 rows en régime stable.

## État BDD post-cleanup (27 mai 2026)

Après cleanup complémentaire des 2 failed orphelines par Dr Fantin
(`scored_id` `7154be7c-6abf-420c-b719-8a0ec720fc6d` et
`7d8255fe-091f-41d2-829d-c816c98eef2a`) :

| status | count |
|---|---|
| active | 504 |
| deleted | 37 |
| failed_permanent | 1 |
| failed | 0 |

La pré-condition pour la création du partial UNIQUE INDEX est validée :
la requête « collision sur `(scored_id, status ∈ vivants)` » retourne
0 rows.

## Remise en route des crons

Les 2 crons `news_synthesize_articles` et `news_synthesize_articles_late`
sont actuellement UNSCHEDULED. La remise en route se fait via 2
migrations livrées avec cette PR mais **non appliquées** :

- `20260527b_news_synthesize_articles_cron_restore.sql` →
  `0 20 * * 1` (lundi 20h UTC), body `{"limit": 1}`
- `20260527c_news_synthesize_articles_late_cron_restore.sql` →
  `0 22 * * 1` (lundi 22h UTC), body `{"limit": 1}`

Dr Fantin applique ces migrations après validation manuelle du fix
sur preview (cf section "Plan de validation" de la PR).
