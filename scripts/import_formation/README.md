# Routine d'import d'une formation (plan + questions) → SQL

Outil qui transforme **deux fichiers source** (le plan d'une formation et ses
questions) en **fichiers SQL prêts à appliquer** sur Supabase. Il génère aussi
un rapport de validation : si quelque chose ne va pas, il s'arrête et n'écrit
aucun SQL.

> ⚠️ `build.py` **ne touche jamais la base**. Il ne fait que *fabriquer* des
> fichiers `.sql`. L'application réelle sur Supabase se fait ensuite, à la main
> ou via la commande Claude Code `/import-formation` (qui passe par le MCP
> Supabase et ajoute deux points de contrôle humains).

## Les deux fichiers d'entrée

1. **`questions_<slug>.txt`** — le contenu pédagogique. Une section
   `===SEQUENCE===` par séquence, contenant des blocs `--- QUESTION n ---`
   (et `--- SOUS-QUESTION n ---` dans les cas cliniques). Chaque bloc porte les
   champs `TYPE :`, `ÉNONCÉ :`, `POINTS :`, `OPTIONS :`, `FEEDBACK :`.
2. **`_plan_summary.json`** — la structure de la formation : `formation_slug`,
   `formation_title`, `axe_cp`, et un tableau `sequences` où chaque entrée a
   `seq_num`, `seq_title`, `bloc`, `is_intro`, `is_conclusion`, `objectifs`.

Le **plan** est la source de vérité des titres, blocs et objectifs.
Le **fichier questions** est la source de vérité du contenu des questions.

## La commande à taper

```bash
python scripts/import_formation/build.py \
  --questions chemin/vers/questions_<slug>.txt \
  --plan chemin/vers/_plan_summary.json \
  --formation-id <UUID-de-la-formation> \
  --mode <refonte|create> \
  --out /tmp/import_<slug>
```

### Les arguments

| Argument | Obligatoire | Rôle |
|---|---|---|
| `--questions` | oui | le fichier `.txt` des questions |
| `--plan` | oui | le fichier `_plan_summary.json` |
| `--formation-id` | oui | l'UUID de la formation cible en base |
| `--out` | oui | dossier où écrire les fichiers générés |
| `--mode` | non (déf. `refonte`) | `refonte` = formation existante ; `create` = nouvelle |
| `--title` | non | titre à écrire (refonte). Par défaut : le titre du plan |
| `--purge-watch-logs` | non | inclut la purge des `course_watch_logs` (voir plus bas) |
| `--lot-size` | non (déf. `16`) | nombre cible de questions par lot SQL |

### `refonte` vs `create`

- **`refonte`** — la formation existe déjà en base. `setup.sql` met à jour le
  titre + `is_published=false` + `total_sequences`, supprime les anciennes
  séquences, puis (re)crée les N séquences du plan.
- **`create`** — formation nouvelle. La **ligne `formations` est créée à part**
  (par la commande `/import-formation` via le MCP, avec `RETURNING id`) ; on
  passe ensuite ce nouvel `id` à `--formation-id`. Dans ce mode, `setup.sql` ne
  contient **que** l'`INSERT` des séquences (aucun `UPDATE`, aucun `DELETE`).

### À propos de `--purge-watch-logs`

La suppression d'une séquence est **bloquée** s'il existe des `course_watch_logs`
(logs DPC/audio, contrainte FK `NO ACTION`). Par sécurité, `build.py` ne purge
**pas** ces logs par défaut : le `setup.sql` généré échouera proprement si des
logs existent. Pour des **comptes de test avant mise en ligne uniquement**, et
**après accord explicite de Julie**, relancer avec `--purge-watch-logs` pour
inclure leur suppression (scopée par `formation_id`).

## Ce que l'outil produit (dans `--out`)

| Fichier | Contenu |
|---|---|
| `questions.json` | le contenu parsé (séquences + questions), pour relecture |
| `setup.sql` | la **structure** : (UPDATE +) DELETE + INSERT des séquences |
| `commit_q1.sql`, `commit_q2.sql`, … | les **lots de questions** (~16 chacun) |

Ordre d'application sur Supabase : d'abord `setup.sql`, puis chaque
`commit_q*.sql` dans l'ordre.

## La validation (sécurité)

Avant de générer quoi que ce soit, `validate.py` contrôle notamment :

- **Séquences** : `seq_num` couvre `0..N-1` sans trou ni doublon ; titre non
  vide ; `bloc_number` final ∈ `[1,4]` ; `learning_objectives` est un tableau ;
  `is_intro=true` seulement sur S0.
- **Questions** : feedback non vide (sauf la ligne `case_study`) ; au moins une
  bonne réponse (`mcq`/`true_false`/`checkbox`) ; au moins un intrus
  (`highlight`) ; tableaux de même longueur et `correctAnswers` au format
  `i-LETTRE` (`matching`) ; positions `{1..n}` (`ordering`) ; réponses présentes
  dans le `wordBank` et plus de marqueur `[BLANC…]` ni « Banque de mots »
  (`fill_blank`) ; `patient` + `chief_complaint` renseignés et chaque
  sous-question avec au moins un bon choix (`case_study`).
- **Cohérence plan ↔ questions** : chaque séquence des questions existe dans le
  plan, et chaque séquence du plan reçoit des questions.
- **Comptage** : total attendu = `4 × nb_séquences` quand il n'y a aucune
  promotion de sous-question de cas clinique (sinon le nombre de promotions est
  affiché).

**S'il y a la moindre erreur, aucun fichier SQL n'est écrit** et le rapport
explique le problème (souvent un dialecte de source non géré → adapter le
parseur, puis relancer).

## Les 9 types de questions gérés

`mcq`, `mcq_image`, `true_false`, `checkbox`, `highlight` (l'intrus marqué
`(CORRECTE)` dans la source est **inversé** en `correct:false`), `ordering`
(source dans le bon ordre → positions fixées puis mélange), `matching`
(`gauche → droite`), `fill_blank` (3 dialectes, dont « Banque de mots ») et
`case_study` (sous-questions **conservées** si choix unique — y compris sans
ligne `TYPE :` — ou **promues** en question autonome si choix multiple ou type
structuré).

## Exemple

```bash
python scripts/import_formation/build.py \
  --questions exports/questions_overlays-felures.txt \
  --plan exports/_plan_summary.json \
  --formation-id af506ec2-1234-5678-9abc-def012345678 \
  --mode refonte \
  --out /tmp/import_overlays
```

Lire le rapport affiché, vérifier `questions.json`, puis appliquer le SQL via
`/import-formation`.
