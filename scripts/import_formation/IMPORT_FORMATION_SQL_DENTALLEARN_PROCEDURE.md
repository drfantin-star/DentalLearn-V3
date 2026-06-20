# Procédure — Import d'une formation (plan + questions) par SQL via Supabase MCP

**Objet** : reconstruire le quiz d'une formation DentalLearn V3 à partir de deux fichiers source (questions + plan), en parsant vers SQL puis en committant directement via Supabase MCP `execute_sql`.
**Projet Supabase** : `dxybsuhfkwuemapqrvgz` · **Admin UUID** : `af506ec2-a281-4485-a504-b0633c8d2362`
**Méthode validée sur 5 formations** : Stratification, Éclaircissement, IA générative, Communication bienveillante, Overlays/Fêlures.

---

## 1. Fichiers d'entrée

Deux fichiers fournis par séance :

1. **`questions_<slug>.txt`** — une section `===SEQUENCE===` par séquence, contenant les blocs `--- QUESTION n ---` (et `--- SOUS-QUESTION n ---` dans les cas cliniques). Chaque bloc porte les champs `TYPE :`, `ÉNONCÉ :`, `POINTS :`, `OPTIONS :`, `FEEDBACK :`.
2. **`_plan_summary.json`** — métadonnées : `formation_slug`, `formation_title`, `axe_cp`, `nb_sequences_total`, et un tableau `sequences` avec pour chaque séquence : `seq_num`, `seq_title`, `bloc`, `is_intro`, `is_conclusion`, `objectifs`.

Le plan est la **source de vérité du titre, des blocs et des objectifs**. Le fichier questions est la source de vérité du contenu pédagogique.

---

## 2. Workflow en 7 étapes

1. **Cartographier** les deux fichiers (compter séquences, types, sous-questions, repérer la présence de `Texte à trous`).
2. **Localiser** la formation cible en base (par slug/titre) et **relever ses dépendances**.
3. **Parser** les deux fichiers vers un JSON de questions + un plan exploitable.
4. **Valider** (script de contrôle ci-dessous) — zéro erreur avant tout commit.
5. **Demander deux arbitrages** à la porteuse : (a) feu vert purge + impact, (b) titre.
6. **Committer** : un transaction `SETUP` (titre + purge + séquences), puis les **lots de questions** atomiques.
7. **Vérifier** en base : titre, `is_published=false`, nb séquences, nb questions, 4 par séquence, types, `watch_logs` restants = 0.

> Workflow standard : cadrage ici → exécution → vérification MCP → republication manuelle par la porteuse après pipeline audio. Chaque formation reste **`is_published=false`** et séquences vides côté audio à la fin.

---

## 3. Schéma et contraintes vérifiés (à respecter absolument)

### Table `sequences`
Colonnes utiles à l'`INSERT` : `formation_id`, `sequence_number` (NOT NULL), `title` (NOT NULL), `bloc_number` (NOT NULL), `learning_objectives` (jsonb), `is_intro` (bool), `estimated_duration_minutes`.
- **`timeline_published` et `audio_history` sont NOT NULL mais ont des valeurs par défaut** → ne pas les inclure dans l'`INSERT`.
- **CONTRAINTE CRITIQUE `sequences_bloc_number_check` : `bloc_number ∈ [1,4]`.** Le plan met parfois l'intro en `bloc 0` → **coercer en `max(1, bloc)`** sinon l'`INSERT` est rejeté.
- **Pas de colonne `is_conclusion`.** Le flag `is_conclusion` du plan n'a pas de cible : la séquence de conclusion est simplement une séquence avec `is_intro=false`.
- `is_intro=true` uniquement sur S0.

### Table `questions`
Colonnes : `sequence_id` (FK→sequences, CASCADE), `question_order` (NOT NULL), `question_type`, `question_text` (NOT NULL), `options` (jsonb NOT NULL), `feedback_correct` + `feedback_incorrect` (**les DEUX NOT NULL**), `image_url`, `points` (déf. 10), `recommended_time_seconds` (déf. 60), `difficulty` (déf. 1, CHECK 1–3), `is_daily_quiz_eligible`.
- **Contrainte `unique_sequence_question` : UNIQUE(sequence_id, question_order)** → empêche les doublons, autorise donc de relancer un lot sans risque de duplication.
- **Contrainte `questions_source_check`** : XOR entre `sequence_id` et `news_synthesis_id` → une question de formation porte `sequence_id` (jamais les deux).
- **Contrainte `matching_new_format_only`** : pour un `matching`, les tableaux `pairs`, `options`, `correctAnswers` sont de **longueurs égales**.
- On renseigne `feedback_correct = feedback_incorrect =` le même feedback pédagogique (sauf cas clinique, voir §4).

### Clés étrangères au DELETE d'une séquence
- `questions` → **CASCADE** (les questions placeholder partent avec).
- `user_sequences` → **CASCADE**.
- `user_points`, `user_quest_completions`, `user_question_review.sequence_id` → **SET NULL** (les points sont conservés, simplement déliés).
- `audio_generation_jobs` → **CASCADE**.
- **`course_watch_logs.sequence_id` → NO ACTION** : **bloque** la suppression de séquence si des lignes existent. Ce sont des logs DPC/audio.

> **Suppression des `course_watch_logs`** : uniquement sur autorisation explicite de la porteuse et uniquement pour des **comptes de test avant mise en ligne**. Dans ce cas, le `SETUP` supprime d'abord ces logs (scopés par `formation_id`) pour débloquer le DELETE. Pour une formation publiée avec de vrais logs de production, basculer vers une stratégie non destructive (mise à jour en place plutôt que purge).

---

## 4. Les 9 types de questions et leur format `options`

| Type source | `question_type` | Structure `options` |
|---|---|---|
| QCM | `mcq` | `[{id,text,correct}]` |
| Vrai-Faux | `true_false` | `[{id,text,correct}]` — id A=Vrai, B=Faux |
| Cases à cocher | `checkbox` | `[{id,text,correct}]` (plusieurs `correct:true`) |
| Barrer intrus | `highlight` | `[{id,text,correct}]` |
| Ordonnancement | `ordering` | `[{id,text,correctPosition}]` |
| Association | `matching` | `{pairs:[{left,rightId}], options:[{id,text}], correctAnswers:["1-A",...]}` |
| Texte à trous | `fill_blank` | `{blanks:[{id,position,correctAnswer,alternatives:[]}], wordBank:[...]}` |
| Cas clinique | `case_study` | `{context:{patient,chief_complaint,history}, questions:[{id,order,points,text,choices:[{id,text,correct}],feedback}]}` |
| QCM image | `mcq_image` | `[{id,text,correct}]` |

**Règles de transformation :**
- **`highlight` (Barrer intrus) autonome** : la source marque l'**intrus** par `(CORRECTE)`. Le parseur **inverse** : l'intrus est stocké `correct:false`, les items valides `correct:true`.
- **`ordering`** : la source est numérotée dans le bon ordre → fixer `correctPosition` puis **mélanger** le tableau stocké.
- **`matching`** : source `gauche → droite`. Construire 3 tableaux de **longueur égale** ; `correctAnswers` au format `i-LETTRE`.
- **`fill_blank`** : remplacer `[BLANC_n]` par `(blanc n)` dans le texte et **mélanger** le `wordBank`.
- **`case_study`** : `patient` = 1re phrase du scénario, `chief_complaint` = 2e phrase, `history` = scénario complet. Feedback de la ligne = `"Cas clinique — voir les explications détaillées de chaque sous-question."`. Points de la ligne = somme des points des sous-questions conservées.

### Sous-questions de cas clinique : conserver ou promouvoir
Pour chaque sous-question :
- **Conserver** comme choix dans le `case_study` si elle est à **choix unique** (1 seul correct) ET de type QCM / Vrai-Faux / Barrer intrus **OU sans ligne `TYPE :`** (cas fréquent : le fichier omet le type ; une sous-question à 1 correct est alors un QCM simple à conserver).
- **Promouvoir** en question autonome (type natif) si elle est à correct multiple (checkbox) ou d'un type structuré (matching, ordering, fill_blank). La question promue prend les ordres 5, 6… avec le scénario préfixé : `Cas clinique : <scénario>\n\n<énoncé>`.
- Une « Barrer intrus » conservée **dans** un cas clinique est rendue comme choix unique normal → **pas d'inversion** (l'intrus reste `correct:true`).

### Dialectes `fill_blank` (Texte à trous)
Trois variantes de source rencontrées — le handler les gère toutes :
1. **Marqueurs** : chaque ligne d'option porte `(CORRECTE)`.
2. **Liste virgulée alternée** : items séparés par virgules, corrects en positions paires.
3. **Dialecte « Banque de mots »** (Overlays) : une ligne `Banque de mots : w1, w2, …` dans l'énoncé (corrects + distracteurs) + des `OPTIONS` du type `[BLANC_n] : mot (CORRECTE)`. Le parseur **extrait le wordBank de la ligne « Banque de mots », retire cette ligne de l'énoncé, et lit les corrects depuis les lignes `[BLANC_n] : mot`**. Sans ce traitement, les réponses gardent à tort le préfixe `[BLANC_n] :` et la banque de mots pollue l'énoncé.

---

## 5. Mécanisme de commit

### 5.1 SETUP (une transaction)
```sql
BEGIN;
UPDATE formations
   SET title = '<titre du plan>', is_published = false,
       total_sequences = <N>, updated_at = now()
 WHERE id = '<FID>';
-- Uniquement si watch_logs de test + autorisation explicite :
DELETE FROM course_watch_logs
 WHERE sequence_id IN (SELECT id FROM sequences WHERE formation_id = '<FID>');
DELETE FROM sequences WHERE formation_id = '<FID>';
INSERT INTO sequences
  (formation_id, sequence_number, title, bloc_number, learning_objectives, is_intro, estimated_duration_minutes)
VALUES
  (... N lignes, numéros 0..N-1, bloc coercé max(1,bloc), is_intro=true sur S0 ...);
COMMIT;
```

### 5.2 LOTS de questions (atomiques, ~16 questions ≈ 20–34 KB)
Découper par paquets de séquences (ex. pour 17 séq : `[0-3] [4-7] [8-11] [12-15] [16]`). Chaque lot :
```sql
INSERT INTO questions
  (sequence_id, question_order, question_type, question_text, options,
   feedback_correct, feedback_incorrect, image_url, points, recommended_time_seconds, difficulty)
SELECT s.id, v.qo, v.qt, v.txt, v.opt::jsonb, v.fb, v.fb, NULL, v.pts, v.tm, v.df
FROM (VALUES
  (<sn>, <qo>, '<type>', '<texte>', '<options jsonb>', '<feedback>', <pts>, <tm>, <df>),
  ...
) AS v(sn, qo, qt, txt, opt, fb, pts, tm, df)
JOIN sequences s ON s.formation_id = '<FID>' AND s.sequence_number = v.sn;
```
Le `JOIN sur sequence_number` évite d'avoir à connaître les UUID des séquences fraîchement créées.

### 5.3 Règles d'échappement SQL
- Apostrophes doublées : `'` → `''`.
- Guillemets internes au JSON échappés : `"` → `\"`.
- Cast explicite `::jsonb` sur la colonne `options`.
- Générer chaque `.sql` via Python puis le coller **verbatim** dans `execute_sql`.

### 5.4 Barème par défaut
| Type | points / temps (s) |
|---|---|
| mcq | 10 / 60 |
| true_false | 10 / 45 |
| checkbox | 15 / 60 |
| highlight | 10–15 / 45 |
| fill_blank | 20 / 60 |
| ordering | 15–20 / 90 |
| matching | 20 / 90 |
| case_study | (somme sous-q) / 120 |
`difficulty = 1` par défaut.

---

## 6. Validation avant commit (zéro erreur exigé)

Contrôles automatiques :
- `feedback` non vide (sauf ligne `case_study`).
- `mcq` / `true_false` / `checkbox` : au moins 1 `correct:true`.
- `highlight` : au moins 1 intrus (`correct:false`).
- `matching` : `pairs`, `options`, `correctAnswers` de **longueurs égales** ; `correctAnswers` cohérents au format `i-LETTRE`.
- `ordering` : l'ensemble des `correctPosition` = `{1..n}`.
- `fill_blank` : chaque `correctAnswer` non vide, présent dans le `wordBank`, **ne commence pas par `[BLANC`**, et la mention « Banque de mots » **n'apparaît plus** dans le texte.
- `case_study` : `patient` et `chief_complaint` non vides ; chaque sous-question a au moins 1 choix correct.
- Total attendu : avec 4 questions par séquence et 0 promotion, `nb_questions = 4 × nb_séquences`.

---

## 7. Pièges connus (issus des refontes passées)

- **`bloc 0` rejeté** par la contrainte → coercer en 1. (Si le SETUP échoue, la transaction `BEGIN…COMMIT` est intégralement annulée : rien n'est modifié, on régénère et on relance.)
- **Sous-questions de cas clinique sans `TYPE :`** : sans la règle « pas de TYPE + 1 correct = QCM conservé », le parseur vide les cas cliniques et laisse des trous d'ordre (1,2,3,5,6).
- **Dialecte `fill_blank` « Banque de mots »** : traitement dédié obligatoire (cf. §4).
- **`course_watch_logs` NO ACTION** : toujours vérifier les dépendances avant le DELETE ; ne supprimer ces logs que sur données de test autorisées.
- **`point_reason`** (système de points) : ne jamais utiliser `sequence_completed` (échec d'INSERT silencieux). Valeurs valides : `question_correct`, `speed_bonus`, `perfect_sequence`, `streak_bonus_3/7/14/30`, `badge_unlock`, `quest_reward`, `streak_bonus`, `leaderboard_reward`.
- **SQL volumineux** : un seul gros transaction (>40–50 KB) est peu fiable → découper en lots atomiques de ~16–20 questions.
- **Slug** : conserver le slug existant en base s'il diffère du slug du plan (ne pas le réécrire).

---

## 8. Checklist finale (à passer en base après les lots)

```sql
SELECT
 (SELECT title FROM formations WHERE id='<FID>')            AS titre,
 (SELECT is_published FROM formations WHERE id='<FID>')      AS pub,          -- attendu false
 (SELECT total_sequences FROM formations WHERE id='<FID>')   AS total_field,  -- = N
 (SELECT count(*) FROM sequences WHERE formation_id='<FID>') AS nb_seq,       -- = N
 (SELECT count(*) FROM questions q JOIN sequences s ON s.id=q.sequence_id
    WHERE s.formation_id='<FID>')                            AS nb_q,
 (SELECT count(*) FROM course_watch_logs w JOIN sequences s ON s.id=w.sequence_id
    WHERE s.formation_id='<FID>')                            AS wlogs_restants; -- = 0
```
Puis un contrôle par séquence (nb = 4 partout, types attendus, blocs corrects) :
```sql
SELECT s.sequence_number, s.bloc_number,
       count(q.id) AS nb,
       array_agg(q.question_type ORDER BY q.question_order) AS types
FROM sequences s LEFT JOIN questions q ON q.sequence_id=s.id
WHERE s.formation_id='<FID>'
GROUP BY s.sequence_number, s.bloc_number
ORDER BY s.sequence_number;
```

**Sortie attendue** : titre du plan, `is_published=false`, `total_sequences` = N, N séquences, 4 questions chacune sans trou d'ordre, `wlogs_restants = 0`. La porteuse republie après génération audio (NotebookLM → Sonnet → ElevenLabs).
