# Handoff Claude Code — Sprint 1 Auth + RBAC + Multi-tenant
## Plan de travail actionnable pour les fondations multi-tenant DentalLearn

**Document compagnon de** : `MATRICE_ROLES_DENTALLEARN_V1.md` (V1.1)
**Version handoff** : 1.0
**Date** : 2 mai 2026
**Destinataire** : Claude Code
**Sprint cible** : Sprint 1 (estimé 3-4 semaines)
**Dépendances amont** : matrice rôles V1.1 validée par Dr Fantin

**Journal des versions**
- v1.0 (02/05/2026) — Première version. Découpage 8 tickets atomiques (T1→T8). Décisions Q1-Q9 de la matrice intégrées. Modèle RGPD A retenu (Dentalschool seul responsable, analytics agrégées).

---

## 0. Comment utiliser ce document

1. Dr Fantin valide le périmètre des 8 tickets ci-dessous avant de lancer Claude Code.
2. Pour chaque ticket : ouvrir un nouveau chat Claude Code, coller le **prompt de démarrage** (§1) puis le **bloc ticket** correspondant (§3.X). Un ticket = une discussion = une PR = un merge sur `main`.
3. Claude Code commence systématiquement par **un audit Supabase + un audit code** (lire les fichiers réels avec sed/grep) avant d'écrire la moindre migration ou ligne de code. Aucun raccourci, aucune supposition.
4. Les contraintes non-négociables (§4) doivent être rappelées à Claude Code si jamais il s'en écarte.
5. La dette technique connue (§5) ne doit pas être touchée dans ce sprint sauf mention explicite dans un ticket.

**Pourquoi 8 tickets** : chaque ticket est conçu pour être livrable en 1 à 3 jours de Claude Code, mergeable indépendamment, et testable de bout en bout sans dépendre des suivants. T1 conditionne tous les autres ; T2 à T8 peuvent partiellement se paralléliser une fois T1 mergé.

---

## 1. Prompt de démarrage (à coller dans Claude Code en début de chaque ticket)

```
Tu travailles sur le projet DentalLearn, application de révision post-formation
pour chirurgiens-dentistes éditée par EROJU SAS (marque Dentalschool Formations).
Stack : Next.js 14 / TypeScript / Supabase / Vercel.
Repo : github.com/drfantin-star/DentalLearn-V3.git
Production : https://dental-learn-v3.vercel.app
Supabase : projet dxybsuhfkwuemapqrvgz

Ta mission : implémenter le Ticket [N] du Sprint 1 (Auth + RBAC + Multi-tenant)
décrit dans `handoff_claude_code_sprint1_auth_rbac_v1_0.md` à la racine du repo.

Documents de référence à lire AVANT d'écrire la moindre ligne :
1. `MATRICE_ROLES_DENTALLEARN_V1.md` — référentiel d'autorisation V1.1
2. `DATABASE_SCHEMA.md` — schéma Supabase complet (45 tables au 01/05/2026)
3. `handoff_claude_code_sprint1_auth_rbac_v1_0.md` — ce document
4. Le bloc "Ticket [N]" en §3.[N] du présent handoff

Avant d'écrire la moindre ligne de code :
1. Inspecte le schéma Supabase actuel via le MCP Supabase (list_tables, list_extensions,
   list_migrations) pour vérifier l'état exact en BDD.
2. Si le ticket touche des fichiers existants : utilise sed/grep pour lire le contenu
   exact des fichiers concernés. Ne te base JAMAIS sur ton interprétation, lis le code.
3. Identifie ce qui existe déjà vs ce qui doit être créé.
4. Si une instruction du ticket est ambiguë : pose la question à Dr Fantin AVANT de
   coder. Ne complète pas avec des suppositions.
5. Produis un compte-rendu en 3 parties :
   a) État actuel pertinent (BDD + code lu)
   b) Plan d'attaque détaillé (fichiers à créer/modifier, ordre)
   c) Questions bloquantes éventuelles
6. ATTENDS la validation de Dr Fantin avant de commencer.

Respecte impérativement les contraintes listées dans §4 du handoff :
- Modifications additives uniquement (jamais full rewrite)
- Migrations versionnées avec _down.sql symétrique
- Pas de localStorage / sessionStorage (React state uniquement)
- Ne JAMAIS supprimer course_watch_logs (obligation DPC)
- access_type !== 'full' = mode preview, indépendant du rôle admin
- Format runtime questions.options = array plat [{id,text,correct}]
- Email admin hardcodé drfantin@gmail.com à supprimer (ticket T2 dédié, ne pas
  modifier ailleurs)
```

---

## 2. Secrets et environnement

Aucun nouveau secret requis pour ce sprint — tout repose sur Supabase Auth déjà configuré.

Vérifier la présence des variables d'env existantes dans Vercel :

```bash
NEXT_PUBLIC_SUPABASE_URL=https://dxybsuhfkwuemapqrvgz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

Si T4 active l'envoi d'emails de vérification via un ESP custom (ex Brevo) au lieu des emails Supabase par défaut, ajouter alors :

```bash
BREVO_API_KEY=xkeysib-...      # uniquement si T4 décide de basculer vers Brevo
EMAIL_FROM_ADDRESS=noreply@dentalschool.fr
EMAIL_FROM_NAME=DentalLearn
```

À arbitrer dans le ticket T4 selon l'avancement de la délivrabilité Supabase native.

---

## 3. Tickets Sprint 1 (dans cet ordre)

### Ticket 1 — Migration BDD fondations RBAC + Multi-tenant

**Objectif** : créer la fondation BDD du système multi-tenant (enums, tables, helpers SQL, seed super_admin Dr Fantin). Aucune modification du code applicatif.

**Tâches**

- Migration Supabase `0013_sprint1_rbac_multitenant.sql` :
  - Création des 5 enums : `app_role`, `org_type`, `intra_role`, `org_plan`, `membership_status`
  - Création des 3 tables : `user_roles`, `organizations`, `organization_members`
  - Toutes contraintes CHECK et FK conformes à §8 de `MATRICE_ROLES_DENTALLEARN_V1.md`
  - Index : `user_roles_user_id_idx`, `organization_members_org_id_idx`, `organization_members_user_id_unique` (déjà via UNIQUE)
- Helpers SQL versionnés dans la même migration :
  - `has_role(p_user_id uuid, p_role app_role) RETURNS boolean`
  - `is_super_admin(p_user_id uuid) RETURNS boolean`
  - `user_org(p_user_id uuid) RETURNS uuid`
  - `org_can_create_content(p_org_id uuid) RETURNS boolean`
- Trigger PL/pgSQL `validate_intra_role_matches_org_type` sur `organization_members` (BEFORE INSERT/UPDATE) qui rejette les combinaisons invalides (ex : `assistante` dans un `training_org`)
- RLS sur les 3 nouvelles tables :
  - `user_roles` : SELECT autorisé sur ses propres rôles + super_admin voit tout. INSERT/UPDATE/DELETE super_admin uniquement.
  - `organizations` : SELECT autorisé pour les membres de l'org + super_admin. UPDATE limité à `titulaire`/`admin_rh`/`admin_of` selon le type. INSERT/DELETE super_admin uniquement.
  - `organization_members` : SELECT pour membres de la même org + super_admin. INSERT/UPDATE par admin de l'org. DELETE = soft (passage status=`revoked`).
- Seed initial dans la même migration :
  - `INSERT INTO user_roles (user_id, role) VALUES ('af506ec2-a281-4485-a504-b0633c8d2362', 'super_admin');`
  - Ne PAS créer d'organisation Dentalschool — les users orgless restent orgless en V1 (décision Q2)
- Migration de rollback symétrique : `0013_sprint1_rbac_multitenant_down.sql`

**Critères d'acceptation**
- [ ] `supabase db push` passe sans erreur en local et en prod (via MCP)
- [ ] `list_tables` retourne `user_roles`, `organizations`, `organization_members`
- [ ] `SELECT is_super_admin('af506ec2-a281-4485-a504-b0633c8d2362')` retourne `true`
- [ ] `SELECT is_super_admin('00000000-0000-0000-0000-000000000000')` retourne `false`
- [ ] Tentative d'INSERT `organization_members (intra_role='assistante')` dans une org `type='training_org'` → erreur trigger
- [ ] Tentative d'INSERT 2 membres avec le même `user_id` → erreur UNIQUE constraint
- [ ] Migration `_down.sql` fournie et testée (drop tables + enums dans le bon ordre)
- [ ] `DATABASE_SCHEMA.md` mis à jour avec les 3 nouvelles tables (section dédiée "Multi-tenant — Sprint 1")

**Pas dans ce ticket** : aucune modification du code TypeScript/React. Aucune modification des autres tables. Aucune RLS sur les tables existantes (formations, sequences, etc.) — c'est T3.

---

### Ticket 2 — Suppression hardcoding admin email + helpers RBAC côté code

**Objectif** : remplacer toutes les occurrences hardcodées de `drfantin@gmail.com` par un check dynamique `isSuperAdmin(user)` côté code applicatif. Créer les helpers TypeScript de RBAC réutilisables.

**Tâches**

**Audit préalable obligatoire** :
- `grep -rn "drfantin@gmail" src/` pour identifier toutes les occurrences (estimé ~11 fichiers selon dette D4)
- `grep -rn "DRFANTIN" src/` (variantes en SCREAMING_CASE éventuelles)
- Produire la liste exhaustive avant toute modification, la valider avec Dr Fantin

**Création helpers TypeScript** (`src/lib/auth/rbac.ts`) :
- `isSuperAdmin(userId: string): Promise<boolean>` — appel `is_super_admin()` SQL
- `hasRole(userId: string, role: AppRole): Promise<boolean>` — appel `has_role()` SQL
- `getUserOrg(userId: string): Promise<{id: string, type: OrgType, plan: OrgPlan} | null>` — appel `user_org()` enrichi
- `getUserIntraRole(userId: string): Promise<IntraRole | null>` — lecture `organization_members`
- Type `AppRole = 'super_admin' | 'formateur' | 'cs_member' | 'marketing' | 'support' | 'user'`
- Type `OrgType = 'cabinet' | 'hr_entity' | 'training_org'`
- Type `IntraRole` (union des 9 valeurs)
- Cache en mémoire pour la durée d'une requête (éviter N appels SQL pour la même résolution)

**Middleware Next.js** (`src/middleware.ts` — créer ou étendre) :
- Helper `requireRole(role: AppRole)` qui redirige vers `/login` ou `/403` si non autorisé
- Helper `requireSuperAdmin()` (raccourci)
- Helper `requireIntraRole(intra_roles: IntraRole[])` pour les pages tenant admin

**Remplacement systématique** :
- Pour chaque fichier listé dans l'audit : remplacer la condition hardcodée par `if (await isSuperAdmin(session.user.id))`
- Cas particuliers à signaler à Dr Fantin AVANT modification :
  - Si la condition portait sur l'email pour autre chose que de l'admin (ex : lien `mailto:` dans une page contact) → ne PAS toucher
  - Si un fichier mélange admin check + autre logique → demander avant refactor

**À NE PAS supprimer dans ce ticket** :
- Table legacy `profiles` avec son champ `role` (user/admin) — laisser intact, on ne refactore pas en cascade. Si du code en dépend encore après ce ticket, il sera traité au cas par cas dans T3 ou un ticket dédié ultérieur.
- Variable d'env `ADMIN_NOTIFICATION_EMAIL=drfantin@gmail.com` (utilisée par les notifications, pas pour de l'auth)

**Critères d'acceptation**
- [ ] `grep -rn "drfantin@gmail" src/` retourne 0 résultat (hors `ADMIN_NOTIFICATION_EMAIL` documenté)
- [ ] Dr Fantin se connecte sur prod et accède toujours à `/admin/news`, `/admin/news/sources`, `/admin/news/pending`, etc. sans régression
- [ ] Un user non-admin (créer un compte test) ne peut pas accéder aux routes admin (redirection `/403`)
- [ ] Helpers `isSuperAdmin`, `hasRole`, `getUserOrg`, `getUserIntraRole` couverts par tests unitaires (au moins 1 cas passant + 1 cas échouant chacun)
- [ ] Middleware ne casse aucune route existante (smoke test home + sequence + quiz du jour + admin)

**Dépendance** : T1 mergé (helpers SQL nécessaires).

---

### Ticket 3 — Modification table formations + isolation contenu tenant + RLS multi-tenant

**Objectif** : ajouter le mécanisme d'isolation strict du contenu tenant en BDD via la colonne `formations.owner_org_id` et propager via RLS sur les 7 tables impactées.

**Tâches**

**Migration `0014_sprint1_formations_owner_org.sql`** :
- `ALTER TABLE formations ADD COLUMN owner_org_id uuid NULL REFERENCES organizations(id) ON DELETE RESTRICT;`
- `CREATE INDEX formations_owner_org_id_idx ON formations(owner_org_id);`
- Toutes les formations existantes (les 6 du catalogue Dentalschool) restent avec `owner_org_id = NULL` — aucun update massif requis
- Helper SQL `user_can_see_formation(p_user_id uuid, p_formation_id uuid)` conformément à §8.4 de la matrice

**Mise à jour RLS sur les 7 tables impactées** :
- `formations` : SELECT policy → `is_super_admin(auth.uid()) OR (owner_org_id IS NULL AND is_published) OR owner_org_id = user_org(auth.uid())`
- `sequences` : idem via JOIN sur `formations`
- `questions` : idem via JOIN sur `sequences` (cas formation) ou via `news_synthesis_id` (cas news, toujours publique)
- `user_formations`, `user_sequences`, `course_watch_logs` : SELECT autorisé sur ses propres lignes + super_admin
- `epp_audits` : SELECT via `formations.owner_org_id` lié

**Tests d'isolation** :
- Créer en console SQL une org test `'training_org'` + 1 formation owned par cette org + 1 user membre
- Vérifier que ce user voit son contenu owned ET le catalogue Dentalschool (pas de double isolation accidentelle)
- Vérifier qu'un user orgless (Dr Fantin) NE voit PAS la formation owned du training_org test
- Vérifier qu'un membre d'une autre org NE voit PAS cette formation owned

**Cas particulier `news_synthesis_id`** :
- Les questions news (`questions.sequence_id IS NULL AND news_synthesis_id IS NOT NULL`) restent visibles à tous (catalogue news public Dentalschool). La RLS doit traiter ce cas explicitement (`news_synthesis_id IS NOT NULL OR <règle formations>`).

**Migration de rollback** : `0014_sprint1_formations_owner_org_down.sql` — drop colonne + drop helper + restore RLS antérieures (snapshot des policies actuelles à conserver dans le `_down.sql`).

**Critères d'acceptation**
- [ ] Migration applicable et reversible sans perte de données
- [ ] Les 6 formations Dentalschool ont `owner_org_id = NULL`
- [ ] Test d'isolation manuel sur Supabase Studio : un user d'org A ne voit pas le contenu d'org B
- [ ] Aucune régression côté front : Dr Fantin et les 3 testeurs voient toujours leurs formations
- [ ] Quiz quotidien fonctionne toujours (questions news + questions formations Dentalschool)
- [ ] `course_watch_logs` toujours écrits sur consommation audio (logs DPC critiques — vérifier 1 entrée test)
- [ ] `DATABASE_SCHEMA.md` mis à jour : nouvelle colonne `formations.owner_org_id` + section RLS multi-tenant

**Dépendance** : T1 mergé.

---

### Ticket 4 — Pages auth user (signup / login / reset / vérif email)

**Objectif** : finaliser le flux d'authentification utilisateur complet, propre et conforme RGPD. Évaluer si on bascule sur Brevo pour la délivrabilité des emails ou si Supabase Auth natif suffit.

**Tâches**

**Audit préalable** :
- Lister les pages auth existantes sous `src/app/(auth)/` ou équivalent
- Tester le flux actuel signup → email vérif → login → reset password en environnement de staging
- Mesurer le taux de délivrabilité actuel des emails Supabase (nombre arrivant en spam)

**Pages à créer ou compléter** :
- `/signup` : formulaire (email, mot de passe, nom, prénom, RPPS optionnel, profession, **case à cocher consentement RGPD obligatoire** avec lien vers la politique de confidentialité)
- `/login` : email + mot de passe + lien "mot de passe oublié" + lien signup
- `/reset-password` : champ email → envoie le lien Supabase
- `/reset-password/confirm` : nouveau mot de passe (page atterrissage du lien email)
- `/verify-email` : page d'attente avec rappel et bouton "renvoyer l'email"
- `/verify-email/confirm` : page de confirmation après clic du lien
- `/login/error?reason=...` : messages d'erreur lisibles (compte non vérifié, mot de passe incorrect, etc.)

**Templates d'emails** (à customiser dans Supabase Dashboard → Authentication → Email Templates ou via Brevo si bascule) :
- Email vérification compte
- Email reset mot de passe
- Email magic link (si activé — non requis V1)
- Tous au nom de **DentalLearn** avec logo Dentalschool

**Décision Brevo vs Supabase natif** :
- Si délivrabilité Supabase < 90% (mesurée sur un échantillon test) → bascule Brevo recommandée
- Si OK → on garde Supabase natif, gain de simplicité
- Décision à proposer à Dr Fantin AVANT de coder l'intégration Brevo

**Hook trigger `handle_new_user`** :
- Vérifier qu'à chaque INSERT dans `auth.users`, une ligne est créée dans `user_profiles` (id, first_name, last_name, profession=`'Chirurgien-dentiste'` par défaut)
- Vérifier qu'une ligne est créée dans `user_roles` (user_id, role=`'user'`)
- Vérifier qu'une ligne est créée dans `streaks`, `user_notification_preferences` (defaults)
- Si trigger absent → le créer dans une migration `0015_handle_new_user_trigger.sql`

**Conformité RGPD** :
- Politique de confidentialité publique (utiliser le fichier `politique-confidentialite.md` existant comme source — vérifier qu'il est à jour)
- CGU publiques (`cgu.md` existant)
- Consentement obligatoire à l'inscription, log de la version acceptée dans `user_profiles.consent_version` et `user_profiles.consent_accepted_at` (à ajouter via migration si absent)
- Lien "Demander suppression de mon compte" dans le profil → set `user_profiles.deletion_requested_at = now()` (workflow de traitement manuel V1, automatisé V2)

**Critères d'acceptation**
- [ ] Flow complet inscription → vérif email → login → reset testé manuellement bout en bout
- [ ] Email de vérification reçu en boîte principale (pas en spam) sur 3 fournisseurs testés (Gmail, Outlook, Free.fr)
- [ ] Cas d'erreur explicites (email déjà utilisé, mot de passe trop faible, lien expiré)
- [ ] Trigger `handle_new_user` crée bien profile + role + streak + préférences
- [ ] Consentement RGPD bloque l'inscription si non coché
- [ ] Page profil affiche le bouton "Demander suppression de mon compte"
- [ ] Décision Brevo vs Supabase actée et documentée dans le PR

**Dépendance** : T1 mergé (table `user_roles` requise pour le trigger).

---

### Ticket 5 — Page back-office /admin/organizations (super_admin)

**Objectif** : permettre à Dr Fantin de créer et gérer les organisations clientes (cabinets, HR, OF) depuis l'admin. Onboarding manuel d'un premier client test inclus dans la livraison.

**Tâches**

**Pages à créer** (réutiliser le layout admin existant — pattern `/admin/news/*`) :
- `/admin/organizations` — liste paginée + filtres (type, plan, statut)
  - Colonnes : nom, type (badge couleur), plan, nb membres, créée le, actions
  - Bouton "Nouvelle organisation"
- `/admin/organizations/new` — formulaire création (name, type, plan, owner_user_id via search)
- `/admin/organizations/[id]` — détail org
  - Onglet "Infos" : édition name/plan/branding
  - Onglet "Membres" : liste + invitation + révocation + changement intra_role
  - Onglet "Contenu" : (V2 — placeholder pour l'instant)
- `/admin/organizations/[id]/invite` — envoi invitation par email (lien magique avec org_id pré-rempli)

**Routes API** :
- `POST /api/admin/organizations` — création (validation Zod : name, type, plan, owner_user_id)
- `PATCH /api/admin/organizations/[id]` — édition champs autorisés
- `POST /api/admin/organizations/[id]/members` — ajout membre par email + intra_role + manager_id optionnel
- `PATCH /api/admin/organizations/[id]/members/[member_id]` — changement intra_role ou status
- `DELETE /api/admin/organizations/[id]` — soft delete (status=`archived` à ajouter dans T1 si pas prévu)

**Validations métier côté API** :
- `intra_role` doit être compatible avec `org.type` (cf. trigger BDD)
- Un seul `titulaire` par cabinet, un seul `admin_rh` minimum par hr_entity, un seul `admin_of` minimum par training_org (warning si on tente d'en supprimer le dernier)
- Email d'invitation doit être unique en BDD (ou lié à un user existant)

**Onboarding test** :
- Après merge, Dr Fantin crée une org test type `cabinet` "Cabinet Test" avec elle-même comme `titulaire` (en parallèle de son rôle super_admin global)
- Vérifier que tout le flow fonctionne en conditions réelles

**Critères d'acceptation**
- [ ] Toutes les pages accessibles uniquement à `super_admin` (404 ou 403 sinon)
- [ ] Création d'une org test bout en bout en moins de 2 minutes via l'UI
- [ ] Invitation par email reçue + lien fonctionnel
- [ ] Membre invité peut accepter et apparaît dans la liste avec status `active`
- [ ] Tentative de créer un 2e `titulaire` dans le même cabinet → erreur claire côté UI
- [ ] Soft delete d'une org : la visibilité côté membres bascule mais l'historique est préservé
- [ ] Tests Playwright basiques (création org + ajout membre)

**Dépendance** : T1 et T2 mergés.

---

### Ticket 6 — Espace admin tenant /tenant/admin (titulaire / admin_rh / admin_of)

**Objectif** : livrer l'espace d'administration pour les admins de chaque organisation cliente. Layout dédié avec branding co-brand pour HR/OF (logo + couleur). Périmètre V1 = membres + branding (HR/OF) + curation catalogue (HR/OF) + analytics agrégées. **PAS de création de contenu (D.07) — reportée à un sprint dédié quand on aura un client premium signé.**

**Tâches**

**Layout dédié** (`src/app/tenant/layout.tsx`) :
- Détection automatique du tenant via `getUserOrg(session.user.id)`
- Si user orgless → redirection `/`
- Header custom : si HR/OF avec branding défini → afficher le logo de l'org + accent couleur primaire ; sinon header DentalLearn standard
- Mention discrète "powered by DentalLearn" en footer (non amovible V1)

**Pages tenant admin** (routes gatées par `requireIntraRole(['titulaire', 'admin_rh', 'admin_of'])`) :
- `/tenant/admin` — dashboard analytics agrégées
  - Cartes : nb membres actifs, taux complétion moyen, points distribués, durée moyenne de session
  - Graph : engagement hebdomadaire 30 derniers jours
  - **Strictement agrégées** — aucune donnée nominative individuelle (modèle RGPD A retenu §7.2)
- `/tenant/admin/members` — liste + invitation + révocation + changement rôle (cf T5 mais scopé à l'org du user connecté)
- `/tenant/admin/branding` — édition logo + couleur primaire
  - **Disponible uniquement pour HR/OF** (pas cabinet — décision A de Dr Fantin)
  - Upload logo via Supabase Storage bucket `tenant-branding`
  - Validation hex couleur format `#RRGGBB`
- `/tenant/admin/curation` — épingler 3-N formations Dentalschool à mettre en avant pour les membres
  - **Disponible uniquement pour HR/OF**
  - Drag-and-drop pour ordre d'affichage
  - Custom label optionnel (ex : "Formations prioritaires VYV S1 2026")

**Routes API** :
- `GET /api/tenant/analytics` — analytics agrégées (helper SQL dédié garantissant l'agrégation, jamais de SELECT nominatif)
- `POST /api/tenant/members` / `PATCH` / `DELETE` — scope obligatoire = org du user connecté
- `PATCH /api/tenant/branding` — HR/OF uniquement
- `POST /api/tenant/curation` / `DELETE` — HR/OF uniquement

**Helper SQL critique** :
- `tenant_aggregated_metrics(p_org_id uuid, p_date_from date, p_date_to date) RETURNS jsonb`
- Retourne uniquement des moyennes/comptages globaux : `{members_active, completion_rate_avg, points_distributed, sessions_count, ...}`
- Aucun retour individuel possible — c'est la garantie technique du modèle RGPD A

**Affichage branding côté users du tenant** :
- Dans le layout user connecté à un tenant HR/OF avec branding défini : logo en header + couleur accent appliquée aux boutons primaires
- Cabinet n'a pas de branding (cf décision A) — layout DentalLearn standard

**Critères d'acceptation**
- [ ] Un `titulaire` accède à `/tenant/admin` mais voit Branding et Curation grisés (cabinet)
- [ ] Un `admin_rh` accède aux 4 pages avec toutes les fonctionnalités
- [ ] Un `praticien_salarie` ou `apprenant_of` est redirigé (403)
- [ ] Aucune route API `/api/tenant/*` ne retourne de donnée nominative — testé avec lecture du code + 1 test d'intégration
- [ ] Branding visible côté user après upload (cache busting si modif logo)
- [ ] Curation : un membre du tenant voit les formations épinglées en haut de son catalogue
- [ ] Tests Playwright basiques (login admin tenant + édition branding)

**Dépendance** : T1, T2, T3 mergés. T5 recommandé pour partager les composants membres.

---

### Ticket 7 — Migration user_attestations (organisme dynamique par tenant)

**Objectif** : adapter la table `user_attestations` pour que l'organisme délivrant l'attestation soit calculé selon l'org du user, pas figé à `'EROJU SAS — Dentalschool'`. Indispensable pour les attestations délivrées aux apprenants d'OF tiers (rappel : V1 isolation stricte, le contenu Dentalschool reste toujours certifié EROJU).

**Tâches**

**Audit préalable** :
- Lire le code de génération d'attestation actuel (probablement dans `src/lib/attestations/` ou `src/app/api/attestations/`)
- Identifier où la chaîne `'EROJU SAS — Dentalschool'` est construite

**Migration `0016_attestations_organisme_dynamic.sql`** :
- La colonne `organisme` dans `user_attestation_verifications` reste avec son default `'EROJU SAS — Dentalschool'` (compatibilité descendante)
- Mais la valeur insérée à la création doit être calculée par un helper :
  - Si user orgless OU org type=`cabinet` OU org type=`hr_entity` → `'EROJU SAS — Dentalschool'`
  - Si user dans org type=`training_org` ET formation owned par cette org → nom de l'org
  - Si user dans org type=`training_org` ET formation Dentalschool (curation) → `'EROJU SAS — Dentalschool'` (rare cas frontière mais possible)
- Helper SQL `attestation_organisme_for(p_user_id uuid, p_formation_id uuid) RETURNS varchar`

**Adaptation du code de génération** :
- Avant chaque INSERT dans `user_attestations` ou `user_attestation_verifications`, appeler `attestation_organisme_for()` et utiliser le résultat
- Le bloc PDF d'attestation doit dynamiquement afficher cet organisme (logo + dénomination)
- Si organisme = OF tiers : ne PAS afficher la mention `Qualiopi QUA006589` ni `ODPC 9AGA` (ce sont les certifs Dentalschool, pas de l'OF tiers). À la place, champ vide ou mention de l'OF tiers si fournie via `organizations.qualiopi_number` (à ajouter en colonne dans cette migration).

**Migration additive sur `organizations`** :
- `ALTER TABLE organizations ADD COLUMN qualiopi_number varchar(20) NULL;`
- `ALTER TABLE organizations ADD COLUMN odpc_number varchar(10) NULL;`
- Renseignés par admin_of dans `/tenant/admin/branding` (étendre la page de T6 si pas trop tard, sinon nouveau ticket V1.5)

**Critères d'acceptation**
- [ ] Génération attestation pour Dr Fantin (orgless, formation Dentalschool) → organisme = `'EROJU SAS — Dentalschool'` + Qualiopi + ODPC affichés
- [ ] Création test : org training_org "OF Test" + apprenant + formation owned + attestation → organisme = "OF Test" + champ Qualiopi vide
- [ ] Création test : praticien VYV (HR) + formation Dentalschool → organisme = `'EROJU SAS — Dentalschool'`
- [ ] La table `user_attestation_verifications` (publique, code de vérification) reflète les bonnes valeurs
- [ ] Les attestations générées AVANT cette migration restent inchangées (rétrocompatibilité)
- [ ] `DATABASE_SCHEMA.md` mis à jour

**Dépendance** : T1, T3 mergés. T6 recommandé.

---

### Ticket 8 — Tests E2E + documentation finale + smoke test prod

**Objectif** : validation bout-en-bout du Sprint 1 par une suite de tests Playwright E2E, mise à jour exhaustive de la documentation et smoke test après déploiement prod.

**Tâches**

**Suite Playwright E2E** (`tests/e2e/sprint1/`) :
- Scénario 1 : signup user solo → vérif email → login → suivre 1 formation → quiz → générer attestation
- Scénario 2 : super_admin crée une org cabinet + invite un titulaire → titulaire reçoit l'email, accepte, accède au dashboard tenant
- Scénario 3 : super_admin crée une org HR + admin_rh accepte → admin_rh modifie branding + cure 2 formations → un praticien_salarie invité voit les formations épinglées + le branding
- Scénario 4 : super_admin crée une org training_org + admin_of crée une formation owned (mock — la création de contenu n'étant pas dans Sprint 1, simuler par INSERT direct en BDD) → un apprenant_of voit cette formation + ne voit PAS le catalogue Dentalschool
- Scénario 5 : isolation — un user d'org A ne voit PAS le contenu d'org B (test inter-tenant)

**Documentation à mettre à jour** :
- `DATABASE_SCHEMA.md` : intégrer toutes les modifications T1-T7 (3 nouvelles tables + colonnes ajoutées + helpers SQL + RLS)
- `RECAP_SPRINT1_AUTH_RBAC_<date>.md` : nouveau fichier dans le dossier projet, format aligné sur les `RECAP_TICKET*` existants. Contient : tickets livrés, décisions arbitrées, dette technique restante, prochaines étapes.
- `MATRICE_ROLES_DENTALLEARN_V1.md` : passage en V1.2 avec mention "implémenté Sprint 1" sur les rôles V1 livrés

**Smoke test prod après déploiement** :
- Connexion Dr Fantin OK (super_admin actif)
- Accès `/admin/news` OK (pas de régression)
- Accès `/admin/organizations` OK (nouvelle page)
- Quiz quotidien fonctionne (pas de régression RLS)
- Génération attestation Dr Fantin OK
- Audio podcast lecture OK (course_watch_logs écrits — vérifier 1 entrée en BDD)

**Mise à jour mémoire projet** :
- Mettre à jour `memory.md` du projet cache si pertinent (ex : ajouter "Sprint 1 livré le X mai 2026, multi-tenant fondations en prod")

**Critères d'acceptation**
- [ ] Les 5 scénarios Playwright passent en local et CI
- [ ] `DATABASE_SCHEMA.md` reflète l'état BDD post-Sprint 1
- [ ] `RECAP_SPRINT1_AUTH_RBAC_*.md` créé et complet
- [ ] Smoke test prod : 6/6 OK
- [ ] Aucun ticket de support reçu de Dr Fantin dans les 48h post-déploiement (validation par observation)

**Dépendance** : T1 à T7 mergés.

---

## 4. Contraintes non-négociables (rappel à coller à Claude Code si dérive)

Ces règles ne souffrent aucune exception. Si Claude Code propose de les contourner, refuser et insister.

1. **Modifications additives uniquement** — jamais de full rewrite d'un fichier existant. Toujours ajouter ou éditer ponctuellement.
2. **Migrations BDD versionnées** — chaque migration `.sql` a son `_down.sql` symétrique. Aucune modification BDD via Studio sans capture en migration.
3. **Pas de localStorage / sessionStorage** — interdit par contrainte projet (cf. instructions DentalLearn). Utiliser React state uniquement.
4. **`course_watch_logs` immuables** — JAMAIS supprimer ou modifier ces logs (obligation réglementaire DPC). Le hook `useTrackAudio` ou équivalent doit rester intact.
5. **`access_type !== 'full'` = preview** — c'est ce flag qui détermine le mode preview/demo, PAS le rôle admin. Ne pas confondre.
6. **Format `questions.options` runtime** — array plat `[{id, text, correct}]`. Pas `is_correct`, pas `{choices: [...]}`. Si le code legacy diverge, ne pas refactorer dans ce sprint.
7. **Lecture exacte des fichiers** — toujours `sed`/`grep` pour lire le contenu réel d'un fichier avant de le modifier. Jamais de modification basée sur une interprétation de mémoire.
8. **Ambiguïté = question à Dr Fantin** — toute instruction ambiguë doit être clarifiée AVANT de coder. Ne jamais combler avec des hypothèses.
9. **Commits atomiques** — un ticket = une PR. Pas de mélange entre tickets dans la même branche.
10. **Tests fournis dans le ticket** — chaque ticket livre ses tests d'acceptation. Pas de "tests viendront plus tard".
11. **RGPD modèle A** — toute analytics tenant doit être agrégée. Aucune donnée nominative ne doit remonter au tenant via une API. Garanti côté code ET côté SQL (helpers dédiés).
12. **Ne pas toucher la dette listée §5** sans ticket explicite.

---

## 5. Dette technique connue à NE PAS toucher dans ce sprint

| # | Dette | Origine | Pourquoi on ne touche pas |
|---|---|---|---|
| D1 | `src/types/database.ts` legacy divergent du runtime | Tickets news | Refacto risquée hors scope auth |
| D2 | FK `news_syntheses → questions` ON DELETE SET NULL crée orphelins | T5 news | Ticket news dédié à venir |
| D3 | Enrichissement script méta-analyses | T7 news | Hors scope auth |
| D5 | Badge `type='manual'` exception non codée | T8-P2 news | Hors scope auth |
| D6 | Responsive mobile pages admin News | T8-P1 news | Hors scope auth |
| D7 | `.mcp.json` typo `rvgv` → `rvgz` | Audit T5 | Trivial mais hors scope |
| D8 | `NCBI_API_KEY` non configurée Vercel | T2 news | Hors scope auth |
| D10 | Embeddings OpenAI vides | T5 news | Phase 3 dédiée |
| D11 | Pagination cron `synthesize_articles` | T5 news | Pas urgent |

**Dette nouvelle créée par ce sprint à logger pour V2** :
- Table legacy `profiles.role` toujours présente, redondante avec `user_roles` — refacto à prévoir quand plus aucun code ne s'en sert
- Workflow d'invitation par email = lien simple V1 ; à durcir avec single-use token + expiration courte en V2
- Suppression de compte RGPD = soft delete V1 (`deletion_requested_at`) ; workflow d'effacement effectif à automatiser V2
- Multi-cabinets par praticien (1 user = N orgs) = contrainte simplificatrice V1 levée en V2 si besoin commercial

---

## 6. Annexes

### 6.1 Liste exhaustive des fichiers à créer/modifier (estimation)

**Migrations SQL** (6) :
- `0013_sprint1_rbac_multitenant.sql` + `_down.sql` (T1)
- `0014_sprint1_formations_owner_org.sql` + `_down.sql` (T3)
- `0015_handle_new_user_trigger.sql` + `_down.sql` (T4, si trigger absent)
- `0016_attestations_organisme_dynamic.sql` + `_down.sql` (T7)

**Code TypeScript nouveau** :
- `src/lib/auth/rbac.ts` (T2)
- `src/middleware.ts` (T2 — extension probable)
- `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/login/page.tsx`, etc. (T4 — vérifier état actuel)
- `src/app/admin/organizations/*` (T5)
- `src/app/tenant/*` (T6 — nouveau dossier)
- `src/app/api/admin/organizations/*` (T5)
- `src/app/api/tenant/*` (T6)

**Code TypeScript modifié** (estimé ~11 fichiers via grep T2) :
- Tous les `route.ts` admin avec hardcoding email
- `src/lib/attestations/*` (T7)
- Layouts existants (T6 pour le branding tenant)

**Tests Playwright** :
- `tests/e2e/sprint1/scenario_1_signup_user_solo.spec.ts`
- `tests/e2e/sprint1/scenario_2_create_cabinet.spec.ts`
- `tests/e2e/sprint1/scenario_3_hr_entity_branding.spec.ts`
- `tests/e2e/sprint1/scenario_4_training_org_isolation.spec.ts`
- `tests/e2e/sprint1/scenario_5_inter_tenant_isolation.spec.ts`

### 6.2 Estimation effort par ticket

| Ticket | Effort (jours Claude Code) | Risque |
|---|---|---|
| T1 — Migration BDD fondations | 1-2 | Faible |
| T2 — Hardcoding admin + helpers RBAC | 1-2 | Moyen (régressions admin possibles) |
| T3 — Isolation contenu + RLS | 2-3 | Élevé (RLS critiques, tests indispensables) |
| T4 — Pages auth user | 2-3 | Moyen (délivrabilité emails) |
| T5 — Back-office /admin/organizations | 2-3 | Faible |
| T6 — Espace admin tenant + branding | 3-4 | Moyen (composants nouveaux) |
| T7 — Attestations organisme dynamique | 1-2 | Moyen (PDF generation) |
| T8 — Tests E2E + doc + smoke | 1-2 | Faible |
| **Total** | **13-21 jours** | |

À pondérer par les allers-retours réels (revue PR Dr Fantin, ajustements). Réaliste : 3-4 semaines calendaires en travail régulier.

---

*Handoff produit le 2 mai 2026 — DentalLearn Sprint 1 — Auth + RBAC + Multi-tenant — version 1.0*
