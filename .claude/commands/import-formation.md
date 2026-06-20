# /import-formation — Importer une formation (plan + questions) dans Supabase

Routine d'import d'une formation DentalLearn V3. Reconstruit le quiz d'une formation à partir de 2 fichiers source, applique le SQL via le MCP Supabase, avec 2 points de contrôle humains.

**Projet Supabase** : `dxybsuhfkwuemapqrvgz`
**Référence de la démarche** : `IMPORT_FORMATION_SQL_DENTALLEARN_PROCEDURE.md` (project knowledge).

## Entrées attendues de l'utilisateur
- Le fichier `questions_<slug>.txt`
- Le fichier `_plan_summary.json`
(Demander leur chemin si non fournis.)

## Étapes à exécuter, dans l'ordre

1. **Vérifier la prémisse**
   - Lire `IMPORT_FORMATION_SQL_DENTALLEARN_PROCEDURE.md`.
   - Via MCP Supabase, confirmer la structure de `sequences` et `questions` et les contraintes (`bloc_number ∈ [1,4]`, `unique_sequence_question`, FK `course_watch_logs` NO ACTION).

2. **Cartographier** les 2 fichiers : nombre de séquences, types de questions, sous-questions, présence de `Texte à trous`. Afficher un résumé court.

3. **Localiser la formation** en base par slug/titre.
   - **Si elle existe** → c'est une **REFONTE**. Récupérer son `id`. Afficher : titre actuel, `is_published`, nb séquences/questions existants. Continuer en mode `refonte` (étapes 4 → 10).
   - **Si elle n'existe pas** (slug absent) → c'est une **CRÉATION**. Passer en mode `create` : sauter l'étape 4 (pas de dépendances) et l'arbitrage purge (rien à purger), aller à l'**ARBITRAGE 0** ci-dessous, créer la ligne `formations`, puis reprendre à l'étape 5 avec le nouvel `id`.

   **ARBITRAGE 0 — métadonnées de la nouvelle formation (mode `create` uniquement).** Proposer à Julie des valeurs pré-remplies à confirmer ou ajuster :
   - `instructor_name` (défaut `"Dentalschool"`),
   - `category` (proposer une valeur de la liste fermée selon le sujet),
   - `level` (défaut `"standard"`),
   - `dpc_hours` (à fournir, ex. 7.0), `cp_hours` (optionnel).
   `title`/`slug`/`total_sequences`/`axe_cp`/`cp_axe_id`/`cp_eligible` sont dérivés du plan (ne pas les redemander). Vérifier que le `slug` du plan n'existe pas déjà (contrainte UNIQUE).

   Puis créer la formation via MCP et **récupérer le nouvel `id`** :
   ```sql
   INSERT INTO formations
     (title, slug, instructor_name, category, level, access_type,
      total_sequences, is_published, cp_eligible, cp_axe_id, axe_cp, dpc_hours, cp_hours)
   VALUES
     ('<titre plan>', '<slug plan>', '<instructor>', '<category>', '<level>', 'full',
      <N>, false, <true|false>, <axe|NULL>, <axe|NULL>, <dpc_hours>, <cp_hours|NULL>)
   RETURNING id;
   ```
   Signaler à Julie le TODO avant publication : `description_short`, `description_long`, `cover_image_url`, `biblio_pdf_url` restent à compléter.

4. **Relever les dépendances** de la formation :
   ```sql
   WITH seqs AS (SELECT id FROM sequences WHERE formation_id='<FID>')
   SELECT
    (SELECT count(*) FROM course_watch_logs WHERE sequence_id IN (SELECT id FROM seqs)) AS watch_logs,
    (SELECT count(*) FROM user_sequences      WHERE sequence_id IN (SELECT id FROM seqs)) AS user_sequences,
    (SELECT count(*) FROM user_points         WHERE sequence_id IN (SELECT id FROM seqs)) AS user_points,
    (SELECT count(*) FROM user_question_review WHERE sequence_id IN (SELECT id FROM seqs)) AS uq_review,
    (SELECT count(*) FROM user_quest_completions WHERE sequence_id IN (SELECT id FROM seqs)) AS quest_completions,
    (SELECT count(*) FROM audio_generation_jobs WHERE sequence_id IN (SELECT id FROM seqs)) AS audio_jobs;
   ```

5. **Parser + valider** (sans toucher la base) :
   ```
   python scripts/import_formation/build.py \
     --questions <questions.txt> --plan <_plan_summary.json> \
     --formation-id <FID> --mode <refonte|create> --out /tmp/import_<slug>
   ```
   (`<FID>` = id existant en refonte, ou le nouvel id retourné par l'`INSERT` en création.)
   Afficher le rapport : nb questions, 4 par séquence ou non, nb promotions, types par séquence, et **toute alerte de validation**. **Si la validation échoue, s'arrêter** et expliquer le problème en français clair (souvent un dialecte de source non géré → adapter le parseur avant de continuer).

6. **ARBITRAGE 1 — feu vert purge (mode `refonte` uniquement).** Présenter à Julie l'impact exact, en s'appuyant sur les dépendances de l'étape 4 (ex. « X watch_logs + Y progressions supprimés ; Z user_points déliés/conservés »). Attendre « oui/non ». Rappeler que la suppression des `course_watch_logs` n'est faite que sur **comptes de test avant mise en ligne** et seulement si Julie l'autorise. *(En mode `create`, aucune purge : passer cette étape.)*

7. **ARBITRAGE 2 — titre (mode `refonte`).** Proposer : titre du plan vs titre actuel en base. Attendre le choix (Julie prend en général le titre du plan). *(En mode `create`, le titre du plan a déjà été posé à l'`INSERT` de l'étape 3 : passer cette étape.)*

8. **Appliquer le SETUP** via MCP Supabase (`execute_sql`) : coller `setup.sql`.
   - **Mode `refonte`** : transaction unique qui met à jour le titre choisi + `is_published=false` + `total_sequences=N` ; supprime les watch_logs si autorisé ; purge les anciennes séquences ; puis **crée les N séquences** avec leurs **blocs** (`bloc=max(1,bloc)`), **titres** (`seq_title`), **objectifs** (`objectifs` → `learning_objectives`), et `is_intro=true` sur S0.
   - **Mode `create`** : la ligne `formations` existe déjà (étape 3) ; `setup.sql` ne fait **que** l'`INSERT` des N séquences (mêmes blocs/titres/objectifs). Pas d'`UPDATE`, pas de `DELETE`.
   - C'est l'étape qui construit la **structure** de la formation (pas seulement les questions).
   - Si la transaction est rejetée (ex. contrainte bloc) : c'est annulé intégralement → corriger et relancer.

9. **Appliquer les lots** `commit_q1.sql … commit_qN.sql` un par un via MCP Supabase, dans l'ordre.

10. **Vérifier** en base :
    ```sql
    SELECT
     (SELECT title FROM formations WHERE id='<FID>')            AS titre,
     (SELECT is_published FROM formations WHERE id='<FID>')      AS pub,
     (SELECT total_sequences FROM formations WHERE id='<FID>')   AS total_field,
     (SELECT count(*) FROM sequences WHERE formation_id='<FID>') AS nb_seq,
     (SELECT count(*) FROM questions q JOIN sequences s ON s.id=q.sequence_id WHERE s.formation_id='<FID>') AS nb_q,
     (SELECT count(*) FROM course_watch_logs w JOIN sequences s ON s.id=w.sequence_id WHERE s.formation_id='<FID>') AS wlogs_restants;
    ```
    Puis le détail par séquence (nb=4, types, **blocs**, et présence des **titres + objectifs** sur les séquences créées). Confirmer à Julie : titre du plan appliqué, `is_published=false`, N séquences avec leurs blocs/objectifs, 4 questions chacune, `wlogs_restants=0`.

## Règles
- **Mode `create`** : la ligne `formations` est créée à l'étape 3 (avec `RETURNING id`), pas par `build.py`. Vérifier l'unicité du `slug`. Pas de purge ni d'arbitrage purge/titre. Signaler en fin de course le TODO : `description_short`, `description_long`, `cover_image_url`, `biblio_pdf_url` à compléter avant publication.
- Ne jamais appliquer de SQL avant les arbitrages requis validés (Arbitrage 0 en création ; Arbitrages 1 et 2 en refonte).
- Scoper tout DELETE/INSERT par `formation_id`.
- Laisser la formation `is_published=false` et les séquences vides côté audio (republication manuelle par Julie après pipeline NotebookLM → Sonnet → ElevenLabs).
- Échappement SQL : `'` → `''`, `"` interne JSON → `\"`, cast `::jsonb` sur `options`.
- En cas de dialecte de source inédit détecté à l'étape 5 : le signaler, adapter le parseur, re-valider — ne pas forcer un import non validé.
