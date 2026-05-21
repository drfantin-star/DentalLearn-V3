# CLAUDE.md — DentalLearn V3

Repository conventions et contraintes d'infrastructure pour les agents IA
(Claude Code, etc.) travaillant sur ce projet.

## Validation explicite — pas de feature non demandée

Une mention dans la mémoire projet, un recap, un catalogue de fonctionnalités
ou une discussion antérieure **n'est pas** une demande de développement. Seul
le prompt de la session en cours fait foi.

### Interdit sans demande nominative dans le prompt courant

- Créer une table, colonne, contrainte, ou fichier `supabase/migrations/*.sql`
- Créer une route `src/app/api/**` ou une Edge Function `supabase/functions/**`
- Ajouter une dépendance à `package.json`
- Modifier middleware, layout guards, RLS, ou structure d'auth
- Implémenter un algorithme métier non trivial (gamification, scoring,
  scheduling, répétition espacée)
- Refactor structurel touchant > 5 fichiers

### Toléré sans validation supplémentaire

- Fix d'un bug nommé dans le prompt
- Refactor local d'un fichier nommé dans le prompt
- Ajout de tests pour code existant
- Correction de typo, console.log, TODO nommé
- Mise à jour de docs `*.md` demandée
- Suppression de code mort explicitement listé

### Si une feature semble pertinente mais non demandée

1. Ne pas l'implémenter
2. Terminer la tâche demandée
3. À la fin de la réponse, dans une section « Observations », signaler la
   suggestion en une phrase, sans code
4. Attendre la prochaine session avec un prompt explicite

**Justification** : une feature livrée sans demande crée une branche
orpheline, risque une collision de migration, consomme du temps de revue,
et brouille la lecture de la roadmap. Cas connu : `parking/sm2-spaced-repetition`
(mai 2026) — feature complète développée sans validation, migration en
collision de préfixe avec `20260516c_t6_audio_batch.sql`.

## Vercel Pro dependencies

Les routes suivantes nécessitent un plan Vercel **Pro ou supérieur** pour
fonctionner en production. Sur le plan **Hobby**, les routes Serverless
Node.js sont plafonnées à **10 s** d'exécution, ce qui coupe systématiquement
les appels LLM longs avant retour.

| Route | Runtime | `maxDuration` | Raison |
|---|---|---|---|
| `POST /api/admin/timeline/extract-scenes` | nodejs | 60 s | Appel Sonnet 4.6 d'extraction structurelle (~30-45 s par run) |

**Historique de la décision** (T5-bis-fix3, mai 2026) :
- Bascule vers `runtime = 'edge'` (fix2) : le build passait clean mais le
  worker edge crashait au runtime avec une réponse texte brute
  `"An error occurred"` (probablement un import transitif edge-incompatible
  dans `@supabase/ssr` ou le SDK Anthropic, jamais diagnostiqué à la racine).
- Bascule vers Supabase Edge Function (fix3 plan) : évaluée et **rejetée**.
  Coût de portage TS → Deno estimé à ~1660 lignes (schéma Zod
  `discriminatedUnion` + `.refine()`, `buildTimelineFromRaw`, prompt qui
  vient d'être itéré en T5-bis, helpers word-index/parse-recovery). Drift
  inévitable sur les itérations prompt futures, sans tests partagés.
- Décision : rester sur `nodejs` + `maxDuration = 60` et formaliser la
  dépendance Vercel Pro. Toute future route lente (T6, T8) suivra le même
  pattern.

## Constantes globales / hooks à NE PAS modifier

- `src/context/AudioContext.tsx` — contexte audio global, modifié uniquement
  via tickets dédiés
- `src/components/audio/AudioPlayer.tsx` — UI player, idem
- `course_watch_logs` (table) — préservé pour DPC
- `useSubmitSequenceResult` — seul write path autorisé sur `user_points`

## Système de points — `point_reason` enum

Le hook `useSubmitSequenceResult` (`src/lib/supabase/hooks.ts`, ~ligne 387)
est la seule source d'écriture autorisée sur `user_points`. Toute insertion
passe par le champ `reason` qui est un enum strict côté Supabase.

### Valeurs valides

```
question_correct
speed_bonus
perfect_sequence
streak_bonus_3
streak_bonus_7
streak_bonus_14
streak_bonus_30
streak_bonus
badge_unlock
quest_reward
leaderboard_reward
```

### Valeur interdite

**`sequence_completed`** — cette valeur n'existe PAS dans l'enum. Tout INSERT
l'utilisant échoue **silencieusement** côté Supabase (la transaction est
rejetée sans erreur JS visible). C'est le piège classique : pas d'exception
levée côté client, mais aucune ligne créée en DB → l'utilisateur ne reçoit
pas ses points.

### Règle

Toute modification du système de points doit :
1. Modifier uniquement `useSubmitSequenceResult` (pas d'autres write paths)
2. N'utiliser que des valeurs présentes dans l'enum ci-dessus
3. Si une nouvelle valeur est nécessaire, créer la migration d'extension
   d'enum **avant** de l'utiliser côté code

### Incident référence

Mai 2026 — un fix utilisant `sequence_completed` est resté orphelin 5 jours
sur la branche `claude/remove-preview-mode-YaAZL` avant détection. Aucune
erreur visible côté front, mais aucun point attribué pour les séquences
terminées sur cette branche. Workflow garde-fou : `git log
origin/main..origin/<branch> --oneline` avant toute suppression de branche.

## Source de vérité — progression des séquences

Depuis le commit `19a589c` (PR auto-inscription user, mai 2026), il existe
**une seule** source de vérité pour la complétion pédagogique.

- **`user_sequences`** = source unique **pédagogique** (progression, compteur
  "X/N", pastilles ✓, points). Stateful : 1 ligne par `(user_id, sequence_id)`,
  contrainte `UNIQUE(user_id, sequence_id)`. Toute UI de progression DOIT lire
  cette table (cf. `useUserFormationProgress` dans `src/lib/supabase/hooks.ts`).
- **`course_watch_logs`** = audit **DPC immuable**. Plusieurs logs par séquence
  possibles (tracking anti-skip). Ne JAMAIS l'utiliser pour l'UI pédagogique.
- Les RPC `is_sequence_completed()` et `get_user_completed_sequences()` ont été
  **retirés** en `19a589c` (ils s'appuyaient sur `course_watch_logs` et créaient
  une double source de vérité). Ne pas les recréer.
- **Unique pont autorisé** `course_watch_logs` → `user_sequences` :
  `backfillIntroCompletions` dans `src/components/formation/EnrollmentCTA.tsx`,
  qui rétro-marque à l'inscription les **intros audio-only** déjà écoutées
  (exclut toute intro possédant un quiz).

## Migrations SQL Supabase

### Convention de nommage

Format obligatoire : `<YYYYMMDD><lettre>_<slug>.sql`

- `YYYYMMDD` = date d'écriture (pas de la cible de release)
- `<lettre>` = `a`, `b`, `c`… en cas de plusieurs migrations le même jour
- `<slug>` = court, en `snake_case`, descriptif
- Fichier `_down.sql` jumelé obligatoire pour toute migration corrective
  (les seeds `*_seed.sql` en sont exemptés)

Exemples valides :
- `20260503c_sprint1_organizations_siret.sql`
- `20260516c_t6_audio_batch.sql`
- `20260516c_t6_audio_batch_down.sql`

Avant de créer une migration, **vérifier que le préfixe `YYYYMMDD<lettre>`
n'est pas déjà pris** dans `supabase/migrations/` :

    ls supabase/migrations/ | grep "^YYYYMMDD"

Si collision : passer à la lettre suivante (`a` → `b` → `c`…).

### Règles

- Toute migration doit être demandée **nominativement** dans le prompt
  courant (cf. règle « Validation explicite »).
- Pas de migration `draft`, `wip`, `tmp`, `_test`.
- Pas de timestamp futur (`YYYYMMDD` > date du jour).
- Toute migration destructive (`DROP TABLE`, `DROP COLUMN`, `ALTER ... DROP`)
  doit être explicitement signalée dans la conversation avant écriture.

### Incident référence

Mai 2026 — la branche `parking/sm2-spaced-repetition` contient
`20260516c_sm2_review.sql` qui collisionne avec `20260516c_t6_audio_batch.sql`
déjà mergé sur `main`. À renommer avant tout merge ultérieur. Source de
l'incident : feature non demandée + absence de vérification du préfixe.

## Couleurs interdites dans les nouveaux fichiers

`#2D1B96`, `#231575`, `#00D1C1` — anciennes constantes du design system,
remplacées par les tokens Tailwind du brand kit actuel.
