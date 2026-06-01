# RECAP — PR2a : Onboarding questionnaire d'intérêts (« Pour vous »)

**Date** : 2026-06-01
**Branche** : `claude/nifty-cray-BD8Xa`
**Périmètre** : UI onboarding + écriture `user_profiles.interests` + gating post-login.
**Pas de feed, pas de section home** (réservés à la PR2b).
**Projet Supabase** : `dxybsuhfkwuemapqrvgz`

---

## 1. Vérification de prémisse (avant écriture)

| Vérif | Résultat |
|---|---|
| `git diff origin/main..HEAD` | Working tree propre, aucun commit en avance. |
| Colonne `user_profiles.interests` (PR1) | **Présente**, `jsonb`, nullable, `default NULL`. |
| Nouveaux profils à `NULL` | **3/3** profils existants ont `interests IS NULL`. |
| RLS UPDATE self | Policy `Users can update own profile` (`auth.uid() = id`) présente → couvre l'écriture. |
| Clients Supabase | `client.ts` (browser) et `server.ts` utilisent l'**anon key** (session-utilisateur) — jamais service role. |
| Emplacement bottom nav | Rendue dans `src/app/(app)/layout.tsx` (avec `PWAInstallBanner`, `MiniPlayer`, `AudioQueuePlayer`). |

---

## 2. Fichiers livrés

### Nouveaux
- `src/app/(app)/onboarding/page.tsx` — écran questionnaire (client component).
- `src/app/(app)/onboarding/layout.tsx` — conteneur plein écran du segment.
- `src/components/layout/AppShell.tsx` — shell client qui **neutralise** le chrome
  (bottom nav + banners audio/PWA) sur le segment `/onboarding`.
- `src/lib/hooks/useSaveInterests.ts` — hook d'écriture via client session-utilisateur.

### Modifiés
- `src/app/(app)/layout.tsx` — délègue le chrome à `<AppShell>` (les flags RBAC
  calculés côté serveur restent passés en props).
- `src/app/auth/callback/route.ts` — gating : `interests IS NULL` → `/onboarding`,
  sinon `next ?? '/'`.
- `src/lib/hooks/useUser.ts` — expose `interests` en lecture (type partiel local ;
  unification complète notée pour plus tard, cf. §6).

---

## 3. Décisions d'architecture

### Neutralisation de la bottom nav
En App Router, un layout imbriqué **ne peut pas retirer** le chrome d'un layout
parent. La nav vivant dans `(app)/layout.tsx`, elle est neutralisée via un shell
client `<AppShell>` qui lit `usePathname()` : sur `/onboarding`, il rend les enfants
plein écran (sans `pb-24`, sans `BottomNav`, sans `MiniPlayer`/`AudioQueuePlayer`/
`PWAInstallBanner`). Les providers audio restent montés (contexte préservé). Le
`onboarding/layout.tsx` fournit en plus un conteneur `min-h-screen` focalisé.

### Mapping des chips (conforme spec §1)
- **Cliniques (9)** → slug poussé dans `categories[]` : `esthetique`, `restauratrice`,
  `chirurgie`, `implant`, `prothese`, `parodontologie`, `endodontie`, `radiologie`,
  `numerique`. Libellés/emoji/couleurs via `getCategoryConfig`.
- **Gestion de cabinet (3)** → slug dans `categories[]` : `management`, `organisation`,
  `soft-skills`. Idem `getCategoryConfig`.
- **Parcours CP (2 chips d'axe)** → entier poussé dans `axes[]` :
  `Relation patient` → **3** (couleur canonique `#D97706`),
  `Santé du praticien` → **4** (couleur canonique `#EC4899`).
- Couleurs interdites `#2D1B96` / `#00D1C1` **non introduites**.

### Gating centralisé dans `auth/callback`
Conforme à la décision « middleware = refresh de session uniquement ». Le middleware
n'est **pas** touché. Après `exchangeCodeForSession`, lecture de `interests` :
`NULL` (ou profil absent) → `/onboarding`, sinon `next ?? '/'`.

### Garde-fou re-entrée
`onboarding/page.tsx` lit `interests` au montage : si déjà non-NULL → `router.replace('/')`.

### Écriture
- **Continuer** → `update user_profiles set interests = { categories, axes }` (même partiel/vide).
- **Je choisirai plus tard** → écrit `{"categories":[],"axes":[]}` (NULL→non-NULL = vu).
- Les deux cas → `router.push('/')`.
- Sélection en **React `useState` uniquement** (jamais localStorage/sessionStorage).
- 0 sélection autorisé (CTA non bloquant).

---

## 4. Protocole sécurité

| Étape | Résultat |
|---|---|
| `npx tsc --noEmit` | Fichiers livrés **0 erreur**. Les 38 erreurs `src/` restantes sont du baseline pré-existant (mêmes fichiers sur `main`, ex. `useUser:73` `onAuthStateChange` identique). |
| `npx next lint` (fichiers livrés) | **0 erreur**, 0 warning. Seul warning du run : `useUser:83` pré-existant (code non modifié). |
| `npx next build` | **✓ Compiled successfully**, 64/64 pages générées. `/onboarding` = route dynamique `ƒ` (3.82 kB). |
| Vérif MCP Supabase | Voir §5 (smoke). |

---

## 5. Smoke live (MCP Supabase)

Un parcours navigateur complet n'étant pas exécutable dans le conteneur, l'écriture
exacte de l'app a été rejouée sur une vraie ligne puis l'état NULL d'origine restauré
(les 3 lignes étaient NULL → aucun impact de données).

| Cas | Payload écrit | Lecture | OK |
|---|---|---|---|
| Continuer (partiel) | `{"categories":["esthetique","implant","management"],"axes":[3,4]}` | `cat_type=array`, `axes_type=array`, `axes=[3,4]` | ✓ |
| Skip | `{"categories":[],"axes":[]}` | `is_seen=true` (non-NULL → pas de re-entrée onboarding) | ✓ |
| Restauration | `NULL` | `total=3`, `null_interests=3` | ✓ |

---

## 6. Observations / dette

- **Unification `UserProfile`** : `useUser.ts` conserve un type partiel divergent du
  `UserProfile` canonique de `types.ts`. Unification complète **non forcée** (risque de
  ripple sur 4 consommateurs) ; `interests` exposé a minima en lecture. À planifier.

---

## 7. Suite (PR2b — non implémenté ici)

`GET /api/for-you` (agrégation + scoring + mix anti-noyade), composant `ForYouCard`,
section « Pour vous » sur la home, carte conformité en promo.
