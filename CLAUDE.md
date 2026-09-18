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
et brouille la lecture de la roadmap. Cas connu : SM-2 (mai 2026) — feature
complète développée sans validation sur `parking/sm2-spaced-repetition`, avec
une migration en collision de préfixe. Elle a *ensuite* été validée et mergée
sur `main` (PR #352/#353) après renommage de la migration en
`20260516d_sm2_review.sql` ; le mécanisme de révision inter-sessions a été
retiré le 2026-06-14 (PR #378). Le coût de revue et de remise en ordre
reste l'illustration du problème.

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
- Les RPC `is_sequence_completed()` et `get_user_completed_sequences()` ne sont
  plus appelées par le frontend depuis `19a589c` (source de progression =
  `SELECT` direct sur `user_sequences`), mais restent présentes en base —
  suppression DB en attente (dette AUTO-INSCR-D4). Ne pas les réutiliser.
- **Unique pont autorisé** `course_watch_logs` → `user_sequences` :
  `backfillIntroCompletions` dans `src/components/formation/EnrollmentCTA.tsx`,
  qui rétro-marque à l'inscription les **intros audio-only** déjà écoutées
  (exclut toute intro possédant un quiz).

## SM-2 — objets DB à NE JAMAIS droper (mécanisme A conservé)

SM-2 (répétition espacée) est mergé sur `main` (PR #352/#353). Il existe
deux mécanismes, dont **un seul subsiste** :

- **Mécanisme A — remédiation fin de bloc (CONSERVÉ).** Re-pose en fin de
  bloc les questions ratées du même bloc.
- **Mécanisme B — révision inter-sessions (RETIRÉ le 2026-06-14, PR #378).**
  Phase `'review'` du `SequencePlayer` + route `/api/user/review-stats`.
  Surface retirée ; la RPC orpheline `get_sm2_review_questions(uuid,uuid,integer)`
  est droppée par `supabase/migrations/20260614a_drop_sm2_review_questions.sql`.

**GOTCHA — ne JAMAIS droper ces objets** (le mécanisme A en dépend) :

- Table `user_question_review`
- RPC `update_sm2_state`
- RPC `record_question_acquisition`
- RPC `get_bloc_failed_questions`
- RPC `get_bloc_acquisition_status`

Seule `get_sm2_review_questions` (propre au mécanisme B retiré) était
orpheline et a été supprimée. Toute confusion qui mènerait à droper un objet
de la liste ci-dessus casserait la remédiation fin de bloc en production.

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

Mai 2026 — la migration SM-2 `20260516c_sm2_review.sql` collisionnait avec
`20260516c_t6_audio_batch.sql` déjà mergé sur `main`. **Résolu** : renommée
en `20260516d_sm2_review.sql` puis mergée (PR #352/#353). Source de
l'incident : feature non demandée + absence de vérification du préfixe — la
règle de vérification du préfixe (`ls supabase/migrations/ | grep "^YYYYMMDD"`)
en découle directement.

## Convention RPC : cast explicite varchar → text

Tout RPC qui retourne `TABLE(...)` doit caster explicitement les colonnes
tirées de tables avec types `varchar(N)` quand le `RETURNS TABLE` déclare
`text` :

```sql
-- À éviter :
SELECT f.title FROM formations f  -- f.title est varchar(255)
-- RETURNS TABLE (formation_title text)  → erreur 42804 à l'exécution

-- À utiliser :
SELECT f.title::text AS formation_title FROM formations f
-- ou aligner le RETURNS sur varchar :
-- RETURNS TABLE (formation_title varchar)
```

Le cas inverse (varchar → varchar de taille différente) est généralement
toléré par PostgreSQL, mais le cast explicite reste préférable pour la
clarté de l'intention.

Bug historique : `get_daily_quiz` échouait silencieusement en prod
(masqué par fallback API) jusqu'à PR #346 (27/05/2026). Audit varchar/text
sur les 20 RPC : aucun autre bug latent, tous les RPC post-`get_daily_quiz`
suivent déjà le pattern.

## Convention RPC : REVOKE explicite après tout CREATE FUNCTION

Le schéma `public` porte des droits par défaut Supabase (`pg_default_acl`)
qui accordent automatiquement `EXECUTE` à `anon`, `authenticated` et
`service_role` sur **toute fonction nouvellement créée**.

`REVOKE ... FROM PUBLIC` **ne les retire pas** : ce sont des droits nommés,
pas le pseudo-rôle `PUBLIC`. Le `REVOKE` doit nommer les rôles.

```sql
-- Insuffisant — anon et authenticated gardent EXECUTE :
REVOKE EXECUTE ON FUNCTION public.ma_rpc(integer) FROM PUBLIC;

-- Correct :
REVOKE EXECUTE ON FUNCTION public.ma_rpc(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ma_rpc(integer) FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.ma_rpc(integer) TO postgres, service_role;
```

### Quand la règle mord

`CREATE OR REPLACE` sur une fonction existante **conserve** son ACL : pas de
problème. Le piège est le `DROP` + `CREATE`, obligatoire dès qu'on change la
signature (ajout ou retrait d'un paramètre). La fonction recréée repart des
droits par défaut, et toute fermeture antérieure est silencieusement annulée.

C'est particulièrement grave sur une fonction `SECURITY DEFINER`, qui
contourne la RLS par construction : la rouvrir à `anon` expose les tables
sous-jacentes via PostgREST, même quand leur RLS ne laisse passer que
`service_role`.

### Fonctions devant rester fermées à `anon` / `authenticated`

`20260721e_sec_lot1_close_surface.sql` (21/07/2026) a fermé 8 fonctions
`SECURITY DEFINER` appelées uniquement par pg_cron, par des routes
service_role ou par un trigger. Toute migration qui en recrée une doit
rejouer le `REVOKE`.

⚠️ **État mesuré le 18/09/2026 : 5 des 8 sont de nouveau ouvertes.** La
fermeture de juillet n'a donc pas tenu, et le rollback `20260721e_*_down.sql`
n'a pas été joué (la RLS qu'il désactiverait est toujours active).

| Fonction | État 18/09/2026 | Recréée par |
|---|---|---|
| `send_autoeval_reminders(text)` | ❌ ouverte | aucune migration au repo |
| `send_autopilot_reminders(text)` | ❌ ouverte | aucune migration au repo |
| `purge_old_notifications()` | ❌ ouverte | aucune migration au repo |
| `audio_jobs_cost_summary()` | ❌ ouverte | aucune migration au repo |
| `handle_new_user()` | ❌ ouverte | `20260722a_handle_new_user_cp_seed.sql` |
| `get_unscored_articles(...)` | ✅ refermée le 18/09 | `20260918a` (incident ci-dessous) |
| `get_cold_survey_recipients()` | ✅ fermée | — |
| `mark_cold_survey_notified(uuid,text)` | ✅ fermée | — |

Pour les 4 sans migration identifiée, l'hypothèse est un `DROP` + `CREATE`
appliqué à chaud dans le SQL Editor — un `CREATE OR REPLACE` aurait conservé
l'ACL. C'est le même mécanisme de dérive que celui documenté pour les crons :
un correctif hors migration que rien dans le repo ne trace.

Portée réelle de l'ouverture : `handle_new_user()` retourne `trigger` et n'est
donc pas appelable via PostgREST malgré le grant. Les 4 autres le sont, dont
`purge_old_notifications()` qui **supprime des lignes**, et les deux
`send_*_reminders(text)` qui **déclenchent des envois**.

`verify_attestation_public(varchar)` reste volontairement exposée à `anon`
(page `/verify`). Ne pas la fermer.

`count_unscored_articles()` est ouverte depuis l'origine : `20260721e` l'avait
omise de sa liste de 8, alors qu'elle est `SECURITY DEFINER` sur les mêmes
tables que `get_unscored_articles`.

### Vérification après toute migration créant une fonction

```sql
SELECT p.oid::regprocedure, p.prosecdef,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_peut,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_peut
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = '<nom_fonction>';
```

Attendu sur une RPC service_role-only : `anon_peut` et `auth_peut` à `false`.

### Incident référence

Septembre 2026 — `20260918a_rpc_get_unscored_articles_freshness.sql` ajoutait
un paramètre `freshness_days` à `get_unscored_articles`, donc `DROP` +
`CREATE`. La migration ne faisait que `REVOKE ... FROM PUBLIC` : la RPC
`SECURITY DEFINER` est redevenue appelable par `anon` via PostgREST, rouvrant
ce que `20260721e` avait fermé deux mois plus tôt. ACL constatée après
application : `{postgres,anon,authenticated,service_role}`. Détectée par
hasard, à la relecture de l'état de la fonction après une erreur sans rapport
(`42883` sur un `DROP` rejoué) — la PR #442 était déjà mergée. Aucune donnée
personnelle concernée (métadonnées de littérature scientifique publiée), mais
contournement de RLS avéré.

La détection a déclenché l'audit des 8 fonctions de `20260721e`, qui a révélé
les 5 réouvertures du tableau ci-dessus. Aucune n'est corrigée à ce jour —
sujet à traiter dans une session dédiée, pas au fil de l'eau.

## Couleurs interdites dans les nouveaux fichiers

`#2D1B96`, `#231575`, `#00D1C1` — anciennes constantes du design system,
remplacées par les tokens Tailwind du brand kit actuel.
