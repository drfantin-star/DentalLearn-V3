# Rapport — Droits d'EXECUTE sur les RPC : Lot 0 + Lot 1 (triage)

18/09/2026 · Projet Supabase `dxybsuhfkwuemapqrvgz` · Branche `claude/confident-noether-cynb5w`

Suite au brief « Droits d'exécution des RPC : triage et fermeture ».
**Aucune fermeture n'a été appliquée** — ce document est le livrable du Lot 1,
à valider avant d'écrire la migration du Lot 2.

---

## Lot 0 — Confirmation de l'exposition

### Test HTTP (demandé par le brief)

Rejoué depuis le terminal de la session. **Échec réseau, pas réponse serveur** :

```
curl -X POST .../rest/v1/rpc/audio_jobs_cost_summary  -> HTTP 000
curl -X POST .../rest/v1/rpc/get_unscored_articles    -> HTTP 000
```

`HTTP 000` = la connexion n'a jamais abouti. Le proxy sortant de la session
refuse l'hôte :

```
"kind": "connect_rejected",
"detail": "gateway answered 403 to CONNECT (policy denial or upstream failure)",
"host": "dxybsuhfkwuemapqrvgz.supabase.co:443"
```

C'est **la même limitation que la session du 18/09** citée dans le brief. Le
test HTTP de bout en bout reste donc à faire depuis un poste non proxifié.

### Contournement — test côté base, en rôle `anon`

Le test décisif (le privilège `EXECUTE` est-il réellement accordé à `anon` ?)
a été rejoué directement sur la base, en prenant le rôle `anon` :

```sql
SET LOCAL ROLE anon;
SELECT current_user, public.audio_jobs_cost_summary() IS NOT NULL;
```

Résultat : `role_actif = anon`, `appel_reussi = true`.

**`anon` exécute bien la fonction.** La moitié « privilège » de l'hypothèse est
confirmée sans ambiguïté. La moitié restante — PostgREST expose-t-il le schéma
`public` en HTTP — n'est pas formellement vérifiée ici, mais elle est acquise
en pratique : tout le front appelle ses RPC par ce chemin.

Seule `audio_jobs_cost_summary()` a été appelée (lecture pure, aucun effet de
bord). `purge_old_notifications` et les deux `send_*` n'ont **pas** été
appelées.

---

## Lot 1 — Triage des 35 fonctions

Requête d'audit du brief rejouée : **35 fonctions** `SECURITY DEFINER`,
non-`trigger`, exécutables par `anon`. Chiffre du brief confirmé.

Appelants cherchés dans `src/`, `supabase/functions/`, `cron.job`,
`pg_policies`, les corps de fonctions (`pg_proc.prosrc`) et les vues.

Toutes ces fonctions appartiennent à `postgres` et sont `SECURITY DEFINER` :
un appel imbriqué depuis une autre fonction `SECURITY DEFINER` s'exécute donc
avec les droits de `postgres`, pas ceux de l'appelant. Fermer une fonction
utilisée uniquement en interne ne casse rien.

### Catégorie 1 — doit rester ouverte (20)

Appelée en session utilisateur depuis le front, ou publique par conception.

| Fonction | Appelant identifié |
|---|---|
| `add_secondary_validation(uuid,text)` | `src/components/cs/ValidateActions.tsx:96` (client, session CS) |
| `attestation_odpc_for(uuid,uuid)` | `src/components/attestations/GenerateAttestationButton.tsx:166` |
| `attestation_organisme_for(uuid,uuid)` | idem `:158` |
| `attestation_qualiopi_for(uuid,uuid)` | idem `:162` |
| `check_cold_survey_eligibility(uuid)` | `ColdSurveyEligibilityBadge.tsx:27`, `satisfaction-froid/[formationId]/page.tsx:111` |
| `get_admin_satisfaction_aggregates(uuid,timestamptz,timestamptz)` | `src/app/admin/satisfaction/page.tsx:77` (client) |
| `get_admin_satisfaction_export(uuid,timestamptz,timestamptz)` | idem `:114` |
| `get_admin_satisfaction_verbatims(uuid,timestamptz,timestamptz,boolean,boolean)` | idem `:82` |
| `get_daily_quiz(uuid)` | `src/app/api/daily-quiz/route.ts:70` — client **session** (`createClient()`), garde 401 |
| `get_epp_attestation_metrics(uuid,uuid)` | `GenerateAttestationButton.tsx:270` |
| `get_formation_completion_metrics(uuid,uuid)` | `GenerateAttestationButton.tsx:190` |
| `get_lifetime_leaderboard(uuid)` | `src/lib/hooks/useLeaderboard.ts:29` |
| `get_syntheses_for_validation()` | `useEditorialValidations.ts:332`, `src/lib/cs/data.ts:180,288,383` |
| `get_validation_status(varchar,uuid)` | `useEditorialValidations.ts:40,353` (session) **et** route admin |
| `get_weekly_quiz_leaderboard(uuid)` | `useWeeklyLeaderboard.ts:27`, `useLeaderboard.ts:29` |
| `has_user_completed_satisfaction(uuid)` | `GenerateAttestationButton.tsx:128`, `useSatisfactionSurvey.ts:35` |
| `is_formation_fully_completed(uuid,uuid)` | `GenerateAttestationButton.tsx:180` |
| `reveal_satisfaction_respondent(uuid,text)` | `src/components/admin/satisfaction/VerbatimCard.tsx:98` (client) |
| `verify_attestation_public(varchar)` | `src/app/verify/[code]/page.tsx:26` — **`anon` requis, ne pas fermer** |
| `user_can_see_formation(uuid,uuid)` | **helper RLS** — voir encadré ci-dessous |

> **`user_can_see_formation` — piège.** Elle n'est appelée nulle part dans
> `src/`, mais elle est utilisée dans **3 policies RLS** :
> `sequences_select_with_tenant_isolation`, `questions_select_with_tenant_isolation`,
> `epp_audits_select`. Les trois portent sur le rôle `{public}`, donc `anon`
> inclus. Une expression de policy est évaluée avec les droits de l'appelant :
> lui retirer `EXECUTE` ferait échouer toute lecture de `sequences`, `questions`
> et `epp_audits`. `20260502_sprint1_formations_owner_org.sql:61-63` accorde
> d'ailleurs explicitement `EXECUTE` à `authenticated`. **Ne pas fermer.**

### Catégorie 2 — à fermer à `anon` ET `authenticated` (8)

| Fonction | Appelant réel qui justifie la fermeture |
|---|---|
| `audio_jobs_cost_summary()` | route `/api/admin/audio-jobs/cost-summary` — `createAdminClient()` = **service_role** (`route.ts:46-47`) |
| `count_unscored_articles()` | Edge Function `score_articles` (`index.ts:256`) — **service_role** |
| `purge_old_notifications()` | **pg_cron** `notifications_purge_monthly` (jobid 40, `0 4 1 * *`) |
| `send_autoeval_reminders(text)` | **pg_cron** `autoeval_reminder_oct` (38) et `autoeval_reminder_dec` (39) |
| `send_autopilot_reminders(text)` | **pg_cron** `autopilot_reminder_mid` (41) et `autopilot_reminder_end` (42) |
| `regenerate_synthesis_from_fulltext(18 args)` | route `/api/admin/news/syntheses/[id]/regenerate:221` — `adminSupabase` = **service_role** |
| `is_sequence_completed(uuid,uuid)` | plus appelée par le front depuis `19a589c` (CLAUDE.md, dette AUTO-INSCR-D4). 0 occurrence dans `src/`. Appels internes uniquement (3 fonctions `SECURITY DEFINER` owner `postgres`) |
| `get_user_completed_sequences(uuid,uuid)` | idem CLAUDE.md, 0 occurrence dans `src/` |

### Catégorie 2 bis — fermer à `anon` seulement (1)

| Fonction | Justification |
|---|---|
| `is_cs_member(uuid)` | Utilisée par 3 policies RLS (`editorial_validations_cs_read`, `editorial_validations_cs_insert`, `news_episodes_cs_read`) — toutes en rôle **`{authenticated}`** uniquement. Aucun appel RPC direct depuis `src/` (le front passe par `hasRole()`). `authenticated` doit rester, `anon` n'a aucune raison d'être. |

### Catégorie 3 — incertaine, **ne rien fermer** (6)

Aucun appelant trouvé, nulle part : ni `src/`, ni Edge Functions, ni `cron.job`,
ni policy, ni corps de fonction, ni vue. Ce sont soit du code mort, soit des
RPC prévues pour un écran pas encore livré. À trancher par Dr Fantin.

| Fonction | Ce qu'on sait |
|---|---|
| `get_daily_quiz_questions(integer,uuid)` | 0 appelant. Non appelée par `get_daily_quiz`. Mort probable. |
| `get_formation_satisfaction_indicators(uuid)` | 0 appelant. Son commentaire SQL annonce pourtant « pour page formation app ». |
| `get_news_quiz_by_specialite(text,integer)` | 0 appelant hors sa migration d'origine `20260501_news_quiz_rpc.sql`. |
| `get_public_satisfaction_indicators()` | **Publique par conception** (commentaire : page `/qualite`, seuil 30 réponses) — mais **la page `/qualite` n'existe pas** dans `src/app/`. Fermer casserait la page le jour où elle sort. |
| `get_user_cp_progress(uuid)` | 0 appelant. |
| `is_user_premium(uuid)` | 0 appelant, aucune policy. |

### Récapitulatif

| Catégorie | Nombre |
|---|---|
| 1 — reste ouverte | 20 |
| 2 — fermer `anon` + `authenticated` | 8 |
| 2 bis — fermer `anon` seulement | 1 |
| 3 — incertaine, ne pas toucher | 6 |
| **Total** | **35** |

---

## Notes pour le Lot 3

- Les 4 fonctions réouvertes sans trace au repo (`send_autoeval_reminders`,
  `send_autopilot_reminders`, `purge_old_notifications`,
  `audio_jobs_cost_summary`) sont toutes en catégorie 2. L'hypothèse
  `DROP` + `CREATE` à chaud dans le SQL Editor reste la seule compatible avec
  l'état observé.
- `count_unscored_articles()` confirme le constat du brief : omise de la liste
  de 8 de `20260721e`, elle est ouverte depuis l'origine alors qu'elle est
  `SECURITY DEFINER` sur les mêmes tables que `get_unscored_articles`.
- La question du `ALTER DEFAULT PRIVILEGES` (deny-by-default) reste entière et
  n'est pas tranchée ici.
