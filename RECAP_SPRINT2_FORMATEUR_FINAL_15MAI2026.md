# RECAP SPRINT 2 — Espace Formateur DentalLearn

**Date** : 15 mai 2026
**Sprint** : Sprint 2 Espace Formateur V1
**Tickets couverts** : T1 → T8 (8/8 — sprint clôturé)
**Repo** : `github.com/drfantin-star/DentalLearn-V3.git`
**Production** : `https://dental-learn-v3.vercel.app`
**Supabase** : projet `dxybsuhfkwuemapqrvgz`
**Admin UUID** : `af506ec2-a281-4485-a504-b0633c8d2362`

---

## 1. Tableau récap tickets T1 → T8

| Ticket | Statut | PR | Commit(s) clés | Date merge | Résumé livrable |
|---|---|---|---|---|---|
| **T1** — Migration BDD 5 tables entités formateur | ✅ Mergé | #260 | `b2fdbe0` | 11/05 | `formation_instructors`, `formateur_profiles`, `live_events`, `live_sessions`, `live_registrations` + 3 helpers SQL + RLS 20 policies |
| **T2** — Helpers RBAC + UI admin promotion/rattachement | ✅ Mergé | #261 | `243696d` | 12/05 | `isFormateur()`, guard middleware, pages `/admin/formateurs` + `/admin/formations/[id]/instructors`, layout `/formateur/*` |
| **T3** — Dashboard stats formateur | ✅ Mergé | #264 | `d9ea28b` + `f775449` (fix garde) | 13/05 matin | Page `/formateur/dashboard`, 4 KPIs globaux, détail par formation, `formateur_aggregated_stats()` + garde `auth.uid()` |
| **T3.5** — Pont navigation home → espaces dédiés | ✅ Mergé | #266 | `69427f8` + `d349430` + `573456d` | 13/05 après-midi | BottomNav contextuel (Admin > Formateur > Cabinet), fix cache stale, fix RPC enum supabase-js, fix `cache()` incompatible Edge |
| **T4** — Agenda live_events CRUD présentiel | ✅ Mergé | #274 | `1057667` | 15/05 | Page `/formateur/agenda`, soft-delete `deleted_at`, `UpcomingEvents` sur fiche formation, routes CRUD `/api/formateur/events` |
| **T5** — Masterclass live + inscriptions | ✅ Mergé | #277 | `599ad68` + `e022d43` (fix zoom mask) | 15/05 | `computeSessionStatus/CanJoin`, page `/sessions/[id]`, routes `/api/sessions/[id]/register`, zoom_url masqué non-inscrits |
| **T6** — Profil public formateur | ✅ Mergé | #281 | `f397aed` | 15/05 | Page `/formateur/profil` édition + `/formateurs/[slug]` public (connectés uniquement), upload photo Storage, champs bio/ville/instagram |
| **T7** — Push notifications rappels live + suivre formateur | ✅ Mergé | — | `c27761c`, `a4bdc85`, `a94cef3`, `7a1f9f1`, `01e4786`, `4254b02` | 15/05 | Edge Functions `live_session_reminders` + `notify_followers_new_publication`, crons horaires, `FollowButton`, toggles préférences |
| **T8** — RLS fix + E2E + Documentation + Smoke prod | ✅ Mergé | EN COURS | — | 15/05 | Fix RLS `live_session_reminders_sent`, 7 specs Playwright squelettes, docs mises à jour, script smoke prod |

---

## 2. BDD finale post-Sprint 2

### Tables Sprint 2 (7 tables)

| Table | Migrations | RLS | Notes |
|---|---|---|---|
| `formation_instructors` | T1 | ✅ | UNIQUE(formation_id, user_id), swap `is_primary` transactionnel |
| `formateur_profiles` | T1 + T6 (4 colonnes) | ✅ | `user_id` FK (PAS `formateur_user_id`). `slug`/`display_name` nullable (D2-T6-slug) |
| `live_events` | T1 + T4 (`deleted_at`) | ✅ | `formateur_user_id` FK. Soft delete. CHECK `ends_at > starts_at` |
| `live_sessions` | T1 + T5 (`deleted_at`) | ✅ | `formateur_user_id` FK (PAS `user_id`). Soft delete. `zoom_url` en clair V1 |
| `live_registrations` | T1 + T5 (fix RLS DELETE) | ✅ | UNIQUE(session_id, user_id). Désinscription = DELETE réel |
| `formateur_followers` | T7 | ✅ | UNIQUE(user_id, formateur_user_id). REVOKE anon |
| `live_session_reminders_sent` | T7 (création) + T8 (RLS activée) | ✅ | UNIQUE(session_id, user_id, reminder_type). service_role only |

**Convention nommage colonnes (coexistantes — piège confirmé)** :
- `formateur_profiles.user_id` — convention T1
- `live_sessions.formateur_user_id` — convention T1 différente
- Toujours vérifier avant d'écrire une requête.

### Colonnes ajoutées sur tables existantes

| Table | Colonne | Ticket |
|---|---|---|
| `notifications` | `metadata jsonb` | T7 |
| `user_notification_preferences` | `live_session_reminders boolean DEFAULT true` | T7 |
| `user_notification_preferences` | `formateur_publications boolean DEFAULT true` | T7 |

### Crons actifs Sprint 2

| Job pg_cron | Schedule | Edge Function |
|---|---|---|
| `live_session_reminders` | `0 * * * *` | `live_session_reminders` |
| `notify_followers_new_publication` | `30 * * * *` | `notify_followers_new_publication` |

Migration : `20260515_sprint2_t7_crons.sql`.

### Edge Functions Sprint 2

- **`live_session_reminders`** : rappels push J-1 + H-1. Idempotence `ON CONFLICT DO NOTHING`. VAPID keys dans secrets Supabase (PAS Vercel env).
- **`notify_followers_new_publication`** : notif followers nouvelles publications. Debounce 24h via `notifications.metadata`. Déclenché sur `created_at` (D2-T7-02).

---

## 3. Dettes accumulées Sprint 2

| ID | Description | Sévérité | À traiter |
|---|---|---|---|
| **D2-T6-01** | `formateur_profiles` non créé automatiquement si formateur rétrogradé puis re-promu (logique T2) | Mineure | Sprint 3 |
| **D2-T6-slug** | `slug` et `display_name` non auto-générés au premier INSERT de `formateur_profiles` (colonnes nullable comme garde-fou, migration PR #284). Fix propre : lire `auth.users.email` dans `PATCH /api/formateur/profil` et générer `slug`+`display_name` si absents. Workaround actuel : hydratation SQL manuelle par super_admin. | **Importante** | Sprint 3 |
| **D2-T7-01** | Test reminder push réel non exécuté en prod — nécessite une session live de test à +24h | Mineure | T8 smoke manuel (voir §5) |
| **D2-T7-02** | `notify_followers_new_publication` déclenché sur `created_at` (pas `published_at`) — session créée >1h avant publication ne notifie pas les followers | Acceptable V1 | Sprint 3 |
| **D2-T3.5-02** | Audit autres RPC à enum dans le projet (bug silencieux `supabase-js v2 + @supabase/ssr 0.1.0` — retourne `false`/`null` silencieusement). Workaround appliqué sur `hasRole()` : lecture directe `user_roles`. Autres RPC à auditer. | **Importante** (sécurité fonctionnelle) | Sprint 3 |

Dettes secondaires (hors focus T8) :
- **D2-T2-02** : rétrogradation ne nettoie pas `formation_instructors` (orphelines visibles sur fiches formations) → Sprint 3
- **D2-T3.5-01** : refonte UX `/profil` unifiée (header vs section incohérents) → Sprint 3
- **D2-T3.5-03** : pas de mémoization request-scoped (`cache()` incompatible Edge) → acceptable V1
- **D2-T4-01** : `GET /api/formateur/events` délègue filtre `deleted_at IS NULL` à RLS uniquement → Sprint 3
- **D2-T5-01** : `cancelled_at` sur `live_registrations` inutilisée (désinscription = DELETE réel) → si stats annulations requises
- **D2-T6-03** : couleurs polices inputs espace formateur (dark text fond clair desktop) → session Design System

---

## 4. Contraintes non-négociables rappelées

- **`course_watch_logs` : NE JAMAIS TOUCHER** — obligation réglementaire DPC (attestations Qualiopi). Toute modification = risque contentieux.
- **Pas de contrôle de vitesse lecture audio** nulle part dans l'application.
- **Migrations versionnées `YYYYMMDD_sprint_*.sql`** avec `_down.sql` symétrique obligatoire.
- **Modifications additives uniquement** — jamais de full rewrite de pages/composants existants.
- **`REVOKE ALL` toujours explicite sur `anon` ET `authenticated`** (pas seulement `PUBLIC`) — Supabase grant `anon` automatiquement depuis fin 2025.
- **Pas de `localStorage`/`sessionStorage`** — React state uniquement.
- **`onClick={() => { void handleAsync() }}`** sur tous les handlers async dans les composants (`ButtonProps` n'accepte pas `() => Promise<void>`).
- **`bg-primary` jamais `bg-[#2D1B96]`** — utiliser les tokens Design System.
- **`cache()` React incompatible Edge Runtime** (`middleware.ts`) — ne pas importer dans le middleware des helpers qui utilisent `cache()`.
- **RPC PostgREST + enum** : bug silencieux supabase-js — préférer lecture directe `.from().select().eq()` (cf. fix D2-T3.5-02).

---

## 5. Prochaines étapes recommandées

### Onboarding formateurs (immédiat post-T8)
- [ ] Créer profil Dr Weisrock : `INSERT INTO formateur_profiles` (workaround D2-T6-slug) + `INSERT INTO user_roles(formateur)`
- [ ] Créer profil Dr Elbeze : idem
- [ ] Publier les 2 profils (`is_published = true`)
- [ ] Assigner chaque formateur à ses formations dans `/admin/formations/[id]/instructors`

### Smoke test manuel T8 (Dr Fantin) — 7 points
- [ ] 1. Connexion super_admin → `/admin/formations/[id]/instructors` → assigner formateur test ✓
- [ ] 2. Connexion formateur test → `/formateur/dashboard` → stats visibles ✓
- [ ] 3. Créer un live_event test (date future, lieu Paris) → visible sur fiche formation ✓
- [ ] 4. Créer une live_session test (`starts_at = now()+30min`) → user test s'inscrit ✓
- [ ] 5. `/formateurs/test-user` accessible user connecté ✓ (slug confirmé BDD 15/05)
- [ ] 6. Invoquer Edge Function `live_session_reminders` : `curl -X POST https://dxybsuhfkwuemapqrvgz.supabase.co/functions/v1/live_session_reminders -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" -H "Content-Type: application/json" -d '{"limit":10}'` → vérifier row dans `live_session_reminders_sent` (D2-T7-01 validé)
- [ ] 7. `live_session_reminders_sent` inaccessible avec anon key → 401/403 (T8 RLS fix vérifié)

### Sprint 3 — priorités recommandées
1. **Fix D2-T6-slug** : auto-génération `slug`+`display_name` dans `PATCH /api/formateur/profil`
2. **Fix D2-T3.5-02** : audit complet des RPC à enum dans le projet
3. **Fix D2-T2-02** : cleanup `formation_instructors` à la rétrogradation formateur
4. Sélecteur période dashboard (T3), graphique temporel
5. Refonte UX `/profil` unifiée (D2-T3.5-01)
6. Validation RGPD avocat (modèle A) + CGU différenciées par tenant

---

## 6. Fichiers créés / modifiés — Sprint 2 (récap complet)

```
supabase/migrations/
  20260511_sprint2_formateur_entities.sql + _down.sql          (T1)
  20260512_sprint2_t3_formateur_stats_impl.sql + _down.sql     (T3)
  20260514_sprint2_live_events_deleted_at.sql + _down.sql      (T4)
  20260514_sprint2_sessions_rls_fix.sql + _down.sql            (T5)
  20260515_sprint2_formateur_profile_fields.sql + _down.sql    (T6)
  20260515_sprint2_t7_notifications_followers.sql + _down.sql  (T7)
  20260515_sprint2_t7_crons.sql + _down.sql                    (T7)
  20260515_sprint2_t8_rls_fix.sql + _down.sql                  (T8)

supabase/functions/
  live_session_reminders/index.ts                              (T7)
  notify_followers_new_publication/index.ts                    (T7)

src/lib/auth/rbac.ts                          (T2 + T3.5 — isFormateur, hasRole, getFormateurFormations)
src/lib/utils/session-status.ts               (T5 — computeSessionStatus/Label/CanJoin)
src/lib/schemas/live-event.ts                 (T4)
src/lib/schemas/live-session.ts               (T5)
src/lib/schemas/formateur-profil.ts           (T6)

src/app/api/formateur/
  events/route.ts + events/[id]/route.ts      (T4)
  formations/route.ts                          (T4)
  sessions/route.ts + sessions/[id]/route.ts  (T5)
  profil/route.ts + profil/avatar/route.ts    (T6)

src/app/api/sessions/[id]/
  route.ts + register/route.ts                (T5)

src/app/api/formateurs/[slug]/
  route.ts                                     (T6)
  follow/route.ts                              (T7)

src/app/api/public/
  events/route.ts                              (T4)
  sessions/route.ts                            (T6)

src/app/api/user/intra-role/route.ts          (T3.5 — étendu)
src/app/api/admin/formateurs/                 (T2 — 7 routes)

src/app/(app)/profil/edit/page.tsx            (T7 — toggles préférences)
src/app/formateur/
  dashboard/page.tsx                           (T3)
  agenda/page.tsx                              (T4)
  sessions/page.tsx                            (T5)
  profil/page.tsx                              (T6)

src/app/sessions/[id]/page.tsx                (T5)
src/app/formateurs/[slug]/page.tsx            (T6 + T7)
src/app/admin/formateurs/                     (T2 — pages admin)
src/app/admin/formations/[id]/instructors/    (T2)

src/components/formateur/
  KPICard.tsx                                  (T3)
  FormationStatsCard.tsx                       (T3)
  AgendaClient.tsx                             (T4)
  SessionsClient.tsx                           (T5)
  ProfilClient.tsx                             (T6)
  FollowButton.tsx                             (T7)
  ComingSoonStub.tsx                           (T2)

src/components/
  UpcomingEvents.tsx                           (T4)
  UpcomingSessions.tsx                         (T6)
  AddToCalendarButton.tsx                      (T5)

tests/e2e/sprint2/
  scenario_1_assign_formateur.spec.ts          (T8)
  scenario_2_live_event_presentiel.spec.ts     (T8)
  scenario_3_live_session_inscription.spec.ts  (T8)
  scenario_4_profil_public_formateur.spec.ts   (T8)
  scenario_5_capacity_respected.spec.ts        (T8)
  scenario_6_isolation_formateur.spec.ts       (T8)
  scenario_7_push_reminder.spec.ts             (T8)

scripts/smoke_sprint2_prod.sh                  (T8)
docs/prototypes/DATABASE_SCHEMA.md            (T8 — section Sprint 2 ajoutée)
MATRICE_ROLES_DENTALLEARN_V1.md               (T8 — V1.2 → V1.3, §3.6 statuts)
```

---

*Récap généré le 15 mai 2026 — Sprint 2 Espace Formateur — Tickets T1→T8*
*Rédigé par Claude Code (session claude.ai), validé par Dr Julie Fantin.*
