# RECAP — Audit Phase 0-bis : types de contenu du feed « Pour vous » (lecture seule)

**Date** : 2026-06-01
**Branche** : `claude/friendly-ritchie-2uvhK`
**Périmètre** : complète la Phase 0 (formations + news déjà couverts). Couvre **EPP,
auto-évaluation, fiches (bibliothèque), conformité** + volume consolidé.
**Lecture seule absolue** : aucune écriture DB, migration, modif code, commit. `autoeval_completions`
non lue (comptage de structure uniquement). Correctifs tentants notés en fin, jamais appliqués.
**Projet Supabase** : `dxybsuhfkwuemapqrvgz`

---

## 1. Schémas + tag de matching + filtre de publication

### 1.1 EPP — `epp_audits` (axe 2)

| Colonne | Type | Null |
|---|---|---|
| id | uuid | NO |
| title | text | NO |
| slug | text | NO |
| description | text | YES |
| formation_id | uuid | YES |
| nb_dossiers_min / _max | integer | NO |
| delai_t2_mois_min / _max | integer | NO |
| **is_published** | boolean | NO |
| **theme_slug** | text | YES |
| inclusion_criteria / exclusion_criteria | jsonb | YES |
| duree_forfaitaire_heures | numeric | YES |
| duree_breakdown | jsonb | YES |

- **Filtre de publication** : `is_published = true` ✅.
- **Tag de matching** : `theme_slug` → correspond bien à un `formations.category`
  (le seul audit a `theme_slug = 'restauratrice'`, slug valide du CHECK formations). ✅ Pont vers les chips cliniques OK.
- **Volume exploitable** : **1 audit publié** (`audit-onlays-overlays-felures`, 8 critères via `epp_criteria`).

### 1.2 Auto-évaluation — `questionnaires` (axe 4)

| Colonne | Type | Null |
|---|---|---|
| id | uuid | NO |
| **slug** | text | NO |
| titre | text | NO |
| description | text | YES |
| **axe_cp** | smallint | YES |
| **actif** | boolean | NO |
| intro_text | text | YES |
| time_estimate_min | integer | YES |
| created_at / updated_at | timestamptz | NO |

- **Filtre du feed** : `actif = true` ✅.
- **Tag de matching** : `axe_cp` (=4). ✅
- **Volume** : **1 questionnaire actif** (`sante-axe4`, axe_cp=4, 20 min).

### 1.3 Fiches — `bibliotheque_ressources`

| Colonne | Type | Null |
|---|---|---|
| id | uuid | NO |
| **axe** | smallint | NO |
| titre | text | NO |
| source | text | NO |
| description | text | YES |
| **type** | text | NO (`internal` / `external`) |
| **url** | text | NO |
| storage_path | text | YES |
| **categorie** | text | YES |
| ordre | integer | NO |
| created_at / updated_at | timestamptz | NO |

- **Pas de colonne de publication** : toutes les lignes sont « live » (pas de `is_published`/`actif`).
- **Tag de matching** : `axe` (smallint) ; `categorie` est **du texte libre éditorial**
  (« Information patient », « Consentements », « Fiches pratiques »…) → **PAS** un slug
  `formations.category`. Aucun mapping `categorie` → `formations.category` exploitable :
  le matching fiches se fait **par axe uniquement**.
- **Volume** : **12 ressources**.

| axe | categorie | type | nb |
|---|---|---|---|
| 3 | Information patient | internal | 3 |
| 3 | Consentements | external | 2 |
| 3 | Conseils post-opératoires | external | 1 |
| 3 | Référence | external | 1 |
| 4 | Fiches pratiques | internal | 5 |

→ Fiches présentes **uniquement sur axes 3 (7) et 4 (5)** ; rien sur axes 1 et 2.

---

## 2. Conformité — ⚠️ écart majeur vs hypothèse du brief

### 2.1 Côté code : confirmé « en dur »
`src/app/(app)/conformite/page.tsx` : `CONFORMITE_CATEGORIES` est un tableau **hardcodé**
(7 catégories / **52 items** : 12+8+6+5+9+7+5) avec `itemsDone: 0` statiques. Le commentaire
ligne 12 dit littéralement `// Catégories conformité — sera remplacé par Supabase`. La page
**ne lit aucune table**.

### 2.2 Côté DB : un schéma de tracking **EXISTE** (contrairement à l'hypothèse « probable: non »)
Tables trouvées : **`cabinet_compliance_categories`**, **`cabinet_compliance_items`**,
**`user_cabinet_compliance`**.

| Table | Colonnes clés | Lignes |
|---|---|---|
| `cabinet_compliance_categories` | code, name, description, icon, color, display_order | **6** |
| `cabinet_compliance_items` | category_id, code, title, frequency, is_mandatory, reference_text, help_url, display_order | **13** |
| `user_cabinet_compliance` | user_id, item_id, **status**, last_check_date, next_check_date, expiry_date, proof_url, notes | **0** |

### Verdict « progression conformité réelle disponible » : **NON (en pratique)**
Le schéma existe mais :
1. il **n'est pas câblé** à la page (`conformite/page.tsx` reste 100 % hardcodé) ;
2. il est **sous-seedé / désaligné** : **6 catégories / 13 items** en base vs **7 / 52** en dur ;
3. `user_cabinet_compliance` est **vide (0 ligne)** → aucun utilisateur ne suit de progression.

→ La carte nudge « Pour vous » ne pourra afficher qu'un **0/52 statique** en V1 (ou 0/13 si
on branche les tables réelles). Brancher une vraie progression nécessiterait d'abord de
réconcilier le seed (13 vs 52) **et** de câbler la page — hors périmètre, **noté seulement**.

---

## 3. Routes de destination + composants carte réutilisables

| Type | Route au clic | Source/filtre | Composant carte |
|---|---|---|---|
| Formation | `/formation/{category}?formation={slug}&from=…` | `formations` (`is_published`) | **`FormationCardOverlay`** |
| EPP | **`/formation/{theme_slug}/epp`** | `epp_audits` (`is_published`) | (pas de carte dédiée — lien thème) |
| Auto-éval | **`/sante/auto-evaluation`** (rend `AutoEvalFlow`) | `questionnaires` (`actif`) | (pas de carte dédiée) |
| Fiches | **`/{formation,patient,sante}/bibliotheque`** (axe 1/3/4) ; rend `BibliothequeView` | `getRessourcesByAxe(axe)` | `RessourceCard` (interne à `BibliothequeView`) + `BibliothequeBanner` |
| News | `/news` (liste) + `NewsModal` (détail in-page sur la home) | `/api/news/syntheses` (`status='active'`) | **`NewsCardItem`** (`variant="carousel"`) |
| Conformité | `/conformite` | hardcodé | cartes inline (non extraites) |

**Composants carte réutilisables existants** : `FormationCardOverlay`, `NewsCardItem`,
`RessourceCard` (non exporté, inline dans `BibliothequeView`). **Aucune carte générique
multi-types** n'existe.
→ Pour un feed unifié : créer un **`ForYouCard` générique** piloté par un champ `type`,
réutilisant visuellement `FormationCardOverlay` (formations) et `NewsCardItem` (news), et
gérant les types sans carte propre (EPP, auto-éval, conformité) via un rendu maison.

---

## 4. Tableau volume consolidé par axe × type

| Axe | Formations publiées | EPP publiés | Quest. actifs | Fiches | News actives |
|---|---|---|---|---|---|
| **1 — Clinique** | **4** (esthétique 2, numérique 1, restauratrice 1) | 0 | 0 | 0 | (pool global) |
| **2 — EPP / Qualité** | **0** | **1** (restauratrice) + conformité (13 items, non câblés) | 0 | 0 | (pool global) |
| **3 — Relation patient** | **1** (communication) | 0 | 0 | **7** | (pool global) |
| **4 — Santé praticien** | **0** | 0 | **1** (sante-axe4) | **5** | (pool global) |
| Hors CP | 2 (soft-skills, axe_cp null) | — | — | — | — |
| **News (transverse)** | — | — | — | — | **504 actives** (matching `specialite` / `themes` / `formation_category_match`, pas par axe CP) |

**Validation remplissage axes 2 et 4** (vides en formations) :
- **Axe 2** : couvert par **1 EPP** + le module **conformité** (13 items en base, 52 en dur,
  mais non câblé). Reste **mince**.
- **Axe 4** : couvert par **1 auto-éval actif** + **5 fiches**. Suffisant pour amorcer une carte par axe.
- Les **504 news actives** constituent le réservoir transverse qui garantit qu'un feed
  « Pour vous » a toujours de quoi se remplir, quel que soit l'axe d'intérêt.

> Le feed unifié est **faisable** mais le contenu « pédagogique » (hors news) est très
> clairsemé (7 formations + 1 EPP + 1 quest + 12 fiches = 21 items, axe 2 quasi vide). Les
> news portent le volume. Un feed « Pour vous » V1 devra **mixer news + items pédagogiques**
> et tolérer des axes faiblement pourvus.

---

## 5. Recommandation — forme normalisée d'un « feed item » + route d'agrégation

### Forme normalisée (déduite des schémas réels)
```ts
type ForYouItem = {
  id: string
  type: 'formation' | 'epp' | 'autoeval' | 'fiche' | 'news' | 'conformite'
  title: string                    // formations.title | epp.title | questionnaires.titre | biblio.titre | news.display_title
  href: string                     // cf. tableau §3
  axe: 1 | 2 | 3 | 4 | null        // formations.axe_cp | epp=2 | questionnaires.axe_cp | biblio.axe | news=null
  category: string | null          // formations.category | epp.theme_slug | biblio.categorie(texte) | news.formation_category_match
  specialite?: string | null       // news uniquement
  themes?: string[]                // news uniquement
  cover?: string | null            // formations cover | news.cover_image_url
  estMinutes?: number | null       // questionnaires.time_estimate_min, etc.
  publishedAt?: string | null      // tri/fraîcheur (news.published_at, formations.created_at)
}
```
Champs communs solides : `id`, `type`, `title`, `href`, `axe`, `category`, `publishedAt`.
Les autres (`specialite`, `themes`, `cover`, `estMinutes`) sont spécifiques et optionnels.

### Faisabilité `GET /api/for-you`
**Faisable** : agréger 5 sources en parallèle (`Promise.all`) avec filtres déjà existants
(`is_published` / `actif` / `status='active'`), normaliser vers `ForYouItem`, puis trier/mixer
selon les intérêts déclarés (Phase 1) + éventuel croisement CP (Phase 0 §3).
- News : réutiliser la logique de `GET /api/news/syntheses` (filtre `specialite`/`themes`).
- EPP / quest / fiches : `SELECT` directs filtrés.
- Conformité : item **nudge unique statique** (0/52 ou 0/13), pas une liste — tant que le
  tracking n'est pas câblé.
- Pagination/interleaving : prévoir un quota par type pour éviter que les 504 news noient
  les 21 items pédagogiques.

---

## 6. Écarts mémoire ↔ code + correctifs tentants (NON appliqués)

### Écarts
1. **Conformité** : l'hypothèse « pas de table de tracking (probable) » est **fausse** — un
   schéma `cabinet_compliance_*` existe. Mais il est **non câblé** à la page et **désaligné**
   (6 cat / 13 items en base vs 7 / 52 en dur) → en pratique, progression réelle indisponible.
2. **Fiches** : `categorie` est du **texte éditorial libre**, pas un slug `formations.category`
   → matching fiches **par `axe` uniquement** (pas de pont catégorie comme supposé).
3. **EPP** : colonne de publication = `is_published` (booléen), pas `status`/`active`. `theme_slug` nullable.
4. **Volume axe 2** : aucune formation publiée ; seul 1 EPP + conformité non câblée → axe 2 reste le plus faible.

### Correctifs tentants repérés — notés, **non appliqués**
- `conformite/page.tsx` hardcodé alors que `cabinet_compliance_*` existe : candidat câblage
  Supabase (commentaire `// sera remplacé par Supabase`). Nécessite d'abord réconcilier le
  seed (13 vs 52). **Non touché.**
- `user_cabinet_compliance` vide : aucun seed/onboarding ne l'alimente. **Noté.**
- Pas de composant carte générique : un `ForYouCard` serait à créer (Phase 1, sur demande
  explicite). **Non créé.**

---

## Observations (hors périmètre, non implémenté)
- Le feed unifié tient surtout sur les **504 news** ; le contenu pédagogique (21 items)
  est trop clairsemé pour porter un feed seul — prévoir quotas/mix par type.
- Réconcilier la définition « conformité » (DB 6/13 vs UI 7/52) est un prérequis avant tout
  affichage de progression réelle — à traiter dans un ticket dédié.
