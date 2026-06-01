# RECAP — Audit Phase 0 « Pour vous » (lecture seule)

**Date** : 2026-06-01
**Branche** : `claude/friendly-ritchie-2uvhK` (en phase avec `origin/main`, 0 commit d'écart)
**Périmètre** : audit **strictement en lecture seule**. Aucune écriture DB, aucune
migration, aucune modif de code, aucun commit. Les correctifs tentants sont notés, jamais appliqués.
**Projet Supabase** : `dxybsuhfkwuemapqrvgz`

---

## 1. Catégories réelles + volume

### 1a. CHECK `formations_category_check` — **27 valeurs** (hypothèse mémoire « ~28 » → corrigée à 27)

| Axe | Slugs |
|---|---|
| Clinique (axe 1/2) | `esthetique`, `restauratrice`, `chirurgie`, `implant`, `prothese`, `parodontologie`, `endodontie`, `radiologie`, `numerique` (9) |
| Relation patient (axe 3) | `communication`, `consentement`, `conflits`, `decision-partagee`, `annonce-diagnostic`, `education-therapeutique`, `ethique-deontologie`, `numerique-relation`, `relation-patient` (9) |
| Santé praticien (axe 4) | `ergonomie`, `stress-burnout`, `risques-pro`, `violences`, `pratique-reflexive`, `sante-praticien` (6) |
| Hors CP (bonus) | `management`, `organisation`, `soft-skills` (3) |

Autres CHECK sur `formations` : `access_type ∈ {demo, full}` ; `axe_cp` NULL ou 1–4.

> ⚠️ Les deux slugs « génériques » `relation-patient` et `sante-praticien` existent dans le CHECK mais **n'ont pas de chip dédiée** dans `CATEGORY_CONFIG` (voir §5). À garder en tête pour le mapping chips ↔ catégories.

### 1b. Volume de contenu **publié** par axe/catégorie (`is_published = true`)

| axe_cp | category | nb |
|---|---|---|
| 1 | esthetique | 2 |
| 1 | numerique | 1 |
| 1 | restauratrice | 1 |
| 3 | communication | 1 |
| (null) | soft-skills | 2 |

**Total publié = 7 formations.** Le contenu publié est **très clairsemé** : aucune
catégorie n'atteint un volume « confortable » pour une chip, axes 2 et 4 sont à **0**
publié. Conséquence produit majeure : un carrousel « Pour vous » filtré sur les
préférences déclarées **risque de renvoyer 0–2 cartes** pour la plupart des intérêts.
→ La liste des chips doit être pilotée par la **taxonomie** (les 27 catégories / 4 axes),
pas par le volume actuel ; prévoir un fallback explicite « pas encore de contenu sur cet
intérêt » côté UI.

---

## 2. Préférences existantes + table profil

### 1c. Table de préférences / intérêts / onboarding
Aucune table d'intérêts/onboarding. Seul résultat : **`user_notification_preferences`**
(sans rapport avec la personnalisation de contenu).
→ **Rien à réutiliser** pour stocker des intérêts déclarés : il faudra créer une table
dédiée ou une colonne (décision Phase 1, voir §8).

### 1d. Tables de profil
- **`profiles`** : `id (uuid)`, `email`, `full_name`, `role`, `created_at`, `updated_at`. Clé user = **`id`**.
- **`user_profiles`** : `id (uuid)`, `first_name`, `last_name`, `profile_photo_url`, `city`, `practice_type`, `years_experience`, `ordre_inscription_date`, `deletion_requested_at`, `rpps`, `profession`, timestamps. Clé user = **`id`**.
- `users` : table non présente dans `public` (auth gérée par `auth.users`).

> **Aucune colonne JSONB existante** dans `profiles` ni `user_profiles` → pas de champ
> JSONB « fourre-tout » réutilisable. Clé user homogène = `id` (= `auth.users.id`).

---

## 3. Avancement CP par axe — **source TROUVÉE en base**

L'avancement CP par axe **est bien calculé côté Supabase** (plusieurs sources) :

- **Table de référence** `cp_axes` (4 lignes) : `id` 1→4, `code` (`knowledge`,
  `quality`, `patient`, `health`), `name`, `short_name`, `color`, `required_actions` (=2 chacun), `icon`, `display_order`.
- **RPC** `get_user_cp_progress(p_user_id uuid) → json` : renvoie `{axe1..axe4}` =
  COUNT(DISTINCT formations complétées) par `axe_cp`, à partir de
  `user_formations.completed_at IS NOT NULL`.
- **Vue** `cp_user_progress` : par (user × axe) → `actions_completed`, `required_actions`,
  `total_hours`, `axe_validated`, `progress_percent`. Source = `cp_actions` +
  `cp_user_settings` × `cp_axes`. **Plus riche** que la RPC (notion d'« actions »,
  pas seulement de formations).
- **Vue** `cp_user_summary` : agrégat global (total actions, axes validés /4,
  `global_progress_percent`, `cp_complete`).
- Trigger `sync_formation_to_cp_action` : alimente `cp_actions` depuis les formations.

> ⚠️ **Deux notions d'avancement coexistent** : la RPC `get_user_cp_progress` compte des
> *formations complétées* par `axe_cp` ; les vues `cp_user_*` comptent des *cp_actions*
> (modèle DPC plus large). À trancher en Phase 1 : laquelle alimente le croisement.

### Verdict — croisement CP faisable en V1 : **OUI**
La donnée d'avancement par axe existe et est requêtable (RPC `json` ou vue). Le croisement
« intérêts déclarés × avancement CP réel » est techniquement réalisable dès la V1.
**Réserve produit** : avec seulement 7 formations publiées (et 0 sur axes 2/4), le signal
de croisement sera faible en pratique tant que le catalogue n'est pas étoffé. Un V1
déclaratif d'abord, croisement CP en surcouche, reste l'option la moins risquée.

---

## 4. News — tagging pour le carrousel personnalisé (1f)

`news_syntheses` confirmé. Champs pertinents :

| Champ | Type | Note |
|---|---|---|
| `specialite` | `text` | **scalaire** (1 seule spé par synthèse), PAS `spe`. 12 valeurs (cf. `NEWS_SPECIALITES`). |
| `themes` | `text[]` (ARRAY) | multi-valeurs. |
| `formation_category_match` | `text` | pont vers les 27 catégories formation (1 valeur). |
| `category_editorial` | `text` | scientifique / pratique / réglementaire / humour. |
| `keywords_libres` | `text[]` | mots-clés libres. |
| `embedding` | `vector` | ivfflat (reco sémantique possible plus tard). |
| `status` | `text` | filtre `= 'active'` obligatoire. |
| `published_at` | `date` | tri carrousel. |

**Index** :
- `news_syntheses_themes_idx` → **GIN sur `themes`** ✅ (filtre array performant).
- `news_syntheses_spe_idx` → **btree sur `specialite`** ✅ (nommé « spe » mais sur la colonne `specialite`).
- `news_syntheses_formation_match_idx`, `_category_editorial_idx`, `_embedding_idx` (ivfflat), `_fulltext_idx` (GIN tsvector FR).

> **Écart de nommage à acter** : le brief parle de `spe` ; la colonne réelle est
> **`specialite`** (l'index s'appelle `news_syntheses_spe_idx` mais porte sur `specialite`).
> Un filtre perso peut croiser `specialite` (égalité) **et/ou** `themes` (overlap `&&`,
> couvert par le GIN). `formation_category_match` est le meilleur pont sémantique vers les
> chips « catégories cliniques ».

---

## 5. Home — sections actuelles, carousel réutilisable, point d'insertion

Fichier : **`src/app/(app)/page.tsx`** (client component).

Ordre des sections dans `<main>` :
1. **Quiz du jour + Journal hebdo + Événements** (3 cartes carrées).
2. **📰 Actualités** — carrousel News. Source = `fetch('/api/news/syntheses?limit=5')`
   (PAS le hook `useNews`, voir §7). Rendu via `NewsCardItem` (`variant="carousel"`) + carte « Voir toutes les actus ».
3. **⚡ Fraîchement arrivé** — 5 dernières formations publiées (`FormationCardOverlay`).
4. **🔍 Explorer** — 3 sous-carrousels de catégories (Pratiques cliniques / Relation Patient / Santé Praticien).

**Composant carousel réutilisable** :
- `CategoryCarousel` (défini *inline* dans `page.tsx`, l.182–268) pour les chips catégories.
- Le carrousel News n'a pas de composant dédié : c'est un `flex overflow-x-auto` inline + `NewsCardItem`.
- Pas de composant `Carousel` générique partagé dans `src/components`.

**Source des chips** : `CATEGORIES` / `getCategoryConfig` exportés depuis
**`src/lib/supabase/types.ts`** (`CATEGORY_CONFIG`, l.~300–527) — **pas** depuis
`src/lib/constants/axis.ts`. Découpage par champ `type` :
`cp` (clinique, axe 1/2) · `axe3` · `axe4` · `bonus` (management/organisation/soft-skills).

**Point d'insertion « Pour vous »** : nouvelle `<section>` **en tête de `<main>`**, juste
avant la section Quiz/Journal/Événements (l.~316), ou juste après le header. Elle pourrait
réutiliser `FormationCardOverlay` (formations) et/ou `NewsCardItem` (news) selon le design.

---

## 6. Onboarding — fichiers du parcours signup + point d'insertion questionnaire

**Il n'existe AUCUN écran d'onboarding / questionnaire post-inscription** (recherche
`*onboard*` = 0 fichier).

Parcours signup actuel :
1. `src/app/register/page.tsx` — formulaire (identité, email, MDP, RPPS optionnel,
   mode `praticien_solo` / `titulaire_cabinet`, consentement RGPD). À la soumission :
   `supabase.auth.signUp(...)` (métadonnées : `first_name`, `last_name`, `rpps`), puis
   éventuel `POST /api/auth/create-cabinet`, puis `router.push('/verify-email')`.
2. `src/components/auth/SiretCabinetForm.tsx` (+ `POST /api/auth/sirene-search`, `POST /api/auth/create-cabinet`).
3. `src/app/verify-email/page.tsx` + `src/app/verify-email/confirm/page.tsx` — confirmation email.
4. `src/app/auth/callback/route.ts` — `exchangeCodeForSession`, puis **redirect vers `next ?? '/'`** (la home). Aucune étape intermédiaire.
5. `src/middleware.ts` — guards d'auth (à lire en Phase 1 pour brancher une éventuelle redirection « onboarding non complété »).

**Points d'insertion possibles du questionnaire** (à trancher Phase 1) :
- (a) **Nouvelle route dédiée** `/(app)/onboarding` + redirection depuis `auth/callback`
  (`next=/onboarding`) ou depuis le middleware tant que les intérêts ne sont pas renseignés.
- (b) **Modal/encart sur la home** au premier login (moins intrusif, pas de guard).
- Le trigger `handle_new_user` (mentionné dans `register/page.tsx`) crée déjà la ligne
  `user_profiles` — c'est le point naturel pour initialiser d'éventuelles préférences vides.

---

## 7. Écarts mémoire ↔ code

1. **CHECK catégories = 27 valeurs** (pas ~28). Hypothèse mémoire à corriger.
2. **Source des chips = `src/lib/supabase/types.ts`** (`CATEGORY_CONFIG`/`CATEGORIES`),
   **pas** `src/lib/constants/axis.ts`. Ce dernier ne contient que des mappings
   icône/couleur par axe (`axisIcons`, `axisColors`, `axisBgColors`).
3. **News colonne = `specialite`** (text scalaire), **pas `spe`** (seul l'index porte ce nom).
4. **Le carrousel News de la home n'utilise PAS `useNews`** : il appelle
   `GET /api/news/syntheses`. Le hook `useNews` (`src/lib/hooks/useNews.ts`) cible une table
   **legacy `news_articles`** (≠ `news_syntheses`) — vraisemblablement du code mort sur la
   home actuelle. (Noté, **non corrigé**.)
5. **Aucun onboarding existant** : à construire intégralement.
6. **Aucune colonne JSONB** sur `profiles`/`user_profiles` (pas de réceptacle prêt).

### Correctifs tentants repérés — **NON appliqués** (lecture seule)
- `cp_axes.color` stocke `#2D1B96` (axe 1) et `#00D1C1` (axe 2), et `src/lib/constants/axis.ts`
  contient `#00D1C1` (axe 2) — **couleurs interdites** par le design system (cf. CLAUDE.md).
  Données/fichier existants, hors périmètre de cette phase → **noté seulement**.
- Hook `useNews` pointant sur la table legacy `news_articles` → candidat suppression de code
  mort, à valider (non touché).

---

## 8. Recommandations Phase 1 (décisions produit)

### Chips à retenir
- **Piloter la liste par la taxonomie** (4 axes / 27 catégories de `CATEGORY_CONFIG`), pas
  par le volume publié actuel (7 formations, axes 2/4 à zéro).
- Pour les **axes CP** : proposer les 4 axes (`cp_axes`) comme intérêts macro + les
  catégories cliniques comme intérêts fins.
- Prévoir le mapping des 2 slugs génériques (`relation-patient`, `sante-praticien`) qui
  n'ont pas de chip — soit les exclure du questionnaire, soit leur créer une chip.
- Côté News, mapper les chips d'intérêt sur `specialite` + `themes` (GIN dispo) et/ou
  `formation_category_match`.

### V1 déclaratif vs V1.5 croisement CP
- **V1 = déclaratif** : section « Pour vous » + carrousel News filtrés sur les seuls
  intérêts déclarés. Robuste, indépendant du faible volume CP. **Recommandé pour démarrer.**
- **V1.5 = croisement CP** : techniquement faisable dès maintenant (RPC `get_user_cp_progress`
  ou vue `cp_user_progress`), mais à n'activer qu'une fois le catalogue étoffé pour que le
  signal soit pertinent. Trancher quelle source d'avancement (formations vs cp_actions).

### Table dédiée vs colonne JSONB
- Aucun JSONB réutilisable aujourd'hui. Deux options (toute migration devra être demandée
  **nominativement** dans un prompt ultérieur — cf. CLAUDE.md) :
  - **Colonne JSONB** `user_profiles.interests` (simple, 1 ligne/user déjà garantie par
    `handle_new_user`, pas de jointure ; index GIN possible). Faible coût.
  - **Table dédiée** `user_interests(user_id, category|axe, created_at)` (normalisé,
    requêtes/analytics plus propres, RLS dédiée). Plus coûteux mais plus extensible.
  - **Reco** : commencer par **JSONB sur `user_profiles`** pour la V1 déclarative ;
    migrer vers une table dédiée seulement si des besoins analytics/multi-valeurs riches
    émergent.

### Insertion technique
- **Questionnaire** : route `/(app)/onboarding` + redirection via `auth/callback`
  (`next`) ou middleware tant que les intérêts sont vides (état en DB, **pas** de
  localStorage — rappel contrainte).
- **Home** : nouvelle `<section>` « Pour vous » en tête de `<main>` dans
  `src/app/(app)/page.tsx`, réutilisant `FormationCardOverlay` / `NewsCardItem`.
- **News perso** : étendre `GET /api/news/syntheses` (déjà prêt à filtrer `specialite`)
  pour accepter un set d'intérêts (specialite + themes overlap).

---

## Observations (hors périmètre, non implémenté)
- Code mort probable : hook `useNews` → table legacy `news_articles` non utilisée par la home.
- Couleurs interdites (`#2D1B96`, `#00D1C1`) présentes dans `cp_axes.color` et
  `src/lib/constants/axis.ts` (axe 2). À traiter dans un ticket dédié design system.
- Deux définitions d'« avancement CP » (formations vs cp_actions) à réconcilier avant le
  croisement V1.5.
