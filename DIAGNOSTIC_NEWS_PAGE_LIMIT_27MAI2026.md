# Diagnostic — Plafond 50 articles sur `/news` (Actualités scientifiques)

**Date** : 27 mai 2026
**Statut** : diagnostic + option B (pagination "Charger plus") retenue par Dr Fantin

## Résumé exécutif

La page `/news` affiche 50 articles maximum alors que la BDD contient
504 syntheses `active` (481 `scientifique`, 17 `pratique`, 6
`reglementaire`). Le plafond est **intentionnel et hardcodé**, pas un
bug RLS ni un problème de requête. Il est imposé à deux endroits
alignés (`FETCH_LIMIT = 50` côté page, `MAX_LIMIT = 50` côté API) et la
page ne possède **aucune mécanique de pagination** (ni bouton, ni
scroll infini, ni virtualisation). L'API supporte déjà un paramètre
`?page=` inutilisé et renvoie déjà `total` (count exact).

## Architecture de chargement

```
src/app/(app)/news/page.tsx  (client component)
        │  fetch(`/api/news/syntheses?limit=50`)
        ▼
src/app/api/news/syntheses/route.ts  (Node.js, force-dynamic)
        │  Supabase admin client (service_role, bypass RLS)
        │  SELECT ... FROM news_syntheses
        │    WHERE status = 'active' [AND specialite = ?]
        │    ORDER BY published_at DESC NULLS LAST
        │    .range(from, to)   // to = page*limit - 1
        ▼
PostgreSQL → 50 rows
```

Pas de hook custom, pas de SWR/React Query, pas de Server Component.
`useEffect([], ...)` tire une seule fois au mount du composant client.

## Localisation exacte du LIMIT 50

| Couche | Symbole | Fichier | Ligne |
|---|---|---|---|
| Page (client) | `const FETCH_LIMIT = 50` | `src/app/(app)/news/page.tsx` | 15 |
| Page (fetch)  | `fetch('/api/news/syntheses?limit=${FETCH_LIMIT}')` | `src/app/(app)/news/page.tsx` | 41 |
| API (server)  | `const MAX_LIMIT = 50`   | `src/app/api/news/syntheses/route.ts` | 9 |
| API (clamp)   | `Math.min(limitRaw, MAX_LIMIT)` | `src/app/api/news/syntheses/route.ts` | 41 |
| Supabase      | `.range(from, to)` (to=49 si page=1) | `src/app/api/news/syntheses/route.ts` | 64 |

Le clamp `Math.min` rend le plafond **dur côté serveur** : même un
appel `curl /api/news/syntheses?limit=500` retourne 50 rows max.

## État de la pagination

**Absente** (pas cassée — jamais implémentée côté front).

- Aucun `useState` pour `page` / `offset` / `cursor` / `hasMore` sur la
  page.
- Aucun bouton "Charger plus" dans le JSX (seulement la barre de
  filtres specialités et le bouton playlist).
- Aucun `IntersectionObserver`, pas de scroll infini.
- Pas de virtualisation (`react-window` / `react-virtualized` non
  importés).

**Côté API par contre, la mécanique existe déjà** : `route.ts` lit
`?page=` (ligne 31), calcule `from/to` (lignes 59-60), retourne
`{ data, total, page }` avec `count: 'exact'`. Il n'y a plus qu'à la
consommer.

## Origine du chiffre 50

Constante magique non documentée, alignée des deux côtés. Pas d'env
var, pas de feature flag, pas de logique métier "top 50 récents". Très
probablement un choix produit initial fait quand le volume de
syntheses était bas (~quelques dizaines), jamais revisité depuis que
l'extracteur scientifique a poussé le catalogue à 504.

Le label "▶ Écouter la playlist (50 articles)" (page.tsx:163) est
calculé depuis `filteredNews.length`. Il **suit** le plafond, il ne le
crée pas — c'est le symptôme, pas la cause.

## RLS — pas en cause

`supabase/migrations/20260423_news_schema.sql` active RLS sur
`news_syntheses` avec une **unique policy** `service_role full access`.
L'API route utilise `createAdminClient()` (service_role key) qui bypass
intégralement la RLS. Les 504 rows sont visibles. Le filtre côté
requête est uniquement `.eq('status', 'active')`, pas un filtre
identitaire.

→ La RLS n'est pas le blocage. Le seul blocage est `MAX_LIMIT = 50`.

## Options évaluées

### Option A — Retirer le LIMIT (charger tout d'un coup)

Augmenter `MAX_LIMIT` à 1000 (ou supprimer le clamp) et faire la même
chose côté page.

- **+** Plus simple, 1 commit, ~4 lignes touchées.
- **+** Aucun changement UX, pas de bouton à designer.
- **−** Payload réseau : 481 rows × ~1-2 KB chacune ≈ 500 KB-1 MB de
  JSON sur la première visite. Lourd sur 4G mobile.
- **−** Rendu DOM : 481 `NewsCardItem` montés en simultané.
- **−** Scaling : à 1000+ articles dans 6 mois, il faudra refaire.

### Option B — Pagination explicite (bouton "Charger plus") ✅ RETENUE

Garder `MAX_LIMIT = 50`, ajouter sur la page :
- state `page` (useState),
- state `total` (depuis le payload de l'API),
- bouton "Charger plus" sous la grille,
- refetch `?page=${page+1}` en concat dans `items`.

- **+** Mécanique server **déjà prête** (l'API renvoie déjà `total`,
  `page`).
- **+** Performant : 50 rows par batch, payload prévisible.
- **+** UX classique, attendue.
- **−** ~30-50 lignes de code à ajouter sur la page.
- **−** Friction utilisateur (un clic par tranche de 50).

### Option C — Scroll infini (IntersectionObserver)

Comme B, mais déclenchement automatique.

- **+** UX moderne, pas de clic.
- **−** Plus complexe (gestion observer + cleanup + race conditions).
- **−** Casse l'accès direct au footer (anti-pattern accessibilité).
- **−** Difficile à tester E2E.

### Option D — Virtualisation `react-window`

Charger tout d'un coup mais ne monter que ~10 cards dans le DOM.

- **+** Premier paint léger.
- **−** Ajoute une dépendance.
- **−** Suppose hauteur fixe par item (cards news = hauteurs variables).
- **−** Bouton "Écouter la playlist" inutilisable (481 audios séquentiels).

## Décision Dr Fantin

**Option B retenue.** Paramètres :

- `MAX_LIMIT` serveur : 50 (inchangé)
- `FETCH_LIMIT` page : 50 (inchangé)
- Pagination : page=1 au mount, +1 par clic sur "Charger plus"
- Bouton masqué quand `items.length >= total`
- Refetch concat (pas de remplacement)
- Conservation du filtre spécialité actuel (client-side, lens sur items)
- Label playlist reflète `items.length` (tranche chargée), pas `total`
- Sous-titre header affiche "X sur Y articles"

Implémentation : branche `claude/news-page-pagination-27mai2026`,
modif unique sur `src/app/(app)/news/page.tsx` (pas de modif API,
déjà prête).

## Vérification post-fix

1. `curl http://localhost:3000/api/news/syntheses?limit=50&page=1` →
   doit renvoyer `{ data: [50 items], total: 504, page: 1 }`.
2. `curl ...?limit=50&page=10` → tranche 451-500 (≈ 50 items).
3. Sur `/news` en localhost : 50 cards au chargement initial, clic
   "Charger plus" → 100, puis 150… disparition du bouton à 504.
4. Test manuel 10 clics consécutifs sans erreur / sans duplicat.
5. Filtrer par spécialité (`Pédodontie` par ex.) et vérifier que le
   count playlist reflète le total filtré dans la tranche chargée.
