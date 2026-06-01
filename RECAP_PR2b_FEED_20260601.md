# RECAP — PR2b : Feed « Pour vous » + correctif de gating

**Date** : 2026-06-01
**Branche** : `claude/magical-edison-80pYE` (part d'un `main` incluant PR1 + PR2a)
**Projet Supabase** : `dxybsuhfkwuemapqrvgz`
**Périmètre** : Tâche A (feed personnalisé) + Tâche B (correctif de gating, commit distinct).

---

## 1. Vérification de prémisse (avant code)

- `git diff origin/main..HEAD` : la branche partait propre de `main` (PR2a `8be8725`
  mergée : onboarding + colonne `user_profiles.interests` + `useUser` exposant `interests`).
- Schéma reconfirmé en live via MCP Supabase (les audits Phase 0/0-bis dataient du jour,
  re-checkés) :
  - `formations` : `is_published` (bool), `category` (varchar), `axe_cp` (int), `slug`,
    `cover_image_url`, `created_at`, `title`. ✅
  - `epp_audits` : `is_published` (bool), `theme_slug` (text), `slug`, `title`. ✅
  - `questionnaires` : `actif` (bool), `axe_cp` (smallint), `slug`, **`titre`** (pas `title`),
    `time_estimate_min`. ✅
  - `bibliotheque_ressources` : `axe` (smallint), **`titre`**, `type`, `url`, `source`
    (pas de colonne de publication → toutes lignes live). ✅
  - `news_syntheses` : `status`, `formation_category_match`, `specialite`, `themes`,
    `cover_image_url`, `published_at` (date), **`display_title`**. ✅
  - `user_profiles.interests` : `jsonb`. ✅

### Écart bloquant découvert (RLS) — décision d'architecture

`news_syntheses` n'a **qu'une policy SELECT `service_role`** (aucune pour `authenticated`).
→ Un client SSR session (`@supabase/ssr`, RLS appliquée) **ne peut pas lire les news**.
C'est précisément pourquoi `/api/news/syntheses` utilise `createAdminClient`.

**Conséquence** : la contrainte non négociable « `/api/for-you` via client serveur session,
**jamais** service role » est incompatible avec une lecture directe de `news_syntheses`.
**Décision** : `/api/for-you` lit toutes les sources **pédagogiques** (formations, epp,
questionnaires, bibliothèque) via le **client SSR session** (RLS), et récupère les **news**
par un `fetch` serveur→serveur vers l'endpoint public **existant** `/api/news/syntheses`
(qui porte déjà l'accès service-role, lui). Aucun service role n'est introduit dans
`/api/for-you`, et aucune nouvelle route/migration/policy n'est créée (respect CLAUDE.md
« Validation explicite »).

> Les autres tables (formations / epp / questionnaires / bibliothèque) ont bien une policy
> SELECT `authenticated` (`true` ou `is_published`-gated) → lisibles par le client session. ✅

---

## 2. Tâche A — Feed « Pour vous »

### Fichiers
- **`src/types/forYou.ts`** (nouveau) — type `ForYouItem` normalisé partagé.
- **`src/app/api/for-you/route.ts`** (nouveau) — agrégation + scoring + mix + carte conformité.
- **`src/components/home/ForYouCard.tsx`** (nouveau) — carte générique pilotée par `type`.
- **`src/app/(app)/page.tsx`** (modifié) — section « Pour vous » + dédup « Fraîchement arrivé ».

### Route `GET /api/for-you`
- Lit l'utilisateur via le client SSR session ; lit `user_profiles.interests`.
- `{ items: [] }` si : pas d'utilisateur, `interests IS NULL`, ou `categories=[] ET axes=[]`.
- Sinon agrège en parallèle (`Promise.all`) et normalise vers `ForYouItem` :
  - **formation** : `is_published` ET (`category ∈ categories` → score 2, sinon `axe_cp ∈ axes`
    → score 1) ; href `/formation/{category}?formation={slug}`.
  - **epp** : `is_published` ET (`theme_slug ∈ categories` → 2, sinon `2 ∈ axes` → 1) ;
    href `/formation/{theme_slug}/epp`.
  - **autoeval** : `actif` ET `axe_cp ∈ axes` (score 1) ; href `/sante/auto-evaluation` ;
    matchReason **neutre** (« Votre point santé annuel ») — garde-fou auto-éval respecté.
  - **fiche** : `axe ∈ axes` (matching par axe uniquement) ; href
    `/{formation|patient|sante}/bibliotheque` (axe 1/3/4) ; « Parce que vous suivez {axe} ».
  - **news** : `status='active'` ET `formation_category_match ∈ categories` (pont principal) ;
    href `/news`.
- **Mix (anti-noyade, décision figée)** :
  1. Items pédagogiques matchés d'abord, triés **score desc puis date desc** (tous gardés).
  2. News matchées ensuite, triées `published_at` desc, **plafonnées à 6**.
  3. Si total < 9, complément avec news actives récentes (`matchReason='Actualité récente'`).
  4. **Carte conformité** (promo statique) ajoutée **une fois en fin de liste**.
- Carte conformité = `type:'conformite'`, `matchReason:'52 points pour sécuriser votre cabinet'`,
  href `/conformite`. **Aucun 0/52 dynamique** (tables `cabinet_compliance_*` non câblées).

### `ForYouCard`
- **Une seule** carte visuelle « feed » (jamais d'alternance FormationCardOverlay/NewsCardItem).
- Badge de type : Formation / EPP / Fiche / Auto-évaluation / Actu / Conformité.
- Accent couleur par axe : 1 `#8B5CF6`, 2 `#0F7B6C`, 3 `#D97706`, 4 `#EC4899` ;
  news/conformité (axe null) → neutre `#6B7280`. **Aucune couleur interdite** (`#2D1B96`/`#00D1C1`).
- Cover si dispo (formations/news), sinon dégradé accentué + picto. Titre + ligne `matchReason`
  discrète (+ « ~N min » si `estMinutes`). Clic → `href`.

### Section home
- Insérée **entre** la ligne Quiz/Journal/Événements et « Actualités » (titre « Pour vous »,
  icône `Sparkles`).
- Carousel horizontal + flèches desktop (pattern du carousel existant).
- `fetch('/api/for-you')` (client). **Rendue seulement si `items.length > 0`** (user ayant
  skippé l'onboarding → `{ items: [] }` → pas de section).
- **Dédup** : les formations présentes dans « Pour vous » (id `formation-<uuid>`) sont retirées
  de « Fraîchement arrivé ».

---

## 3. Tâche B — Correctif de gating (commit distinct)

**Fichier** : `src/components/layout/AppShell.tsx`.

**Problème** : la redirection onboarding ne vivait que dans `auth/callback` → un login
classique d'un user `interests IS NULL` n'était pas routé vers `/onboarding`.

**Fix** : dans `AppShell` (qui connaît déjà `usePathname`), ajout de `useUser()` (expose
`profile`/`loading`) + `useRouter`. Effet : quand le profil est **chargé** (pas pendant le
loading) ET `interests === null` ET `pathname !== '/onboarding'` → `router.replace('/onboarding')`.
Rien si `interests` non-null (skip inclus) ou encore en chargement. La redirection
`auth/callback` est **conservée** (les deux coexistent). `AudioContext.tsx` **non touché**.

---

## 4. Protocole sécurité / vérifs

- `tsc --noEmit` : **0 erreur** dans les fichiers livrés (for-you, ForYouCard, forYou, AppShell).
  Les erreurs résiduelles sont la baseline pré-existante documentée (AUDIT-22-D1, implicit-any),
  hors périmètre.
- `next lint` sur les fichiers touchés : **OK** (warnings pré-existants `<img>`/exhaustive-deps
  uniquement).
- `next build` : **succès complet** avec env Supabase présents (64/64 pages, `/api/for-you`
  enregistrée en route dynamique `ƒ`). Sans env (container), seules des pages **pré-existantes**
  (`/register`, `/admin/epp/new`) échouent au prerender — limitation d'environnement, pas du code.
- Vérif MCP Supabase : schéma + RLS reconfirmés (cf. §1).

### Points de smoke (à valider sur preview Vercel)
- (a) User avec intérêts → « Pour vous » peuplé (pédago d'abord, news plafonnées à 6,
  conformité en fin).
- (b) User ayant skippé (`{categories:[],axes:[]}`) → section **non rendue**.
- (c) Login classique d'un user `interests NULL` → routé vers `/onboarding` (via AppShell).
- (d) Chrome (nav + audio) intact partout ailleurs (hors `/onboarding`).

---

## 5. Contraintes respectées
- React state uniquement (aucun localStorage/sessionStorage).
- `/api/for-you` : client serveur `@supabase/ssr` (session) ; **jamais** service role.
- Aucune couleur interdite (`#2D1B96` / `#00D1C1`).
- `AudioContext.tsx` et `useSubmitSequenceResult` non touchés. Middleware non touché.
- Aucune migration, aucune table/colonne/route nouvelle, aucune dépendance ajoutée.

---

## Observations (hors périmètre, non implémenté)
- **News & RLS** : `news_syntheses` n'expose pas de policy SELECT `authenticated`. Le feed
  contourne proprement via l'endpoint public existant, mais une policy de lecture publique des
  news actives (ou une fonction `security definer`) clarifierait l'accès — à traiter dans un
  ticket dédié RLS si souhaité.
- **Matching news plafonné au pool récent** : faute de paramètre catégorie sur
  `/api/news/syntheses`, le matching `formation_category_match` s'applique aux 50 news les plus
  récentes renvoyées par l'endpoint (puis fallback récent). Pour un matching sur tout le pool,
  étendre l'endpoint avec un filtre `categories` (recommandé par l'audit Phase 0) — non fait ici
  pour rester minimal.
- **Conformité** : carte promo statique tant que `cabinet_compliance_*` n'est ni câblé ni
  réaligné (6/13 en base vs 7/52 en dur) — câblage = ticket dédié.
