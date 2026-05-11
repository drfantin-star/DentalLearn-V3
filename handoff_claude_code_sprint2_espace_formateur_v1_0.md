# Handoff Claude Code — Sprint 2 Espace Formateur
## Plan de travail actionnable pour la livraison de l'espace formateur DentalLearn V1

**Document compagnon de** : `MATRICE_ROLES_DENTALLEARN_V1.md` (V1.1) — voir §2.1 rôle `formateur`
**Version handoff** : 1.0
**Date** : 2 mai 2026
**Destinataire** : Claude Code
**Sprint cible** : Sprint 2 (estimé 3-4 semaines)
**Dépendances amont** : Sprint 1 mergé (au moins T1, T2, T3 — fondations RBAC + middleware + isolation contenu)

**Journal des versions**
- v1.0 (02/05/2026) — Première version. Découpage 8 tickets atomiques (T1→T8). Périmètre formateur V1 : planning + masterclass live + stats agrégées + profil public. **Pas de création/édition contenu** (reportée à un Sprint dédié).

---

## 0. Comment utiliser ce document

1. **Prérequis ABSOLU** : Sprint 1 doit être mergé en prod, et au minimum les tickets T1 (fondations BDD), T2 (helpers RBAC code) et T3 (isolation contenu) doivent être stables. Si l'un de ces tickets est encore en revue, attendre.
2. Pour chaque ticket : ouvrir un nouveau chat Claude Code, coller le **prompt de démarrage** (§1) puis le **bloc ticket** correspondant (§3.X). Un ticket = une discussion = une PR.
3. Claude Code commence systématiquement par un audit BDD + un audit code avant d'écrire la moindre migration ou ligne. Aucun raccourci.
4. Les contraintes non-négociables (§4) sont identiques à Sprint 1 — rappelées en cas de dérive.
5. La dette technique connue (§5) ne doit pas être touchée.

**Pourquoi 8 tickets** : même logique que Sprint 1. Chaque ticket est livrable en 1-3 jours, mergeable indépendamment, testable de bout en bout. T1 et T2 conditionnent les autres ; T3-T7 peuvent partiellement se paralléliser ; T8 est la clôture.

---

## 1. Prompt de démarrage (à coller dans Claude Code en début de chaque ticket)

```
Tu travailles sur le projet DentalLearn, application de révision post-formation
pour chirurgiens-dentistes éditée par EROJU SAS (marque Dentalschool Formations).
Stack : Next.js 14 / TypeScript / Supabase / Vercel.
Repo : github.com/drfantin-star/DentalLearn-V3.git
Production : https://dental-learn-v3.vercel.app
Supabase : projet dxybsuhfkwuemapqrvgz

Ta mission : implémenter le Ticket [N] du Sprint 2 (Espace Formateur V1) décrit
dans `handoff_claude_code_sprint2_espace_formateur_v1_0.md` à la racine du repo.

PRÉREQUIS : le Sprint 1 (Auth + RBAC + Multi-tenant) est mergé en prod. Les
helpers RBAC (`isSuperAdmin`, `hasRole`, `getUserOrg`, `getUserIntraRole`)
existent dans `src/lib/auth/rbac.ts`. La table `user_roles` est en place. La
colonne `formations.owner_org_id` existe.

Documents de référence à lire AVANT d'écrire la moindre ligne :
1. `MATRICE_ROLES_DENTALLEARN_V1.md` — §2.1 rôle `formateur` + §3.6 actions F.01-F.06
2. `DATABASE_SCHEMA.md` — schéma Supabase à jour post-Sprint 1
3. `handoff_claude_code_sprint1_auth_rbac_v1_0.md` — pour comprendre les helpers
   RBAC et patterns mis en place au Sprint précédent
4. `handoff_claude_code_sprint2_espace_formateur_v1_0.md` — ce document
5. Le bloc "Ticket [N]" en §3.[N] du présent handoff

Avant d'écrire la moindre ligne de code :
1. Inspecte le schéma Supabase actuel via le MCP Supabase (vérifier que les
   tables Sprint 1 sont bien en place, lister les tables `live_*` ou
   `formateur_*` éventuellement déjà créées).
2. Si le ticket touche des fichiers existants : utilise sed/grep pour lire le
   contenu exact. Ne te base JAMAIS sur ton interprétation.
3. Vérifie l'état actuel de la table `formations` : champs `instructor_name`
   (varchar texte libre) et l'absence de FK vers un user_id formateur.
4. Inspecte les patterns existants pour les pages user (`/profil`, `/formations`)
   et admin (`/admin/news`, `/admin/organizations`) — l'espace formateur doit
   réutiliser ces patterns, pas créer un design parallèle.
5. Si une instruction est ambiguë : pose la question à Dr Fantin AVANT de coder.
6. Produis un compte-rendu en 3 parties (état actuel, plan d'attaque, questions
   bloquantes) et ATTENDS validation de Dr Fantin avant de commencer.

Respecte impérativement les contraintes listées dans §4 du handoff Sprint 2 :
- Modifications additives uniquement
- Migrations versionnées avec _down.sql
- Pas de localStorage / sessionStorage
- Stats formateur strictement agrégées (cohérence RGPD modèle A décidé Sprint 1)
- Pas de création de contenu pédagogique côté formateur (hors scope V1)
```

---

## 2. Secrets et environnement

**Secrets nouveaux pour Sprint 2** :

```bash
# Visio (Sprint 2 V1 = lien Zoom manuel, pas d'intégration API requise)
# Si bascule sur intégration Zoom API au Ticket 5 :
ZOOM_ACCOUNT_ID=                 # uniquement si décision intégration API confirmée
ZOOM_CLIENT_ID=
ZOOM_CLIENT_SECRET=

# Push notifications — déjà configuré Sprint 1 si T4 livré
# Vérifier présence VAPID keys :
NEXT_PUBLIC_VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:drfantin@gmail.com
```

**Décision visio à arbitrer dans Ticket 5** :
- Option A (V1 recommandée) : champ `zoom_url` saisi manuellement par le formateur. Le formateur crée son propre webinar Zoom de son côté et colle l'URL.
- Option B (V2) : intégration OAuth Zoom + création automatique du webinar côté DentalLearn. Plus complet mais demande gestion des tokens OAuth, refresh, et contrat Zoom Pro/Business par formateur.

Recommandation : Option A pour Sprint 2. Bascule Option B uniquement si Dr Fantin signale un blocage usage chez les formateurs après livraison.

---

## 3. Tickets Sprint 2 (dans cet ordre)

### Ticket 1 — Migration BDD entités formateur

**Objectif** : créer toutes les tables et liens BDD nécessaires à l'espace formateur (assignation formateur ↔ formation, événements présentiels, sessions live, inscriptions, profils publics formateur). Aucune modification code applicatif.

**Tâches**

**Migration `0017_sprint2_formateur_entities.sql`** :

```sql
-- Liaison formateur ↔ formations (un formateur peut animer N formations,
-- une formation peut avoir N formateurs avec un primaire)
CREATE TABLE formation_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formation_id uuid NOT NULL REFERENCES formations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  UNIQUE (formation_id, user_id)
);

CREATE INDEX formation_instructors_user_id_idx ON formation_instructors(user_id);

-- Profil public formateur (page publique /formateurs/[slug])
CREATE TABLE formateur_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  slug varchar(80) NOT NULL UNIQUE,
  display_name varchar(120) NOT NULL,
  bio_short varchar(280),
  bio_long text,
  photo_pro_url text,
  linkedin_url text,
  website_url text,
  expertise_tags text[],
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX formateur_profiles_slug_idx ON formateur_profiles(slug);
CREATE INDEX formateur_profiles_published_idx ON formateur_profiles(is_published)
  WHERE is_published = true;

-- Événements présentiels (formations en présentiel par le formateur)
CREATE TABLE live_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formation_id uuid REFERENCES formations(id) ON DELETE SET NULL,
  title varchar(200) NOT NULL,
  description text,
  location_city varchar(120) NOT NULL,
  location_venue varchar(200),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  external_registration_url text,
  capacity int,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT live_events_dates_coherent CHECK (ends_at IS NULL OR ends_at > starts_at)
);

CREATE INDEX live_events_formateur_idx ON live_events(formateur_user_id);
CREATE INDEX live_events_starts_at_idx ON live_events(starts_at);
CREATE INDEX live_events_published_upcoming_idx ON live_events(starts_at)
  WHERE is_published = true AND starts_at > now();

-- Sessions live (masterclass en visio sur la plateforme)
CREATE TABLE live_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formateur_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  formation_id uuid REFERENCES formations(id) ON DELETE SET NULL,
  title varchar(200) NOT NULL,
  description text,
  starts_at timestamptz NOT NULL,
  duration_min int NOT NULL DEFAULT 60,
  zoom_url text,
  zoom_password varchar(100),
  capacity int,
  status varchar(20) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('draft', 'scheduled', 'live', 'completed', 'cancelled')),
  recording_url text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX live_sessions_formateur_idx ON live_sessions(formateur_user_id);
CREATE INDEX live_sessions_starts_at_idx ON live_sessions(starts_at);
CREATE INDEX live_sessions_status_idx ON live_sessions(status);

-- Inscriptions aux sessions live (1 user = 1 inscription max par session)
CREATE TABLE live_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registered_at timestamptz NOT NULL DEFAULT now(),
  attended boolean,
  attended_duration_sec int,
  cancelled_at timestamptz,
  UNIQUE (session_id, user_id)
);

CREATE INDEX live_registrations_user_idx ON live_registrations(user_id);
CREATE INDEX live_registrations_session_idx ON live_registrations(session_id);
```

**Helpers SQL versionnés dans la même migration** :
- `is_formateur_of(p_user_id uuid, p_formation_id uuid) RETURNS boolean` — vérifie si user est instructor de cette formation
- `get_formateur_formations(p_user_id uuid) RETURNS SETOF uuid` — liste les formation_id assignées
- `formateur_aggregated_stats(p_user_id uuid, p_date_from date, p_date_to date) RETURNS jsonb` — KPIs agrégés sur SES formations (cf. T3 pour usage)

**RLS sur les 5 nouvelles tables** :
- `formation_instructors` : SELECT public sur les rows avec `is_published=true` côté formation. INSERT/UPDATE/DELETE super_admin uniquement (pas le formateur lui-même — c'est Dr Fantin qui assigne).
- `formateur_profiles` : SELECT public sur `is_published=true`. UPDATE par le formateur lui-même (`user_id = auth.uid()`) ou super_admin. INSERT par super_admin uniquement.
- `live_events` : SELECT public sur `is_published=true`. UPDATE/DELETE par le formateur owner ou super_admin. INSERT par formateur ou super_admin.
- `live_sessions` : SELECT public sur `is_published=true`. UPDATE/DELETE par le formateur owner ou super_admin.
- `live_registrations` : SELECT par le user concerné OU le formateur de la session OU super_admin. INSERT par le user lui-même. UPDATE pour cancel par le user, attended par le formateur ou cron.

**Migration de rollback** : `0017_sprint2_formateur_entities_down.sql` symétrique.

**Critères d'acceptation**
- [ ] Migration applicable et reversible
- [ ] Les 5 tables présentes via `list_tables`
- [ ] Helper `is_formateur_of` testé positif/négatif
- [ ] Tentative INSERT 2 inscriptions du même user à la même session → erreur UNIQUE
- [ ] Tentative INSERT live_event avec `ends_at < starts_at` → erreur CHECK
- [ ] `DATABASE_SCHEMA.md` mis à jour avec section "Espace Formateur — Sprint 2"

**Pas dans ce ticket** : aucune modification code TypeScript, aucune page créée, aucune assignation initiale de formateur. C'est T2.

---

### Ticket 2 — Helpers RBAC formateur + middleware + assignation initiale

**Objectif** : créer les helpers TypeScript `isFormateur`, `getFormateurFormations`, ajouter le middleware sur `/formateur/*`, et fournir un script ou page d'assignation des formateurs aux formations existantes.

**Tâches**

**Audit préalable** :
- Vérifier que `src/lib/auth/rbac.ts` existe avec les helpers Sprint 1 (`isSuperAdmin`, `hasRole`, etc.)
- Vérifier le middleware Next.js existant créé en Sprint 1 T2

**Extension `src/lib/auth/rbac.ts`** :
- `isFormateur(userId: string): Promise<boolean>` — `hasRole(userId, 'formateur')`
- `getFormateurFormations(userId: string): Promise<Formation[]>` — appel `get_formateur_formations()` SQL + JOIN formations pour récupérer titre/slug/cover
- `isFormateurOf(userId: string, formationId: string): Promise<boolean>` — appel `is_formateur_of()` SQL

**Extension middleware Next.js** :
- Helper `requireFormateur()` qui redirige vers `/login` si non connecté, vers `/403` si pas le rôle formateur
- Pages `/formateur/*` gatées
- Cas particulier : un super_admin doit pouvoir accéder à `/formateur/*` aussi (mode "voir comme un formateur") — vérification `hasRole('formateur') || isSuperAdmin()`

**Page d'assignation initiale** (`/admin/formations/[id]/instructors`) :
- Page super_admin pour assigner des formateurs à une formation
- Liste des formateurs actuels + bouton "Ajouter un formateur" (search par email user)
- Toggle `is_primary` pour désigner le formateur principal
- Bouton "Promouvoir au rôle formateur" si l'utilisateur ciblé n'a pas encore le rôle (insert dans `user_roles`)
- Création automatique d'un row `formateur_profiles` (avec slug auto-généré `prenom-nom`) lors de la première assignation s'il n'existe pas

**Stub des pages `/formateur/*`** (à coder en T3-T6) :
- `/formateur/dashboard` — placeholder "Bientôt disponible"
- `/formateur/agenda` — placeholder
- `/formateur/sessions` — placeholder
- `/formateur/profil` — placeholder
- Layout dédié `src/app/formateur/layout.tsx` avec sidebar nav vers ces 4 pages

**Critères d'acceptation**
- [ ] Un user sans rôle formateur ni super_admin tentant d'accéder à `/formateur/dashboard` → redirigé `/403`
- [ ] Un super_admin accède à `/formateur/dashboard` (stub visible)
- [ ] Un user avec rôle formateur accède à `/formateur/dashboard` (stub visible)
- [ ] Page `/admin/formations/[id]/instructors` permet à Dr Fantin d'assigner un test formateur en moins de 1 min
- [ ] L'assignation crée bien un row `formation_instructors` + un row `user_roles (role='formateur')` si absent + un row `formateur_profiles` avec slug
- [ ] Helpers couverts par tests unitaires (cas passant + cas échouant)

**Dépendance** : T1 mergé.

---

### Ticket 3 — Dashboard stats formateur

**Objectif** : livrer la page `/formateur/dashboard` avec les KPIs agrégés sur les formations animées par le formateur connecté. **Strictement agrégé** (cohérence RGPD modèle A décidé Sprint 1).

**Tâches**

**Helper SQL `formateur_aggregated_stats(p_user_id uuid, p_date_from date, p_date_to date) RETURNS jsonb`** :

Retourne un objet JSONB :
```json
{
  "formations_count": 3,
  "members_active_30d": 142,
  "completion_rate_avg": 0.67,
  "total_sequences_completed": 821,
  "total_points_distributed": 8450,
  "avg_session_duration_sec": 240,
  "formations_breakdown": [
    {
      "formation_id": "uuid",
      "title": "Fêlures et Syndrome de la Dent Fêlée",
      "slug": "felures-overlays",
      "users_active_30d": 67,
      "completion_rate": 0.71,
      "points_distributed": 3200
    },
    ...
  ]
}
```

**Aucune donnée nominative individuelle**. La fonction effectue tous les agrégats côté SQL via `COUNT DISTINCT`, `AVG`, `SUM` — jamais de retour de `user_id` ou `email`.

**Page `/formateur/dashboard`** :
- Cards KPIs en haut : Formations actives, Apprenants actifs 30j, Taux complétion moyen, Points distribués
- Section "Détail par formation" : tableau avec une ligne par formation animée + barres de progression
- Graph engagement 30 jours (sparkline ou Chart.js) — sessions complétées/jour
- Filtre période : 7 / 30 / 90 jours (default 30j)
- Note discrète en bas : "Données agrégées — conformément à notre politique RGPD, aucun apprenant n'est identifié individuellement."

**Pas dans ce ticket** :
- Pas de calcul revenus (décision Q6 antérieure : V2)
- Pas d'export CSV (V2)
- Pas de drill-down par séquence (V2)

**Critères d'acceptation**
- [ ] Un formateur test assigné à 1 formation voit ses stats correctes (vérifier vs SELECT manuel en BDD)
- [ ] Un formateur sans formation assignée voit un état vide explicite ("Aucune formation assignée — contacte Dr Fantin pour en obtenir")
- [ ] Aucune route API `/api/formateur/stats` ne retourne de donnée nominative — testé par lecture du code + 1 test d'intégration
- [ ] Filtre période fonctionne (7/30/90 jours)
- [ ] Performance acceptable : page render < 500 ms avec 5 formations animées

**Dépendance** : T1, T2 mergés.

---

### Ticket 4 — Agenda formations présentielles (live_events)

**Objectif** : permettre au formateur de gérer ses dates de formations en présentiel + affichage public sur la fiche formation correspondante et son profil.

**Tâches**

**Pages formateur** :
- `/formateur/agenda` — liste de ses live_events (à venir + passés en onglet)
- Bouton "Nouvelle date présentielle"
- `/formateur/agenda/new` — formulaire création
- `/formateur/agenda/[id]` — édition / suppression

**Routes API** :
- `POST /api/formateur/events` — création (validation Zod)
- `PATCH /api/formateur/events/[id]` — édition (vérification ownership)
- `DELETE /api/formateur/events/[id]` — soft delete (set is_published=false)
- Tous gatés par `requireFormateur()` + check ownership

**Affichage public** :
- Composant `<UpcomingEvents formateurUserId={...} formationId={...} />` réutilisable :
  - Sur le profil public formateur `/formateurs/[slug]` (voir T6) — toutes les events à venir du formateur
  - Sur la fiche formation `/formation/[category]?formation=[slug]` — events à venir liés à cette formation spécifique
- Card avec : date + ville + lien "S'inscrire" (ouvre `external_registration_url` dans un nouvel onglet)
- Tri chronologique ascendant

**Notes UX** :
- Pas d'inscription DentalLearn pour les présentiels (juste un lien externe vers le système d'inscription du formateur ou Dentalschool)
- Pas de notification push pour les events présentiels (V1) — ils sont visibles passivement sur les pages formation/formateur

**Critères d'acceptation**
- [ ] Un formateur crée un event en moins de 1 min
- [ ] Event publié visible sur sa page profil et sur la fiche formation
- [ ] Event non publié (draft) invisible côté public
- [ ] Edition + suppression fonctionnelles avec ownership respecté
- [ ] Un autre formateur ne peut PAS éditer un event qui ne lui appartient pas (test API direct)
- [ ] Validation : starts_at > now() obligatoire à la création (warning sinon)

**Dépendance** : T1, T2 mergés.

---

### Ticket 5 — Masterclass live (live_sessions + inscriptions)

**Objectif** : livrer le système de masterclass en ligne (création par formateur, inscription par apprenants, accès au lien Zoom le moment venu).

**Tâches**

**Pages formateur** :
- `/formateur/sessions` — liste de ses sessions (à venir / live / passées)
- `/formateur/sessions/new` — formulaire création (titre, description, formation_id optionnel, starts_at, duration_min, zoom_url, capacity, password optionnel)
- `/formateur/sessions/[id]` — édition + liste des inscrits (nb agrégé + avatars anonymisés ou liste avec accord du user — V1 = compteur + liste prénoms uniquement)
- Bouton "Marquer terminée + ajouter recording_url"

**Pages user (apprenant)** :
- `/sessions` — catalogue des prochaines masterclass (toutes confondues, triées chronologiquement)
- `/sessions/[id]` — détail + bouton "S'inscrire" (gratuit pour les abonnés DentalLearn V1)
- Si inscrit : bouton "Rejoindre la session" (visible 15 min avant le début, ouvre zoom_url avec password si défini)
- Bouton "Annuler mon inscription" (jusqu'à H-2)

**Routes API** :
- `POST /api/formateur/sessions` / `PATCH` / `DELETE` — gatés requireFormateur + ownership
- `POST /api/sessions/[id]/register` — inscription user authentifié (vérification capacity, doublon)
- `DELETE /api/sessions/[id]/register` — annulation (set cancelled_at, libère un slot capacity)

**Décision tarification masterclass V1** (proposition à confirmer par Dr Fantin avant le début du ticket) :
- **V1 retenu** : masterclass live **gratuites pour tous les abonnés DentalLearn** (plan free et premium). Pas de paywall. Inclus dans la valeur produit.
- Si Dr Fantin souhaite paywall premium-only : ajouter un check `user_subscriptions.plan = 'premium'` côté inscription. Décision à acter dans le PR.

**Capacity gestion** :
- Si capacity définie et atteinte → bouton "S'inscrire" → "Liste d'attente" (créer waitlist V2 ; V1 = juste désactiver l'inscription avec message)

**Visio** :
- V1 : champ texte `zoom_url` saisi manuellement par le formateur. Le formateur crée son propre webinar Zoom de son côté et colle l'URL.
- Pas d'intégration Zoom API V1 — option B explicitement reportée.

**Critères d'acceptation**
- [ ] Formateur crée une session en moins de 2 min
- [ ] User s'inscrit + voit le bouton "Rejoindre" 15 min avant le début
- [ ] Capacité respectée (test : inscrire jusqu'à capacity, tentative supplémentaire bloquée)
- [ ] Annulation fonctionne et libère le slot
- [ ] zoom_url affiché uniquement aux inscrits (jamais en public)
- [ ] Status `live` automatiquement appliqué à starts_at via cron + status `completed` à starts_at + duration_min + 15 min (helper SQL ou cron simple)
- [ ] Test ownership : un autre formateur ne peut pas éditer une session qui n'est pas la sienne

**Dépendance** : T1, T2 mergés.

---

### Ticket 6 — Profil public formateur

**Objectif** : livrer la page publique `/formateurs/[slug]` accessible sans auth, et la page d'édition `/formateur/profil` pour le formateur connecté.

**Tâches**

**Page publique `/formateurs/[slug]`** :
- Header : photo pro + nom + bio courte + tags expertise + lien LinkedIn / site
- Section "Bio" : bio_long en markdown rendu HTML
- Section "Formations animées" : grid des formations (réutiliser composant FormationCard existant)
- Section "Prochaines dates présentielles" : composant `<UpcomingEvents>` de T4
- Section "Prochaines masterclass live" : sessions à venir avec bouton inscription
- Section "Replays" (V1 placeholder vide ; V2 listera les recording_url des sessions passées)
- SEO : balises meta open graph + JSON-LD `Person` schema.org
- Pas de signature anti-bot ni captcha (page strictement publique)

**Page édition `/formateur/profil`** :
- Formulaire édition tous les champs `formateur_profiles`
- Upload photo pro via Supabase Storage bucket `formateur-photos` (validation : jpg/png, max 2 Mo, redim auto à 800x800)
- Tags expertise : multi-select avec autocomplete (sources : `news_taxonomy.specialite` + tags libres)
- Validation slug : unique, format `[a-z0-9-]+`, modifiable mais avec warning "URL publique va changer"
- Bouton "Publier mon profil" (passe `is_published=true` + `published_at=now()`)
- Bouton "Dépublier" (passe `is_published=false`)
- Preview en temps réel à droite du formulaire

**Routes API** :
- `PATCH /api/formateur/profile` — edition (vérification user_id = auth.uid())
- `POST /api/formateur/profile/upload-photo` — upload via Storage
- `GET /api/public/formateurs/[slug]` — récupération publique (cacheable)

**Génération slug initiale** :
- À l'assignation d'un formateur (T2), générer slug depuis `display_name` (ex: "Dr Gauthier Weisrock" → "dr-gauthier-weisrock"), avec suffixe -2, -3 si collision
- `display_name` initial = `user_profiles.first_name + ' ' + user_profiles.last_name` (modifiable ensuite)

**Critères d'acceptation**
- [ ] Page publique accessible sans login, indexable Google (vérifier avec curl -A "Googlebot")
- [ ] Édition profil par le formateur fonctionnelle
- [ ] Upload photo respecte les limites (test : tentative 5 Mo → rejet propre)
- [ ] Slug modifiable mais collision détectée
- [ ] Profil non publié (`is_published=false`) → page publique retourne 404
- [ ] Au moins 2 profils tests créés et publiés en prod par Dr Fantin (ex : Dr Weisrock + Dr Elbeze)

**Dépendance** : T1, T2 mergés. Recommandé : T4 (events) et T5 (sessions) mergés pour avoir du contenu sur la page profil.

---

### Ticket 7 — Push notifications rappels live

**Objectif** : activer les notifications push pour rappeler aux apprenants leurs sessions live à venir et signaler les nouvelles publications de formateurs qu'ils suivent.

**Tâches**

**Audit préalable** :
- Vérifier que le système push existant (table `push_subscriptions`, `notifications`, web push avec VAPID) est opérationnel post-Sprint 1
- Vérifier que les VAPID keys sont configurées en prod
- Lister les types de notifications déjà émises pour ne pas dupliquer

**Cron Edge Function `live_session_reminders`** :
- Schedule : toutes les heures, à h:00 (cron `0 * * * *` UTC)
- Pour chaque `live_sessions` avec `starts_at` dans les prochaines 25 heures :
  - Si `starts_at` est entre 23h00 et 25h00 → envoyer rappel J-1
  - Si `starts_at` est entre 0h45 et 1h15 → envoyer rappel H-1
  - Pour chaque inscrit non `cancelled` : créer un row `notifications` (type=`push`, message templates dédiés) + push effective via webpush
- Idempotence : marquer dans une table `live_session_reminders_sent (session_id, user_id, reminder_type)` pour ne jamais envoyer 2 fois
- Migration `0018_sprint2_reminders_log.sql` : crée cette table (additive)

**Système "Suivre un formateur"** (option simple V1) :
- Nouvelle table `formateur_followers (user_id, formateur_user_id, followed_at)` — additive dans la même migration
- Bouton "Suivre" sur la page profil formateur
- Quand un formateur publie un nouvel `live_event` ou `live_session` : envoyer notification push aux followers (Edge Function `notify_followers_new_publication` triggée via pg_notify ou simple cron)
- Limiter à 1 notification "nouvelle publication" par formateur par jour pour éviter le spam (debounce)

**Préférences notifications** :
- Étendre `user_notification_preferences` :
  - `live_session_reminders boolean DEFAULT true`
  - `formateur_publications boolean DEFAULT true`
- Page `/profil/notifications` ajoute les 2 toggles
- Cron respecte ces préférences

**Templates messages** :
- Rappel J-1 : "📅 Demain à [HH:MM] : [titre session] avec [Dr X]. N'oublie pas !"
- Rappel H-1 : "🎙️ Dans 1 heure : [titre session]. Le lien Zoom sera disponible 15 min avant."
- Nouvelle publication : "✨ [Dr X] vient de publier une nouvelle masterclass : [titre]"

**Critères d'acceptation**
- [ ] Cron tourne sans erreur (tester en ajoutant manuellement une session à starts_at = now()+24h, vérifier réception push)
- [ ] Idempotence vérifiée : 2 runs consécutifs n'envoient pas 2 fois
- [ ] User qui désactive `live_session_reminders` ne reçoit plus de rappel
- [ ] Bouton "Suivre" sur profil formateur fonctionnel
- [ ] Notification "nouvelle publication" reçue par les followers (test avec création d'une session par un formateur test + un follower test)
- [ ] Debounce respecté (pas plus d'1 notification "nouvelle publication" par formateur/jour)
- [ ] Notifications loggées dans la table `notifications` avec status approprié

**Dépendance** : T1, T5 mergés. T6 recommandé pour le suivi formateur.

---

### Ticket 8 — Tests E2E + documentation finale + smoke prod

**Objectif** : validation bout-en-bout du Sprint 2, mise à jour exhaustive de la documentation, smoke test post-déploiement.

**Tâches**

**Suite Playwright E2E** (`tests/e2e/sprint2/`) :
- Scénario 1 : super_admin assigne un formateur à une formation → formateur connecté voit la formation dans son dashboard
- Scénario 2 : formateur crée un live_event présentiel → user voit la date sur la fiche formation correspondante
- Scénario 3 : formateur crée une live_session → user s'inscrit → bouton "Rejoindre" disponible 15 min avant
- Scénario 4 : formateur édite son profil + publie → page publique accessible sans login
- Scénario 5 : capacity respectée (5 inscriptions max → 6e bloquée)
- Scénario 6 : isolation — un formateur A ne peut pas éditer une session du formateur B (test API direct)
- Scénario 7 : push reminder J-1 envoyé pour une session test à h+24

**Documentation** :
- `DATABASE_SCHEMA.md` : section "Espace Formateur — Sprint 2" avec les 6 nouvelles tables (formation_instructors, formateur_profiles, live_events, live_sessions, live_registrations, formateur_followers, live_session_reminders_sent)
- `RECAP_SPRINT2_FORMATEUR_<date>.md` : nouveau fichier dans le dossier projet
- `MATRICE_ROLES_DENTALLEARN_V1.md` → V1.3 : mention "implémenté Sprint 2" sur les actions F.01-F.05 livrées (F.06 revenus reste V2)

**Smoke test prod** :
- Connexion Dr Fantin (super_admin) accède à `/admin/formations/[id]/instructors` OK
- Assignation d'un formateur test OK
- Connexion du formateur test → `/formateur/dashboard` affiche stats (vide ou peuplées selon la formation assignée)
- Création d'un live_event de test → visible sur la fiche formation
- Création d'une live_session test à starts_at = now() + 30 min
- User test s'inscrit → reçoit push reminder à H-1 (attendre 30 min)
- Page profil public formateur test accessible

**Mise à jour mémoire projet** :
- Ajouter entrée memory.md cache projet : "Sprint 2 livré le X mai/juin 2026, espace formateur opérationnel, 5 formateurs onboardés en prod"

**Critères d'acceptation**
- [ ] Les 7 scénarios Playwright passent en local et CI
- [ ] `DATABASE_SCHEMA.md` reflète l'état BDD post-Sprint 2
- [ ] `RECAP_SPRINT2_FORMATEUR_*.md` créé et complet
- [ ] Smoke test prod : 6/6 OK
- [ ] Au moins 2 profils formateurs publiés en prod (Dr Weisrock + Dr Elbeze recommandés)
- [ ] Aucun ticket de support reçu de Dr Fantin dans les 48h post-déploiement

**Dépendance** : T1 à T7 mergés.

---

## 4. Contraintes non-négociables

Identiques au Sprint 1 — rappelées intégralement ici pour autonomie du document.

1. **Modifications additives uniquement** — jamais de full rewrite.
2. **Migrations BDD versionnées** — `_down.sql` symétrique systématique.
3. **Pas de localStorage / sessionStorage** — React state uniquement.
4. **`course_watch_logs` immuables** — JAMAIS supprimer ou modifier ces logs (DPC).
5. **`access_type !== 'full'` = preview** — pas le rôle admin.
6. **Format `questions.options` runtime** — array plat `[{id, text, correct}]`.
7. **Lecture exacte des fichiers** — `sed`/`grep` avant toute modification.
8. **Ambiguïté = question à Dr Fantin** — jamais de supposition.
9. **Commits atomiques** — un ticket = une PR.
10. **Tests fournis dans le ticket** — pas de "tests viendront plus tard".
11. **RGPD modèle A** — analytics formateur strictement agrégées. Aucune donnée nominative individuelle dans `formateur_aggregated_stats()` ni dans les routes `/api/formateur/stats`.
12. **Ne pas toucher la dette §5**.

**Spécifiques Sprint 2** :

13. **Pas de création/édition contenu pédagogique côté formateur** — F.06 (création formation, séquence, question) explicitement reportée. Si Claude Code propose d'ajouter un éditeur séquence dans `/formateur/*`, refuser.
14. **Pas d'intégration Zoom API V1** — champ `zoom_url` manuel uniquement. L'intégration OAuth Zoom est V2 explicite.
15. **Inscriptions live = abonnés DentalLearn uniquement** — pas d'inscription anonyme aux live_sessions. Auth obligatoire.

---

## 5. Dette technique connue à NE PAS toucher dans ce sprint

Identique à Sprint 1, plus :

| # | Dette nouvelle Sprint 2 | À traiter quand |
|---|---|---|
| D14 | Calcul revenus formateurs (modèle économique non arrêté) | V2 quand modèle décidé |
| D15 | Intégration Zoom API OAuth (création auto webinar) | V2 si demande utilisateurs |
| D16 | Liste d'attente sessions complètes (waitlist) | V2 |
| D17 | Replays vidéo des sessions passées (lecture native, pas juste lien) | V2 |
| D18 | Drill-down stats par séquence dans dashboard formateur | V2 |
| D19 | Export CSV des inscrits par session | V2 si demande |

Ne pas pré-développer ces fonctionnalités même "tant qu'on y est". Scope discipline = livraison rapide V1.

---

## 6. Annexes

### 6.1 Liste exhaustive des fichiers à créer/modifier (estimation)

**Migrations SQL** (3) :
- `0017_sprint2_formateur_entities.sql` + `_down.sql` (T1)
- `0018_sprint2_reminders_log.sql` + `_down.sql` (T7)
- Migrations supplémentaires si trigger/cron à coder dans T7

**Code TypeScript nouveau** :
- `src/lib/auth/rbac.ts` (extension T2 — ajout `isFormateur`, `getFormateurFormations`, `isFormateurOf`)
- `src/middleware.ts` (extension T2 — `requireFormateur`)
- `src/app/formateur/layout.tsx` (T2)
- `src/app/formateur/dashboard/*` (T3)
- `src/app/formateur/agenda/*` (T4)
- `src/app/formateur/sessions/*` (T5)
- `src/app/formateur/profil/*` (T6)
- `src/app/formateurs/[slug]/page.tsx` (T6 — page publique)
- `src/app/sessions/*` (T5 — pages user inscriptions)
- `src/app/admin/formations/[id]/instructors/page.tsx` (T2)
- `src/app/api/formateur/*` (T3, T4, T5, T6)
- `src/app/api/sessions/[id]/register/route.ts` (T5)
- `src/components/UpcomingEvents.tsx` (T4)
- Edge Functions Supabase (T7) : `live_session_reminders`, `notify_followers_new_publication`

**Code TypeScript modifié** :
- Composant FormationCard pour afficher le formateur lié si présent
- Page formation `/formation/[category]?formation=[slug]` pour intégrer `<UpcomingEvents>` (T4)
- Page profil user pour ajouter toggles notifications (T7)

**Tests Playwright** :
- `tests/e2e/sprint2/scenario_1_assign_formateur.spec.ts`
- `tests/e2e/sprint2/scenario_2_live_event_presentiel.spec.ts`
- `tests/e2e/sprint2/scenario_3_live_session_inscription.spec.ts`
- `tests/e2e/sprint2/scenario_4_profil_public.spec.ts`
- `tests/e2e/sprint2/scenario_5_capacity.spec.ts`
- `tests/e2e/sprint2/scenario_6_isolation_formateur.spec.ts`
- `tests/e2e/sprint2/scenario_7_push_reminder.spec.ts`

### 6.2 Estimation effort par ticket

| Ticket | Effort (jours Claude Code) | Risque |
|---|---|---|
| T1 — Migration BDD entités formateur | 1-2 | Faible |
| T2 — Helpers RBAC formateur + assignation | 1-2 | Moyen (UI admin assignation nouvelle) |
| T3 — Dashboard stats formateur | 2-3 | Moyen (perf SQL agrégats à valider) |
| T4 — Agenda live_events | 1-2 | Faible |
| T5 — Masterclass live + inscriptions | 3-4 | Moyen (UX inscription, capacity, statut session) |
| T6 — Profil public formateur | 2-3 | Moyen (SEO + upload photo) |
| T7 — Push notifications rappels | 2-3 | Moyen (cron + idempotence + debounce) |
| T8 — Tests E2E + doc + smoke | 1-2 | Faible |
| **Total** | **13-21 jours** | |

Réaliste : 3-4 semaines calendaires en travail régulier, comme Sprint 1.

### 6.3 Décisions à confirmer en début de Sprint

Avant de lancer Ticket 1, Dr Fantin doit confirmer ou amender :

| # | Sujet | Recommandation handoff |
|---|---|---|
| S2.1 | Tarification masterclass live V1 | **Gratuit pour tous abonnés DentalLearn**. Si paywall premium souhaité, signaler avant T5. |
| S2.2 | Intégration visio | **Lien Zoom manuel V1**. Pas d'OAuth Zoom. |
| S2.3 | Affichage inscrits côté formateur | **Compteur + liste prénoms uniquement V1**. Si besoin liste nominative complète, signaler (impact RGPD à arbitrer). |
| S2.4 | Formateurs pilotes à onboarder en T8 | Recommandation : Dr Weisrock + Dr Elbeze (déjà présents dans le contenu Dentalschool). Confirmer ou ajouter. |

---

*Handoff produit le 2 mai 2026 — DentalLearn Sprint 2 — Espace Formateur — version 1.0*
