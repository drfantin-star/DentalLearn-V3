# RECAP SESSION — Sprint 2 Espace Formateur : T1, T2, T3, T3.5

**Date** : 11–13 mai 2026 (3 jours effectifs)
**Sprint** : Sprint 2 Espace Formateur V1
**Tickets livrés** : T1, T2, T3 + fix garde, T3.5 + 4 itérations correctives
**Tickets restants Sprint 2** : T4, T5, T6, T7, T8 (5/8)
**Repo** : `github.com/drfantin-star/DentalLearn-V3.git`
**Production** : `https://dental-learn-v3.vercel.app`
**Supabase** : projet `dxybsuhfkwuemapqrvgz`

---

## 1. Vue d'ensemble

Démarrage Sprint 2 le 11/05 après clôture Sprint 1 (auth + RBAC + multi-tenant). Objectif : livrer l'Espace Formateur V1 selon spec `handoff_claude_code_sprint2_espace_formateur_v1_0.md`. Sémantique clé du rôle formateur définie en cours de T2 : **animateur de masterclass live et événements présentiels, PAS créateur de contenu pédagogique**.

| Ticket | Statut | PR | Commits clés | Date merge |
|---|---|---|---|---|
| T1 — Migration BDD entités formateur | ✅ Mergé | #260 | `b2fdbe0` | 11/05 |
| T2 — Helpers RBAC + UI admin promotion/rattachement | ✅ Mergé | #261 (suspecté) | `243696d` | 12/05 |
| T3 — Dashboard stats formateur | ✅ Mergé | #264 | `d9ea28b` + `f775449` (fix garde) | 13/05 matin |
| T3.5 — Pont nav home → espaces dédiés (ticket non prévu au handoff initial) | ✅ Mergé | #266 | `243696d` + `69427f8` + `d349430` + `573456d` | 13/05 après-midi |

Progression : **3.5 / 8 tickets mergés en 3 jours**, sprint en avance sur le planning handoff initial (3-4 semaines).

---

## 2. T1 — Migration BDD entités formateur

### Livré
- Migration `20260511_sprint2_formateur_entities.sql` + `_down.sql` symétrique
- 5 tables créées : `formation_instructors`, `formateur_profiles`, `live_events`, `live_sessions`, `live_registrations`
- 3 helpers SQL en `STABLE SECURITY DEFINER`, `SET search_path = public, pg_temp` : `is_formateur_of`, `get_formateur_formations`, `formateur_aggregated_stats` (stub `{}::jsonb` en T1, body implémenté en T3)
- RLS activée sur les 5 tables, 20 policies différenciées
- 3 triggers `updated_at` (réutilisation `update_updated_at_column()` existante)
- Pattern ACL : `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` puis `GRANT EXECUTE TO authenticated, service_role`

### Décisions produit
- **S2.1** : masterclass live gratuite V1 (pas de `price_cents`)
- **S2.2** : Zoom manuel V1 (`zoom_url` + `zoom_password` direct en BDD)
- **S2.3** : compteur + prénoms uniquement (pas de liste nominative)
- Convention nommage : `20260511_sprint2_*` (PAS `0017_*` — convention Sprint 1 `YYYYMMDD_*` prime)
- Table N:N `formation_instructors` avec `is_primary boolean` (1 formation peut avoir plusieurs intervenants)

### Apprentissages techniques
- **Postgres refuse `now()` dans index partiel** (uniquement IMMUTABLE accepté) → index `live_events_published_upcoming_idx WHERE is_published = true` sans `starts_at > now()`. Dette D23 loggée.
- **Defaults Supabase grantent `anon` automatiquement** depuis fin 2025 — DOIT être explicite dans le REVOKE pour aligner Sprint 1.
- **Pas de seed data dans une migration** (anti-pattern) : Dr Fantin crée les assignations via UI après merge.

### Tests
- Migration testée up/down/up via MCP Supabase
- 7 critères d'acceptation BDD validés (constraints UNIQUE/CHECK, helper `is_formateur_of` sur 3 cas, RLS structurelle)

---

## 3. T2 — Helpers RBAC + UI admin promotion/rattachement

### Sémantique clé établie en début de ticket

Le rôle formateur sur DentalLearn N'EST PAS un rôle de créateur de contenu pédagogique. C'est un rôle d'animateur de masterclass live et événements présentiels. Concrètement :
- Le formateur N'ANIME PAS de contenu pédagogique (formations, séquences, quiz, podcasts restent sous contrôle super_admin/Dentalschool)
- Le formateur anime des masterclass live (`live_sessions`) et événements présentiels (`live_events`)
- Quand il crée une masterclass, il peut OPTIONNELLEMENT la rattacher à une formation Dentalschool existante (lien sémantique)
- Une masterclass peut aussi être autonome (sans formation rattachée)
- Le formateur a aussi un profil public (`/formateurs/[slug]`)

**2 actions admin distinctes et indépendantes** :
| Action | BDD | Effet |
|---|---|---|
| A. Promouvoir au rôle formateur | INSERT `user_roles(formateur)` | Donne accès à `/formateur/*` ; peut animer des masterclass autonomes |
| B. Rattacher à une formation | INSERT `formation_instructors(formation_id, user_id)` | Lien sémantique : nom sur fiche formation + stats agrégées par formation en T3 |

### Livré
- Extension `src/lib/auth/rbac.ts` : `isFormateur`, `getFormateurFormations`, `isFormateurOf`
- Guard Server Component `requireFormateurOrRedirect` + middleware `requireFormateur`
- Page `/admin/formateurs` (liste + recherche + bouton "Promouvoir un utilisateur")
- Page `/admin/formateurs/promote` (lookup email + promotion)
- Page `/admin/formateurs/[user_id]` (détail + rétrogradation)
- Page `/admin/formations/[id]/instructors` (rattachements par formation + toggle `is_primary`)
- 7 routes API admin (`force-dynamic` + check `isSuperAdmin`)
- Layout `/formateur/*` avec sidebar violette (#2D1B96) + 4 stubs "Bientôt disponible"
- Lien "Formateurs" dans sidebar admin + bouton "Intervenants" sur page détail formation
- Script standalone `scripts/test-rbac.ts` (3 helpers × cas passant/échouant)

### Décisions produit (T2.A → T2.E)
- **T2.A** : 2 pages admin séparées (gestion globale + rattachements par formation)
- **T2.B** : la promotion crée UNIQUEMENT `user_roles(formateur)`. Pas de création auto de `formateur_profiles` (créé à la volée en T6 via INSERT ON CONFLICT DO NOTHING) → **dette D2-T2-01**
- **T2.C** : super_admin accède directement à `/formateur/*` (pas de bandeau mode admin)
- **T2.D** : stubs "Bientôt disponible" + sidebar nav fonctionnelle
- **T2.E** : UI cherche uniquement users existants (pas d'invitation email V1)

### Bonus identifiés par Claude Code
- Anti auto-rétrogradation (super_admin ne peut pas se rétrograder par erreur)
- Idempotence INSERT user_roles via gestion erreur 23505
- Swap automatique `is_primary` (si on ajoute un nouvel intervenant principal, l'ancien passe à false dans la même transaction)

### Dettes loggées
- **D2-T2-01** : création de `formateur_profiles` à la volée en T6 (pas en T2)
- **D2-T2-02** : rétrogradation = DELETE `user_roles` UNIQUEMENT ; `formation_instructors`, `formateur_profiles`, `live_*` du user restent intacts. Permet re-promotion sans reconstruction MAIS le nom peut rester visible sur fiches formations → nettoyage manuel si besoin

---

## 4. T3 — Dashboard stats formateur

### Livré
- Migration `20260512_sprint2_t3_formateur_stats_impl.sql` + `_down.sql` (body du helper `formateur_aggregated_stats` réécrit, signature gelée)
- Helper TS `getFormateurStats(userId, dateFrom?, dateTo?)` + interfaces `FormateurStats`
- Page `/formateur/dashboard` (Server Component, remplace stub T2)
- 3 composants réutilisables : `KPICard`, `FormationStatsCard`, `EmptyStateNoFormations`
- 4 KPI globaux + détail par formation rattachée (cover, badge "Intervenant principal", 4 mini-KPIs)
- Mention RGPD en pied : "Données agrégées — aucun apprenant n'est identifié individuellement."

### Décisions produit (T3.A → T3.D)
- **T3.A** : KPIs globaux en haut + détail par formation en dessous
- **T3.B** : 30 derniers jours glissants (pas de sélecteur V1)
- **T3.C** : 4 KPIs minimaux (inscrits / complétion / écoutes / points)
- **T3.D** : empty state explicite si formateur sans formation rattachée

### Décisions techniques importantes
- **`course_watch_logs.started_at`** (NOT NULL) au lieu de `created_at` (nullable) pour filtrer "écoutes sur période" — déviation actée vs pseudocode brief. À propager partout dans le projet (note de convention DATABASE_SCHEMA.md).
- **`is_primary` ajouté dans le JSONB `per_formation`** (1 round-trip BDD au lieu de 2)
- **Server Component direct, pas d'API endpoint REST V1** (YAGNI, perf, surface attaque minimale)
- **Masquage RGPD** limité à `completion_rate` si N<5 (inscrits/écoutes/points absolus restent visibles)

### Fix critique post-merge initial : garde `auth.uid()`
**Faille business identifiée par moi avant merge** : la signature `formateur_aggregated_stats(p_user_id uuid, ...)` permettait à un formateur authentifié d'appeler la RPC avec le `p_user_id` d'un autre formateur et voir ses stats. Pas de données nominatives (modèle A RGPD respecté), mais fuite business.

**Fix appliqué** (commit `f775449`) : passage en `LANGUAGE plpgsql`, garde au début du body :
```sql
IF v_caller IS NOT NULL AND p_user_id <> v_caller AND NOT is_super_admin(v_caller) THEN
  RAISE EXCEPTION 'Forbidden: cannot query stats for another user' USING ERRCODE = '42501';
END IF;
```
3 cas testés en prod via MCP : A (formateur autre user → 42501), B (self → OK), C (super_admin → bypass OK).

### Dettes loggées
- Sélecteur période, graphique temporel, drill-down séquence, export CSV → V2/Sprint 3

---

## 5. T3.5 — Pont navigation home → espaces dédiés (ticket non prévu au handoff)

### Pourquoi ce ticket a été créé
Pendant le smoke test T3, observation Dr Fantin : les formateurs (et super_admin) n'avaient AUCUN lien UI pour accéder à leur espace dédié. Le pattern Sprint 1 T8 traitait les admins tenant (5ᵉ onglet BottomNav "Mon cabinet" + lien header + carte profil) mais Sprint 2 avait oublié de le reproduire pour le rôle formateur. Ticket de polish UX inséré dans le sprint, hors handoff initial.

### Livré (4 commits successifs après itérations correctives)

**Commit initial `243696d`** :
- Endpoint `/api/user/intra-role` étendu (ajout `is_super_admin` + `is_formateur`)
- Layout `(app)/layout.tsx` résout les 3 flags serveur en parallèle
- BottomNav : 5ᵉ onglet contextuel mutuellement exclusif par priorité (Admin > Formateur > Mon cabinet)
- `/profil` : header avec liens conditionnels + section "Mes espaces" avec cartes conditionnelles (accent ambre pour Admin, violet #2D1B96 pour Formateur, cumul supporté)

### Décisions produit
- **Stratégie BottomNav cumul rôles** : priorité mutuellement exclusive (max 5 onglets préservé)
- **Ordre header profil** : privilège décroissant (Admin → Formateur → Cabinet → Éditer)
- **Propagation flags** : étendre `/api/user/intra-role` existante (pas de nouvel endpoint)

### Itération corrective 1 — Bugs détectés au smoke
Au smoke test post-livraison initiale, 2 bugs détectés par Dr Fantin :

**Bug 1 — Persistance flag `is_formateur` après révocation**
Scénario : promotion jujufant → test OK → révocation via `/admin/formateurs` → reconnexion jujufant → la carte "Espace Formateur" et le lien header restaient visibles malgré la révocation. Middleware bloquait l'accès (403 au clic) mais l'UI affichait toujours les entrées.

**Cause racine identifiée par Claude Code** : les `Map` module-level dans `rbac.ts` (`roleCache`, `intraRoleCache`) persistent entre requêtes sur Vercel Lambda warm. Le commentaire du code prétendait l'inverse mais c'était faux.

**Bug 2 — Redondance UX header/body**
Lien header "Espace formateur" + carte "Espace Formateur" dans la section "Mes espaces" = doublon visuel.

**Fix commit `69427f8`** :
- Migration des helpers (`isSuperAdmin`, `hasRole`, `getUserIntraRole`, `isFormateurOf`) vers `cache()` de React (mémoization request-scoped native Next 14)
- Route `/api/user/intra-role` durcie : `revalidate = 0`, `fetchCache = 'force-no-store'`, headers `Cache-Control: no-store, no-cache, must-revalidate`
- Retrait des liens header "Administration" + "Espace formateur" (lien "Mon cabinet" T8 conservé)
- Dette D2-T3.5-01 créée pour Sprint 3 (refonte UX `/profil` unifiée)

### Itération corrective 2 — Bug `is_formateur: false` côté API

Smoke test après le fix précédent : `/api/user/intra-role` retourne `is_formateur: false` pour jujufant alors qu'elle a bien le rôle en BDD (vérifié via MCP).

**Diagnostic Claude Code (4 tests SQL distincts)** :
| Test | Résultat |
|---|---|
| SQL direct sous `service_role` : `has_role(jujufant, 'formateur')` | `true` ✅ |
| SQL direct sous `authenticated` : `has_role(jujufant, 'formateur')` | `true` ✅ |
| API Next via `supabase.rpc('has_role', { p_user_id, p_role: 'formateur' })` | `false` ❌ |
| Code TS `isFormateur` → `hasRole` → ordre des args | ✅ correct |

**Cause** : bug silencieux dans la chaîne `supabase-js v2 + @supabase/ssr 0.1.0 → PostgREST RPC` lors de sérialisation des enum (`app_role`). Le SQL fonctionne mais la couche client TS retourne `false`/`null` silencieusement.

**Fix commit `d349430`** :
- `hasRole` BYPASSE la RPC, lit `user_roles` directement via `.from().select().eq().maybeSingle()`
- RLS `user_roles_select_own` couvre tous les appelants (audit grep ~50 sites — tous passent `user.id` du caller authentifié)
- `isSuperAdmin` devient un délégué de `hasRole(_, 'super_admin')` pour homogénéiser
- `cache()` request-scoped préservé
- Dette D2-T3.5-02 loggée (audit autres RPC à enum à mener)

### Itération corrective 3 — Crash middleware Edge Runtime

Après le fix précédent : preview Vercel renvoie `500 MIDDLEWARE_INVOCATION_FAILED` sur TOUTES les routes.

**Diagnostic Claude Code (lecture logs Vercel via MCP)** :
```
TypeError: (0 , bt.cache) is not a function
```

**Cause** : `cache()` de React N'EST PAS supporté en Edge Runtime du middleware Next 14. Comme `middleware.ts` importe statiquement `rbac.ts`, l'évaluation top-level `export const isSuperAdmin = cache(async ...)` crashait au chargement du module en Edge → 500 sur toutes les routes (matcher catch-all).

**Fix commit `573456d`** :
- Retrait complet de `cache()` (incompatible Edge middleware Next 14)
- Retour aux `async function` standard sans mémoization request-scoped
- Coût négligeable (< 10ms grâce à index sur `user_id`)
- Bug 1 (persistance révocation) reste fixé (pas de Map réintroduite)
- Bug `is_formateur: false` reste fixé (lecture directe `user_roles` préservée)
- Dette D2-T3.5-03 loggée

### Smoke test final (5 vérifications passées)
1. ✅ Plus de 500 sur la preview
2. ✅ `is_formateur: true` pour jujufant après promotion
3. ✅ UI jujufant complète (carte "Espace Formateur" + onglet "Formateur" + `/formateur/dashboard` chargeant les 4 KPIs)
4. ✅ Régression super_admin OK (Dr Fantin voit "Admin" en BottomNav + carte + accès `/admin`)
5. ✅ Cycle révocation immédiate (révocation → la carte disparaît côté jujufant, 403 au clic dashboard)

### Dettes loggées
- **D2-T3.5-01** : refonte UX `/profil` unifiée (header vs section incohérents) → Sprint 3
- **D2-T3.5-02** : audit autres RPC à enum dans le projet (bug silencieux supabase-js + @supabase/ssr) → Sprint 3 ou T8
- **D2-T3.5-03** : pas de mémoization request-scoped (cache() incompatible Edge). Solution possible V2 : flags via headers depuis middleware vers Server Components

---

## 6. Apprentissages techniques majeurs Sprint 2 — Patterns à mémoriser

### 🚨 Anti-patterns à NE PAS reproduire

1. **`Map` module-level dans helpers serveur** : persiste entre requêtes sur Vercel Lambda warm. Source de cache stale invisible. Toujours utiliser `cache()` request-scoped Next 14 OU pas de cache.

2. **`cache()` de React dans le middleware** : incompatible Edge Runtime de Next 14. Si un helper utilise `cache()`, ne pas l'importer dans `middleware.ts`. Crashe au top-level avec `bt.cache is not a function`.

3. **RPC PostgREST avec enum en argument** : bug silencieux `supabase-js v2 + @supabase/ssr 0.1.0` qui retourne `false`/`null` même quand le SQL marche en direct. Workaround : lire la table directement via `.from().select().eq().maybeSingle()`, en s'appuyant sur la RLS.

4. **Index partiel avec `now()` dans le prédicat** : Postgres refuse les fonctions STABLE. Seules les IMMUTABLE acceptées.

### ✅ Patterns à reproduire systématiquement

1. **Audit BDD via MCP Supabase AVANT toute migration/helper SQL** : vérifier collisions, colonnes existantes, ACL helpers Sprint 1, structure réelle des tables.

2. **`apply_migration` MCP en cours de PR** : la migration est appliquée en prod AVANT le merge du code. Le code en main reste en cohérence avec la BDD prod.

3. **Test up/down/up systématique** : sur branche dev ou via INSERT/cleanup MCP. Tester aussi le DOWN, pas juste le UP.

4. **Tests RPC sous 3 rôles** : `service_role` + `authenticated` (RLS-aware) + API Next.js. Les 3 peuvent diverger silencieusement (cf. bug enum).

5. **Lecture logs Vercel via MCP en cas de crash production-like** : pas d'invention de fix. La cause racine est toujours dans les logs runtime.

6. **Helper SQL pattern Sprint 2** : `STABLE SECURITY DEFINER`, `SET search_path = public, pg_temp`, garde `auth.uid()` quand la signature accepte un `p_user_id`, ACL `REVOKE EXECUTE FROM PUBLIC, anon, authenticated` puis `GRANT EXECUTE TO authenticated, service_role`.

7. **Compte-rendu Claude Code en 3 parties** (état actuel / plan / questions bloquantes) AVANT toute écriture de code, sur tickets non-triviaux.

---

## 7. État BDD prod (au 13/05/2026 fin de journée)

**Tables Sprint 2 créées :**
- `formation_instructors` (UNIQUE formation_id+user_id)
- `formateur_profiles` (1:1 user, slug unique, is_published=false par défaut)
- `live_events` (CHECK ends_at > starts_at)
- `live_sessions` (status enum, zoom_url + zoom_password en clair pour V1)
- `live_registrations` (UNIQUE session_id+user_id)

**3 helpers SQL Sprint 2 :**
- `is_formateur_of(p_user_id uuid, p_formation_id uuid) RETURNS boolean`
- `get_formateur_formations(p_user_id uuid) RETURNS SETOF uuid`
- `formateur_aggregated_stats(p_user_id uuid, p_date_from date, p_date_to date) RETURNS jsonb` (body implémenté T3 + garde auth.uid())

**Code TS Sprint 2 dans `src/lib/auth/rbac.ts` :**
- `isFormateur(userId)` (délègue à `hasRole`, lecture directe user_roles)
- `getFormateurFormations(userId)` (RPC + JOIN formations + is_primary)
- `isFormateurOf(userId, formationId)` (RPC SECURITY DEFINER, non bypassée car pas d'enum en arg)
- `getFormateurStats(userId, dateFrom?, dateTo?)` (RPC, période défaut 30j glissants)
- `hasRole(userId, role)` BYPASSE LA RPC depuis T3.5, lit `user_roles` via RLS
- Aucun `cache()` (incompatible Edge middleware)

**Users prod au 13/05 fin de journée :**
| User | user_id | Rôles | Formations rattachées |
|---|---|---|---|
| `drfantin@gmail.com` (Julie) | `af506ec2-a281-4485-a504-b0633c8d2362` | `super_admin` | 0 |
| `jujufant@hotmail.com` (test user) | `2b4985d2-4967-4ab8-ba3e-163cde22d88d` | (vide après test rétrogradation) | 1 ligne orpheline (dette D2-T2-02) |

---

## 8. Dettes accumulées Sprint 2 (récap consolidé)

| ID | Description | Sévérité | À traiter |
|---|---|---|---|
| D2-T2-01 | `formateur_profiles` créé à la volée (INSERT ON CONFLICT DO NOTHING, slug auto prenom-nom) | Mineure | T6 |
| D2-T2-02 | Rétrogradation ne nettoie pas `formation_instructors` (orpheline) | Mineure | T6 ou Sprint 3 |
| D2-T3-01 (implicite) | Pas d'auto-cleanup écoutes orphelines (course_watch_logs JOIN sequences) | Acceptable | Si perf dégrade |
| D2-T3.5-01 | Refonte UX `/profil` unifiée (header vs section incohérents) | Mineure UX | Sprint 3 |
| **D2-T3.5-02** | **Audit autres RPC à enum dans le projet (bug silencieux supabase-js + @supabase/ssr)** | **Importante (sécurité fonctionnelle)** | **Sprint 3 ou T8** |
| D2-T3.5-03 | Pas de mémoization request-scoped (cache() incompatible Edge). Perf acceptable V1. Solution V2 = flags via headers. | Acceptable V1 | Si charge augmente |
| D-S1-?? (héritée) | Dashboard admin "Utilisateurs = 1" alors qu'il y a 2+ users en BDD | Mineure | Sprint 3 |
| D-S1-T5-01 (héritée) | Lookup user par email via `auth.admin.listUsers()` paginé (pas d'API getUserByEmail). Reproduit en Sprint 2 par cohérence. | Acceptable V1 | Quand perf dégrade |

---

## 9. Plan T4 — Agenda live_events (CRUD)

Référence : `handoff_claude_code_sprint2_espace_formateur_v1_0.md` §3 Ticket 4

### Objectif
Permettre au formateur de créer/lister/éditer/supprimer ses événements présentiels (`live_events`). Page `/formateur/agenda` remplace le stub T2.

### Composants attendus
- Page `/formateur/agenda` : timeline / cartes triées par date
- Modale ou page `/formateur/agenda/new` : formulaire création
- Modale ou page `/formateur/agenda/[id]/edit` : édition
- API REST : `GET/POST /api/formateur/agenda`, `PATCH/DELETE /api/formateur/agenda/[id]`
- RLS T1 déjà en place : créer pour soi-même, éditer/supprimer ses propres rows, super_admin bypass

### Points de vigilance T4
- Champ `formation_id` NULLABLE : événement peut être autonome (sans formation rattachée)
- Toggle `is_published` : seuls les events `is_published=true` apparaissent côté public (T6 ou plus tard)
- CHECK `ends_at IS NULL OR ends_at > starts_at` côté BDD → validation form côté front
- Pas d'inscriptions côté events V1 (champ `external_registration_url` text uniquement — le formateur met un lien Eventbrite/Helloasso)

### Décisions produit à trancher AVANT démarrage T4
1. Format de visualisation principal : liste / agenda calendaire / dual ?
2. Validation dates passées : autoriser création event passé (archive) ou bloquer ?
3. Niveau de détail form : MVP 6 champs vs complet 9 champs handoff ?

---

## 10. Convention discussion suivante

- **Audit BDD via MCP Supabase AVANT chaque ticket** (collisions, structure, ACL Sprint 1)
- **Compte-rendu Claude Code en 3 parties** (état actuel / plan / questions bloquantes) AVANT toute écriture de code
- **Questions stratégiques posées via `ask_user_input_v0`** pour les options multiples
- **Smoke test MCP post-merge** systématique (présence tables, ACL, policies, triggers)
- **Pas de merge tant que le smoke n'est pas vert** (Vercel preview + DevTools Network si bug API)
- **Logger les dettes explicitement** avec ID `D2-Tx-yy`
- **Nouvelle discussion Claude (pilotage) à ouvrir pour T4-T8** avec récap de bascule en premier message

---

## 11. Statistiques session

- **Durée totale** : 11–13 mai (3 jours effectifs)
- **Tickets mergés** : 4 (T1, T2, T3, T3.5) + 1 fix garde T3 + 3 itérations correctives T3.5
- **Migrations BDD appliquées en prod** : 2 (T1 + T3) — toutes testées up/down/up via MCP
- **PRs ouvertes** : #260, #261, #264, #266
- **Commits Sprint 2** : ~15 commits cumulés
- **Bugs critiques rencontrés et résolus** :
  - Map module-level → cache stale (PR #266)
  - Bug silencieux RPC enum supabase-js (PR #266)
  - `cache()` incompatible Edge middleware (PR #266)
  - Faille business `formateur_aggregated_stats` sans garde `auth.uid()` (PR #264)
  - Postgres refuse `now()` dans index partiel (PR #260)
- **Dettes nouvelles loggées** : 6 (D2-T2-01, D2-T2-02, D2-T3.5-01, D2-T3.5-02, D2-T3.5-03 + 1 implicite course_watch_logs)
- **Avancement sprint** : **3.5 / 8 tickets** (44%) en 3 jours, sprint en avance sur planning 3-4 semaines

---

**Statut à clôture de session 13/05** : Sprint 2 en bonne santé, fondations solides (BDD + RBAC + dashboard + navigation), prêt pour T4-T8 dans une nouvelle discussion Claude avec récap de bascule comme premier message.
