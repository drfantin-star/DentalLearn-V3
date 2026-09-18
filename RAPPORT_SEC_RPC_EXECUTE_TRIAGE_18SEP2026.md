# Rapport — Droits d'EXECUTE sur les RPC : Lots 0, 1 et 2

18/09/2026 · Projet Supabase `dxybsuhfkwuemapqrvgz` · Branche `claude/confident-noether-cynb5w`

Suite au brief « Droits d'exécution des RPC : triage et fermeture ».
Le tableau du Lot 1 a été validé, puis la migration du Lot 2 a été écrite sur
le périmètre validé (9 fonctions). **La migration n'est pas encore appliquée
en base** : application manuelle par le SQL Editor, cf. dernière section.

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


---

## Lot 2 — Migration de fermeture

Fichiers : `supabase/migrations/20260918c_sec_rpc_execute_triage.sql`
et son `_down.sql`. Préfixe vérifié (`20260918a` et `b` déjà pris, `c` libre).

Périmètre validé : les 8 de catégorie 2 + `is_cs_member` (anon seulement).
Les 6 de catégorie 3 ne sont pas touchées. `handle_new_user()` non plus — hors
du périmètre validé pour ce lot (cf. Observations).

### Découverte : il faut DEUX `REVOKE`, pas un

L'audit ACL détaillé (`aclexplode` sur `pg_proc.proacl`) contredit en partie le
diagnostic du brief. Les fonctions ouvertes à `anon` le sont par **deux chemins
distincts** :

| Chemin | Forme dans `proacl` | Retiré par |
|---|---|---|
| grant **nommé** à `anon` / `authenticated` (défaut Supabase, `pg_default_acl`) | `anon=X/postgres` | `REVOKE ... FROM anon, authenticated` **uniquement** |
| grant au pseudo-rôle **PUBLIC** (défaut PostgreSQL natif) | `=X/postgres` | `REVOKE ... FROM PUBLIC` **uniquement** |

Et le relevé du 18/09 montre que les deux coexistent dans la nature :

| Fonction | PUBLIC | `anon` nommé | `authenticated` nommé |
|---|:--:|:--:|:--:|
| `audio_jobs_cost_summary()` | ✅ | — | — |
| `purge_old_notifications()` | ✅ | — | — |
| `send_autoeval_reminders(text)` | ✅ | — | — |
| `send_autopilot_reminders(text)` | ✅ | — | — |
| `handle_new_user()` | ✅ | — | — |
| `count_unscored_articles()` | — | ✅ | ✅ |
| `is_cs_member(uuid)` | ✅ | ✅ | ✅ |
| `is_sequence_completed(uuid,uuid)` | ✅ | ✅ | ✅ |
| `get_user_completed_sequences(uuid,uuid)` | ✅ | ✅ | ✅ |
| `regenerate_synthesis_from_fulltext(18 args)` | ✅ | ✅ | ✅ |

**Conséquence directe sur le récit du brief.** Les 5 fonctions dites
« réouvertes » depuis `20260721e` n'ont **aucun grant nommé** à `anon`. Le
`REVOKE EXECUTE ... FROM anon, authenticated` de juillet a donc parfaitement
tenu : les grants nommés ne sont jamais revenus. Ce qui les rouvre est le grant
**PUBLIC**, revenu avec le `DROP` + `CREATE` — et que `20260721e` n'avait jamais
retiré.

Autrement dit, rejouer tel quel le `REVOKE ... FROM anon, authenticated` de
juillet **n'aurait rien fermé du tout**. C'est le symétrique exact du piège
documenté dans `CLAUDE.md`, et il coexiste avec lui.

La migration applique donc systématiquement les trois lignes de la convention
`CLAUDE.md` : `REVOKE FROM PUBLIC`, puis `REVOKE FROM anon, authenticated`,
puis `GRANT TO postgres, service_role`.

### Rollback non uniforme

Le `_down.sql` ne peut pas être symétrique ligne à ligne, puisque l'état
d'origine différait d'une fonction à l'autre. Il restaure trois groupes
distincts (PUBLIC seul / grants nommés seuls / les deux), documentés en tête
de fichier. Restauration à l'identique du relevé du 18/09.

### Vérifications faites avant écriture

- Les 9 signatures écrites dans la migration résolvent bien en base
  (`::regprocedure`), y compris celle à 18 arguments avec le type `vector`.
- Aucun `DROP`, aucun changement de signature ni de corps : la migration ne
  touche que des privilèges, et est rejouable sans effet de bord.

---

## Application manuelle (SQL Editor) — à faire par Dr Fantin

Convention du repo : bloc DDL et bloc SELECT dans deux `Run` séparés.

**Run 1** — coller le contenu de
`supabase/migrations/20260918c_sec_rpc_execute_triage.sql`.

**Run 2** — coller ce bloc de vérification :

```sql
SELECT p.oid::regprocedure::text AS fonction,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon_peut,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_peut,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS svc_peut
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('audio_jobs_cost_summary','count_unscored_articles',
                    'purge_old_notifications','send_autoeval_reminders',
                    'send_autopilot_reminders','regenerate_synthesis_from_fulltext',
                    'is_sequence_completed','get_user_completed_sequences','is_cs_member')
ORDER BY 1;
```

Attendu : `anon_peut = false` sur les 9. `auth_peut = false` sur les 8
premières et **`true` sur `is_cs_member`** (obligatoire — sinon les policies RLS
du Comité Scientifique cassent). `svc_peut = true` partout.

**Run 3** — critère d'acceptation du brief : la requête d'audit du Lot 1 ne doit
plus renvoyer que des fonctions de catégorie 1 (et les 6 de catégorie 3,
laissées ouvertes volontairement). Elle doit passer de 35 à 26 lignes.

```sql
SELECT count(*) AS restantes
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prokind = 'f' AND p.prosecdef
  AND has_function_privilege('anon', p.oid, 'EXECUTE')
  AND pg_get_function_result(p.oid) <> 'trigger';
```

### Parcours front à re-tester après application

Le SQL ne suffit pas (critère d'acceptation du brief) :

- `/verify/[code]` — vérification d'attestation en **navigation privée**,
  déconnecté (c'est le seul parcours réellement `anon`).
- Ouvrir une formation, lire une séquence, répondre à un quiz — valide que
  `user_can_see_formation` et les policies RLS n'ont pas bougé.
- Générer une attestation — c'est l'écran qui appelle le plus de RPC
  (`attestation_*_for`, `get_formation_completion_metrics`,
  `is_formation_fully_completed`, `has_user_completed_satisfaction`).
- Espace Comité Scientifique `/cs` — valide `is_cs_member` et ses policies.
- Quiz du jour — valide `get_daily_quiz`.
