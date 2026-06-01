# RECAP — PR2b-fix : loop de redirection + feed (zéro news / flood)

**Date** : 2026-06-01
**Branche** : `claude/magical-edison-80pYE` (part d'un `main` incluant PR2b)
**Projet Supabase** : `dxybsuhfkwuemapqrvgz`
**Périmètre** : Tâche 1 (loop, priorité) + Tâche 2 (feed) — deux commits distincts.

---

## 0. Vérification de prémisse / MCP

- `git diff origin/main..HEAD` : branche propre, PR2b (`b731d17` feed + `98dbe23` gating) au sommet.
- MCP — `interests` du user de test `fe4dd652-426c-47d3-8323-4ceb8883e26f` :
  `{"axes":[4,3],"categories":["esthetique","chirurgie","parodontologie","organisation","soft-skills"]}`
  → **non-null** : l'écriture skip/continue fonctionne. Le loop n'est donc PAS un bug d'écriture
  mais un bug de **cache d'état divergent**.
- MCP — policies `news_syntheses` : **une seule** policy `SELECT` `service_role` (aucune
  `authenticated`). Colonnes : présence de colonnes **internes** (`gdrive_file_id`, `gdrive_url`,
  `llm_model`, `validation_errors`, `validation_warnings`, `failed_attempts`, `added_by`,
  `last_edited_by`, `embedding`, `raw_id`, `scored_id`).

---

## 1. Tâche 1 — Loop de redirection (mécanisme exact CONFIRMÉ)

### Root-cause (tracé avant patch)
1. `useUser` (avant) était un hook à **état local par instance** (pas de store partagé). Il
   lit `interests` une fois au montage et ne refetch jamais (hors event auth).
2. `AppShell` vit dans **`(app)/layout.tsx`**, layout **persistant** : il ne remonte pas lors
   d'une navigation client-side dans le groupe `(app)`. Son instance `useUser` garde donc
   `interests=null` en **cache** depuis la 1ʳᵉ entrée.
3. Skip sur `/onboarding` → `useSaveInterests` écrit `{categories:[],axes:[]}` (non-null) en DB,
   puis `router.push('/')`.
4. `/onboarding → /` = navigation client-side dans `(app)` → **AppShell ne remonte pas** → son
   cache `interests` reste le **`null` périmé**.
5. L'effet d'AppShell se ré-exécute (pathname=`/`), voit `interests === null` périmé → `router.replace('/onboarding')`.
6. Sur `/onboarding`, l'ancien garde-fou faisait un **refetch direct Supabase** → voyait la vraie
   valeur non-null → `router.replace('/')`.
7. → **ping-pong `/` ↔ `/onboarding`** (AppShell cache-null vs onboarding refetch-non-null = les
   deux **sources divergentes**). Exactement la cause attendue par le brief.

### Fix appliqué (3 principes)
1. **Source unique** — `src/lib/hooks/useUser.ts` réécrit en **store partagé (singleton +
   `useSyncExternalStore`)** : tous les consommateurs (AppShell, onboarding, home…) lisent la
   **même** valeur ; un `refetch`/`mutate` met à jour **tous** les abonnés. API de retour
   inchangée (les 7 consommateurs existants continuent de marcher), + ajout de `mutateInterests`.
2. **Synchro avant navigation** — `onboarding/page.tsx` : après `saveInterests` (Continuer ET
   Skip), on fait `mutateInterests({categories,axes})` (**optimiste, synchrone**) puis `await
   refetch()` puis `router.replace('/')`. AppShell voit donc `interests` non-null **immédiatement**.
3. **Garde-fou AppShell durci** — distinction stricte `loading` vs `interests === null`,
   redirection **idempotente** via `redirectGuardRef` (ré-armée dès qu'on n'a plus besoin de
   rediriger ou qu'on est sur `/onboarding`). Plus de `router.replace` répété.
   Le garde-fou onboarding lit désormais **le même store** (plus de refetch direct divergent) et
   est aussi one-shot (`guardDoneRef`).

`auth/callback` conservé (filet 1er signup). `AudioContext.tsx` non touché.

### Pourquoi le loop est désormais impossible
Après skip : `mutateInterests` rend le store `interests` non-null **avant** la navigation →
l'effet AppShell calcule `needsOnboarding=false` → branche `else` (reset du ref), **aucune**
redirection. onboarding et AppShell lisent la même valeur non-null → plus de divergence.

**Fichiers** : `src/lib/hooks/useUser.ts`, `src/components/layout/AppShell.tsx`,
`src/app/(app)/onboarding/page.tsx`.

---

## 2. Tâche 2 — Feed « Pour vous »

### 2a. Zéro news — suppression du hop fragile
**Cause confirmée** : `/api/for-you` (PR2b) récupérait les news via
`fetch('/api/news/syntheses?...')` serveur→serveur. En reconstruisant l'origine depuis
`request.url`, ce hop HTTP interne est fragile (et inutile) → news souvent vides.

**Choix news : fonction serveur partagée (PAS de policy RLS) — justification**
Le brief conditionne la policy RLS à « aucune colonne sensible ». Or `news_syntheses` **expose
des colonnes internes** (`gdrive_*`, `llm_model`, `validation_errors/warnings`, `failed_attempts`,
`added_by`, `last_edited_by`, `embedding`, `raw_id`, `scored_id`). Une policy RLS est **row-level**
et ne sait **pas** restreindre les colonnes → `FOR SELECT TO authenticated` exposerait tout ce
contenu interne. → On retient donc la branche **fonction serveur partagée** du brief :
- `src/lib/news/forYouNews.ts` : `fetchForYouNews(categories)` lit un **sous-ensemble de colonnes
  sûres** (identiques à `/api/news/syntheses`, déjà exposées côté produit), via le client admin,
  importée **directement** par `/api/for-you` — **plus de hop HTTP, plus d'URL relative**.
- Lecture sur **tout le pool** : `status='active'` + `formation_category_match ∈ categories`
  (matchées) + un pool récent (fallback), au lieu des 50 plus récentes en PR2b.

> Le client SSR session reste la source des données **utilisateur/RLS** (auth, `interests`,
> formations/epp/quest/fiches). Les news sont du contenu **éditorial public** lu via un helper
> vérifié à colonnes sûres ; aucun accès service-role à des données utilisateur dans la route.

### 2b. Plafonds + réservation news (anti-flood)
Assemblage revu dans `/api/for-you` :
- **Plafond total ~12** (conformité incluse).
- **Sous-plafonds par type** : formations ≤ 4, fiches ≤ 4, epp ≤ 2, autoeval ≤ 1.
- **Scoring conservé** (catégorie 2 > axe 1) pour l'ordre **intra-type**.
- **Variété inter-types** : round-robin `[formation, fiche, autoeval, epp]` (1 de chaque par tour).
- **Réservation news (~5)** : on calcule le pédago plafonné, puis on insère **toujours** jusqu'à
  5 news (matchées d'abord, fallback news récentes si trop peu) — les news ne sont **jamais
  évincées**. Si peu de news, le pédago récupère les slots libérés.
- **Conformité** : 1 carte promo en fin (inchangé).

### Validation MCP de la composition (user de test, axes 3+4)
| Source | Matchés | Après sous-cap | Dans le feed |
|---|---|---|---|
| formations | 5 | 4 | **3** |
| epp | 0 | 0 | 0 |
| autoeval | 1 | 1 | **1** |
| fiches | **14** | 4 | **2** |
| news matchées | 15 | — | **5** (réservées) |
| conformité | — | — | 1 |
→ **12 cartes, variées** (3 formations + 2 fiches + 1 auto-éval + 5 news + conformité). Les 14
fiches ne noient plus le reste. Conforme aux critères du brief.

**Fichiers** : `src/lib/news/forYouNews.ts` (nouveau), `src/app/api/for-you/route.ts` (réécrit).

---

## 3. Protocole / vérifs
- `tsc --noEmit` : **0 erreur** dans les fichiers livrés (baseline implicit-any pré-existante hors
  périmètre).
- `next lint` (fichiers touchés) : **No ESLint warnings or errors**.
- `next build` : **succès complet** avec env présents (64/64 pages, `/api/for-you` route
  dynamique `ƒ`).
- MCP : `interests` test user, policies + colonnes `news_syntheses`, composition feed (cf. §1/§2).

### Points de smoke (à valider sur preview Vercel)
- (a) Skip → home **stable, sans loop**, **sans** section « Pour vous ».
- (b) Continuer → home stable, feed **varié plafonné ~12** (news présentes).
- (c) Login classique d'un user `interests NULL` → `/onboarding` **sans loop**.
- (d) Chrome (nav + audio) intact partout ailleurs.

---

## 4. Contraintes respectées
- React state uniquement (store module-level partagé ; **aucun** localStorage/sessionStorage).
- `/api/for-you` : données utilisateur via client SSR session (RLS) ; news via helper à colonnes
  sûres (pas d'ouverture RLS de la table, pas de hop HTTP relatif).
- `AudioContext.tsx` / `useSubmitSequenceResult` / middleware non touchés.
- Aucune couleur interdite (`#2D1B96` / `#00D1C1`).
- Aucune migration créée (branche fonction partagée choisie → pas de changement de schéma).

## Observations (hors périmètre)
- À terme, exposer proprement les news aux clients session via une **vue/RPC security-definer à
  colonnes sûres** (`status='active'`) permettrait de retirer aussi le client admin du chemin news
  — ticket dédié RLS/vue.
- `useUser` reste un type partiel divergent du `UserProfile` canonique (`types.ts`) — unification
  notée depuis PR1, toujours en attente.
