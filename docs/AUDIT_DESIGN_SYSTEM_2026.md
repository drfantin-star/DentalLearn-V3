# Audit Design System & Réutilisabilité Composants — DentalLearn V3

> **Audit en lecture seule.** Aucune modification de code n'a été appliquée. Ce document
> constitue le livrable unique du ticket `claude/audit-design-system`.
>
> Date de l'audit : 10 mai 2026
> Périmètre : `src/app/`, `src/components/`, `src/context/`, partie UI de `src/lib/`
> Exclusions : `src/lib/supabase/`, edge functions Supabase, scripts, tests

---

## 1. Synthèse executive

### Score global de maturité du design system : **FAIBLE**

Le projet a posé les premières fondations d'un design system (4 tokens couleurs dans
`tailwind.config.ts`, 11 variables CSS dans `globals.css`, 3 composants dans
`src/components/ui/`) mais ces fondations sont **très peu utilisées** et coexistent
avec un volume important de styles ad hoc :

- **3 205 occurrences** de classes Tailwind couleur en dur (palette générique
  `gray-*`, `red-*`, `emerald-*`…) sur **125 fichiers**.
- **496 occurrences** du hex de la couleur primaire `#2D1B96` au lieu d'un alias
  (`bg-ds-blue` ou `bg-primary` n'existe pas comme token).
- **0 utilisation** du composant `Badge` pourtant défini dans `src/components/ui/`.
- **8 implémentations distinctes** de modals, **12 chaînes différentes** pour le
  fond/backdrop d'un modal.

À l'opposé, la zone `src/components/audio-enriched/` et l'éditeur de timelines
(`src/components/admin/timeline-editor/`) utilisent systématiquement les variables
CSS `var(--color-bg-card)`, `var(--color-text-muted)`. Cette zone constitue un
îlot de bonne pratique et peut servir de modèle de référence.

### Top 3 chantiers prioritaires

1. **Centraliser la couleur primaire `#2D1B96`** (496 occurrences, 76 fichiers).
   Aujourd'hui une demande "changer le bleu de la marque" oblige à modifier ~76
   fichiers manuellement et risque d'oublier des occurrences. Définir un token
   `primary` (Tailwind + variable CSS), puis migrer en lots.

2. **Construire un kit de composants UI de base** (Button, Card, Modal, Badge,
   Input, PageHeader). Aujourd'hui chaque page redéfinit ses propres variantes
   de boutons (≈400 occurrences sur 106 fichiers, sans aucune abstraction).

3. **Extraire la logique métier des pages-monstres**. Les 5 plus gros fichiers
   pèsent ensemble **6 800+ lignes** et mélangent fetch Supabase, état local
   complexe, et rendu UI. Une refonte design est aujourd'hui **risquée** parce
   qu'on ne peut pas changer le visuel sans rouvrir le code métier.

### Estimation grossière de l'effort de refonte design future

| Scénario | Effort | Risque |
|---|---|---|
| **Refonte EN L'ÉTAT** (changer la palette + composants visuels sur le code actuel) | **15-20 jours** | Élevé : régressions silencieuses sur des pages secondaires, oublis quasi certains à cause des 496 hex dispersés et des 264 classes couleur distinctes |
| **Refonte APRÈS refactoring DS** (centralisation tokens + 6 composants atomiques) | **6-8 jours** de refonte + **8-12 jours** de pré-refactoring | Faible à modéré : le pré-refactoring rend la refonte mécanique (changer ~10 tokens + ~6 composants) |

Pour une refonte ambitieuse (ex. nouveau langage visuel, support thème clair/sombre
unifié, refonte du shell mobile vs admin), le pré-refactoring n'est pas optionnel :
il conditionne la possibilité même de tester la refonte sans tout casser.

---

## 2. Détail par section

### 2.1 Couleurs hardcodées

#### a) Classes Tailwind palette générique

Recensement automatique sur les classes `(bg|text|border|from|to|via|ring|fill|stroke|outline|divide|placeholder|caret|accent|decoration|shadow)-{family}-{50-950}` :

- **3 205 occurrences** au total
- **264 classes distinctes** utilisées
- **125 fichiers** concernés

Répartition par famille de couleur Tailwind :

| Famille | Occurrences | Rôle apparent |
|---|---:|---|
| gray | 1 883 | Texte, bordures, surfaces neutres (zone admin claire) |
| red | 422 | Erreurs, suppression, alertes |
| green / emerald | 296 | Succès, validation |
| amber / yellow | 181 | Avertissements, EPP, badges "Bonus" |
| blue | 89 | Liens secondaires, info |
| orange | 53 | Variants "populaire" |
| purple / violet / indigo | 94 | Axe CP 1, accents |
| autres (teal, cyan, pink, fuchsia, sky, neutral, rose) | 187 | Cas isolés |

**Top 10 classes les plus utilisées** :

| Classe | Occ. | Suggestion de token sémantique |
|---|---:|---|
| `text-gray-900` | 293 | `text-foreground` |
| `text-gray-700` | 265 | `text-foreground-muted` |
| `text-gray-500` | 217 | `text-muted-foreground` |
| `text-gray-400` | 174 | `text-subtle-foreground` |
| `border-gray-300` | 160 | `border-input` (formulaires) |
| `text-gray-600` | 155 | `text-foreground-muted` |
| `border-gray-200` | 153 | `border-default` |
| `bg-gray-100` | 129 | `bg-surface-muted` |
| `bg-gray-50` | 123 | `bg-surface-subtle` |
| `bg-red-50` | 68 | `bg-danger-subtle` |

**Top 5 fichiers avec le plus de classes couleur en dur** :

| Fichier | Occurrences |
|---|---:|
| `src/app/(app)/formation/[theme]/epp/page.tsx` | 191 |
| `src/app/admin/formations/[id]/sequences/[sequenceId]/page.tsx` | 126 |
| `src/app/admin/news/[id]/page.tsx` | 117 |
| `src/app/admin/news/manual/page.tsx` | 116 |
| `src/app/admin/news/page.tsx` | 114 |

#### b) Couleurs en hexadécimal dans le code

- **112 hex distincts** sur 6 chiffres, **101 fichiers** concernés
- 58 occurrences supplémentaires de `#333` (3 chiffres), 6 de `#444`

**Top 10 hex** :

| Hex | Occ. | Rôle | Top fichiers |
|---|---:|---|---|
| `#2D1B96` | 496 | Primaire de marque (bleu profond) | `admin/formations/.../questions/new` (22), `admin/news/manual` (17), `register` (16) |
| `#e5e5e5` | 107 | Texte clair sur fond sombre | `home/DailyQuizModal` (21), `formation/SequencePlayer` (19), `satisfaction-froid` (17) |
| `#242424` | 70 | Surface carte sombre | `home/DailyQuizModal` (15), `formation/SequencePlayer` (14) |
| `#a3a3a3` | 57 | Texte secondaire sombre | `formation/SequencePlayer` (16), `home/DailyQuizModal` (11) |
| `#231575` | 54 | Hover de la couleur primaire | `admin/formations/.../questions/new` (6), `admin/epp/[id]` (5) |
| `#1a1a1a` | 46 | Surface input/card-hover sombre | divers |
| `#00D1C1` | 46 | Turquoise (axe 2 / accent) | `news/QuizActuModal` (6), `home/DailyQuizModal` (6) |
| `#6b7280` | 44 | Texte muted (gris Tailwind 500) | divers |
| `#0F7B6C` | 39 | Variante turquoise foncée | divers |
| `#2a2a2a` | 36 | Surface card-hover sombre | divers |

**Constat majeur** : `#2D1B96`, `#231575` et `#1a1060` sont des nuances de la même
couleur primaire de marque utilisées 562 fois. Aucun token Tailwind ne les
référence (le token `ds-blue: #2D1B96` existe mais est utilisé seulement 3 fois ;
il est presque toujours réécrit en hex inline).

De même, `#00D1C1` est défini dans `tailwind.config.ts` comme `ds-turquoise` et est
utilisé 92 fois via la classe Tailwind, **mais** 46 fois en hex direct. Cohabitation
des deux conventions = double maintenance.

#### c) Couleurs dans `style={{ }}` inline

- **280 occurrences** d'`style={{ ... }}` portant une propriété `color`,
  `background*`, `border*`, `fill` ou `stroke`
- Top 3 fichiers : `formation/SequencePlayer.tsx` (65), `home/DailyQuizModal.tsx` (64),
  `satisfaction-froid/[formationId]/page.tsx` (35)

Trois usages distincts cohabitent :

1. **Dynamique légitime** : `axisColors[axis.id]` injecte une couleur calculée à
   partir d'un mapping (cf. `src/components/home/TrainingCard.tsx:25-30`). Ce
   pattern est correct et doit être préservé.
2. **CSS variable de tenant** : `style={{ backgroundColor: 'var(--tenant-primary)' }}`
   est utilisé 7 fichiers de la zone tenant (cf. `src/app/tenant/admin/branding/page.tsx`).
   C'est l'unique endroit où le multi-tenant teinte l'UI.
3. **Hex en dur dans le style** : `style={{ background: '#0a0a0a' }}` (cf.
   `src/app/satisfaction-froid/[formationId]/page.tsx`). À la fois redondant
   avec une classe Tailwind et impossible à thémer.

#### d) État de `tailwind.config.ts`

Tokens définis aujourd'hui :

```
ds-turquoise        #00D1C1    (utilisé 92×)
ds-turquoise-dark   #00B8A9    (utilisé peu)
ds-blue             #2D1B96    (utilisé 3×)
ds-blue-dark        #1A0F5C    (utilisé 0×)
axe1                #2D1B96    (utilisé 0×)
axe2                #00D1C1    (utilisé 0×)
axe3                #F59E0B    (utilisé 20×, dans une seule combinaison)
axe4                #EC4899    (utilisé 0×)
```

**Constat** : 5 tokens sur 8 sont définis mais jamais utilisés. La nomenclature
mélange "marque" (`ds-blue`, `ds-turquoise`) et "axe pédagogique" (`axe1-4`)
alors que les valeurs se recouvrent (`axe1 = ds-blue`).

Aucun token sémantique (`primary`, `surface`, `foreground`, `danger`, `success`)
n'existe. Aucun jeu de gris non plus. Aucun mode sombre unifié alors que la
zone `(app)/` et les modals utilisent un thème sombre tandis que la zone `admin/`
utilise un thème clair (cf. `src/app/(app)/layout.tsx:30` `background: '#0F0F0F'` vs
36 fichiers admin avec `bg-white`).

**Recommandation** : repartir d'un token set sémantique (cf. annexe §4.1), garder
`ds-turquoise` et `ds-blue` comme alias historiques le temps de la migration, et
supprimer les tokens `axe*` dupliqués.

---

### 2.2 Espacements et typographies hardcodés

#### a) Tailles de police et hiérarchie de titres

Distribution des classes `text-{size}` :

| Classe | Occurrences |
|---|---:|
| `text-sm` | 852 |
| `text-xs` | 468 |
| `text-2xl` | 69 |
| `text-lg` | 58 |
| `text-3xl` | 36 |
| `text-base` | 34 |
| `text-xl` | 32 |
| `text-4xl` / `text-5xl` / `text-7xl` | 5 |

Distribution des classes `font-{weight}` :

| Classe | Occurrences |
|---|---:|
| `font-medium` | 446 |
| `font-semibold` | 310 |
| `font-bold` | 297 |
| `font-black` | 24 |
| autres | 18 |

#### b) Cohérence H1/H2/H3 entre pages

| Niveau | Variantes className distinctes | Total balises avec className |
|---|---:|---:|
| `<h1>` | **29** | ~80 |
| `<h2>` | **39** | ~70 |
| `<h3>` | **47** | ~70 |

Soit **115 combinaisons distinctes** pour 217 titres : autrement dit, à peu près
une variante par paire de titres. Quelques exemples concrets de styles pour H1 :

```
text-2xl font-bold text-gray-900               (15×)
text-3xl font-bold text-gray-900               (12×)
text-2xl font-bold text-gray-900 mb-2          (10×)
text-xl  font-bold mb-2                        (4×)
text-3xl font-bold text-[#2D1B96] mb-2         (4×)
text-2xl font-bold text-white                  (3×)
text-2xl font-bold text-[#2D1B96] mb-2         (3×)
text-3xl font-bold text-gray-900 mb-1          (3×)
text-lg  font-bold text-gray-900               (3×)
```

**Conséquence concrète** : si Julie demande "rends tous les titres de page un
peu plus gros", il faut ouvrir ~30 fichiers pour chaque niveau de titre. Aucun
composant `<PageTitle>` ou `<SectionTitle>` n'existe.

#### c) Espacements et paddings

Top combinaisons rencontrées (paddings) :

| Classe | Occurrences |
|---|---:|
| `px-4` | 285 |
| `py-3` | 226 |
| `py-2` | 202 |
| `px-3` | 176 |
| `p-4` | 156 |
| `px-6` | 137 |
| `p-6` | 114 |
| `py-4` | 104 |

Top combinaisons gap/space :

| Classe | Occurrences |
|---|---:|
| `gap-2` | 350 |
| `gap-3` | 240 |
| `gap-1` | 79 |
| `gap-4` | 75 |
| `space-y-3` | 63 |
| `space-y-4` | 47 |

Top combinaisons margins :

| Classe | Occurrences |
|---|---:|
| `mb-2` | 169 |
| `mb-4` | 141 |
| `mb-1` | 126 |
| `mb-3` | 105 |
| `mt-1` | 89 |
| `mb-6` | 87 |

**Constat** : pas de désordre majeur côté espacements — l'app est cohérente sur
une échelle restreinte (1-2-3-4-6-8). En revanche, **aucune scale custom** n'est
définie dans `tailwind.config.ts` ; le projet utilise la scale Tailwind par défaut.

#### d) Border radius et shadows

| Classe rounded | Occurrences |
|---|---:|
| `rounded-lg` | 367 |
| `rounded-xl` | 355 |
| `rounded-full` | 262 |
| `rounded-2xl` | 255 |
| `rounded` | 95 |
| `rounded-md` | 30 |
| `rounded-3xl` | 15 |

| Classe shadow | Occurrences |
|---|---:|
| `shadow-lg` | 60 |
| `shadow-sm` | 51 |
| `shadow-md` | 36 |
| `shadow-xl` | 33 |
| `shadow-2xl` | 13 |

**Constat** : 4 valeurs de border-radius (`lg`, `xl`, `2xl`, `full`) cohabitent
sans règle claire. Les cards admin tendent vers `rounded-xl` (avec `border`) ou
`rounded-2xl` (avec `shadow`), les cards mobiles `(app)/` vers `rounded-2xl`.
Une convention "carte" → `rounded-2xl` figerait cela.

---

### 2.3 Composants dupliqués / quasi-dupliqués

#### a) Boutons

- **394 occurrences** de la balise `<button>` sur **106 fichiers**
- Aucun composant `<Button>` réutilisable n'existe dans `src/components/ui/`
- 4 fichiers exposent un bouton spécialisé qui pourrait être normalisé :
  `GenerateAttestationButton.tsx`, `DailyQuizButton.tsx`, `QuestionApprovalButton.tsx`,
  `RetryButton.tsx`, `PublishToggleButton.tsx`

Variantes typiques observées (échantillon) :

| Variante apparente | Exemple class | Fichiers où on la retrouve |
|---|---|---|
| CTA primaire bleu | `bg-[#2D1B96] hover:bg-[#231575] text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors` | `admin/news/[id]`, `admin/news/manual`, `admin/epp/[id]`, `admin/formations/[id]/sequences/[sequenceId]/questions/new`, et 12+ autres |
| CTA primaire bleu (gradient) | `bg-gradient-to-r from-[#2D1B96] to-[#3D2BB6] text-white rounded-xl text-sm font-bold` | `home/FormationCard`, `home/DailyQuizButton` |
| Secondaire blanc/bordé | `inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg` | `admin/access-management`, `admin/news/sources`, `admin/organizations/*` |
| Ghost gris | `px-6 py-3 rounded-xl text-gray-700 hover:bg-gray-100` | divers |
| Destructif rouge | `flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors` (et variante rouge) | divers |

Effort de factorisation : **medium**. Il faut ouvrir ~80 fichiers, mais la majorité
des occurrences tombent sur 4-5 patterns (primaire, secondaire, ghost, danger,
icon-only). Un composant `<Button variant="primary|secondary|ghost|danger" size="sm|md|lg">`
couvrirait ≥85% des cas.

#### b) Cards

12 composants se nomment `*Card.tsx` :

```
src/components/ui/ThemeCard.tsx
src/components/news/NewsCardItem.tsx
src/components/news/NewsCardSVG.tsx
src/components/home/FormationCard.tsx
src/components/home/FormationCardOverlay.tsx
src/components/home/JournalWeekCard.tsx
src/components/home/TrainingCard.tsx
src/components/home/StatsCards.tsx
src/components/home/DemarcheCard.tsx
src/components/admin/satisfaction/VerbatimCard.tsx
src/components/admin/timeline-editor/CardContentEditor.tsx
src/components/profile/attestations/AttestationCard.tsx
```

Ces cards ne partagent **aucune base commune**. Pourtant trois patterns reviennent :

- **Carte mobile sombre** (zone `(app)/`) : fond `bg-gray-800/50` ou `#242424`,
  `rounded-2xl`, padding `p-3` ou `p-4`, bordure `border-gray-700/50`.
- **Carte mobile claire** (cards d'accueil sur fond noir) : `bg-white rounded-2xl
  p-4 shadow-sm border border-gray-100` — voir
  `src/components/home/FormationCard.tsx:25` et `src/components/home/TrainingCard.tsx:18`.
  Identiques au caractère près.
- **Carte admin** : `bg-white rounded-2xl shadow-sm p-6` ou `bg-white rounded-xl
  border border-gray-200 p-6 space-y-4` — au moins 18 répétitions de la même chaîne.

`src/components/home/FormationCard.tsx:25` et `src/components/home/TrainingCard.tsx:18`
partagent **textuellement la même chaîne** `bg-white rounded-2xl p-4 shadow-sm border
border-gray-100`. C'est le candidat évident pour un `<Card>` de base.

Effort de factorisation : **medium**. Création d'un `<Card>`/`<CardHeader>`/`<CardBody>`
de base + migration de 6-8 lieux d'appel.

#### c) Badges / pills / tags

- **70 fichiers** combinent `rounded-full` + `text-xs` (signature d'une pill).
- Le composant `src/components/ui/Badge.tsx` existe avec 5 variantes
  (`cp`, `bonus`, `epp`, `nouveau`, `populaire`) mais **n'est importé nulle part**.
- Les badges sont systématiquement réécrits inline. Exemples :
  ```
  bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full text-[10px] font-bold
  bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-bold
  bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs font-medium
  bg-blue-500/20 text-blue-300 border-blue-400/30 (variante dark)
  ```
- Existence de plusieurs maps locaux `STATUS_BADGE`, `TYPE_BADGE`, `PLAN_BADGE`,
  `CATEGORY_BADGE_CLASSES` (`src/components/news/NewsCardItem.tsx:13-17`,
  `src/app/admin/organizations/page.tsx`, etc.) qui pourraient être consolidés.

Effort de factorisation : **low**. Étendre `Badge.tsx` (variantes + tailles +
support dark/light) et migrer en 4-6h. Le principal frein : il faut auditer chaque
emplacement pour mapper "couleur ad hoc → variante sémantique".

#### d) Modals / dialogs

8 modals existent, plus 6 fichiers utilisent `fixed inset-0` directement :

| Fichier | Backdrop class observée |
|---|---|
| `src/components/auth/CreateCabinetModal.tsx` | `fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4` |
| `src/components/quiz/QuizModal.tsx` | `fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4` |
| `src/components/news/QuizActuModal.tsx` | `fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4` |
| `src/components/news/NewsModal.tsx` | `fixed inset-0 z-50 flex flex-col` |
| `src/components/home/DailyQuizModal.tsx` | `fixed inset-0 z-50 bg-black/60 flex items-end md:items-center justify-center` |
| `src/components/home/JournalDetailModal.tsx` | variante avec `bg-gray-900/70` |
| `src/components/admin/timeline-editor/RegenerateConfirmModal.tsx` | `fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4` |
| `src/components/attestations/SatisfactionSurveyModal.tsx` | `fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-gray-900/70 backdrop-blur-sm` |

**12 chaînes de classes distinctes** pour le backdrop : `bg-black/40`, `bg-black/60`,
`bg-black/70`, `bg-gray-900/60`, `bg-gray-900/70`, avec ou sans `backdrop-blur-sm`,
avec ou sans `p-4`, avec ou sans `items-end`. Aucune gestion centralisée du focus
trap, de l'escape, de la fermeture au clic backdrop, du scroll-lock du body.

Effort de factorisation : **high**. Un composant `<Modal>` propre demande de
penser : focus management, animation d'entrée/sortie (le projet utilise
`framer-motion`, déjà disponible), portails, taille (`sm`/`md`/`lg`/`fullscreen`),
support mobile (sheet bas). 1-2 jours pour le composant, +1-2 jours pour migrer
les 8 modals existants.

#### e) Page headers (titre + bouton retour)

- **44 occurrences** de `<ArrowLeft />` dans la zone admin
- 27 fichiers utilisent un pattern "back link + titre" similaire :
  ```
  <Link className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 mb-4">
    <ArrowLeft className="w-4 h-4" />
    Retour à la liste
  </Link>
  <header className="mb-6">
    <h1 className="text-3xl font-bold text-gray-900 mb-1">…</h1>
  </header>
  ```
  (cf. `src/app/admin/news/manual/page.tsx`, `src/app/admin/news/sources/SourcesPageClient.tsx`,
  `src/app/admin/organizations/[id]/page.tsx`, `src/app/admin/organizations/new/page.tsx`,
  `src/app/admin/formations/new/page.tsx`, etc.)

Effort de factorisation : **low**. Composant `<PageHeader title backHref backLabel actions>`
de ~30 lignes ; migration ~2-3h car les variations sont peu nombreuses.

#### f) Inputs / formulaires

Au moins **4 conventions de styling** d'input cohabitent :

| Convention | Exemple | Trouvé dans |
|---|---|---|
| Light + radius lg | `border border-gray-300 rounded-lg px-…` | `admin/organizations/*`, `tenant/admin/*` |
| Light + radius xl | `border border-gray-200 rounded-xl px-…` | `admin/news/*`, `admin/news/manual` |
| Dark | `bg-[#1a1a1a] border border-[#333]` (style inline ou class) | `admin/poc/*`, `admin/timelines/*`, `(app)/profil/edit` |
| Mobile + focus ring | `w-full px-3 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-[#2D1B96]` | `(app)/profil/edit` |

Aucun composant `<TextField>` / `<Input>` n'existe. Effort : **medium**, dépend
de la décision "thème admin clair vs admin sombre" — la zone POC/timelines a
déjà migré vers le sombre via les variables CSS.

---

### 2.4 Séparation logique / présentation

Top 10 des composants les plus lourds (lignes × responsabilités) :

| Fichier | Lignes | useState | useEffect | async fns | Appels data |
|---|---:|---:|---:|---:|---:|
| `src/components/home/DailyQuizModal.tsx` | 1 640 | 22 | 8 | 3 | 3 |
| `src/app/(app)/formation/[theme]/epp/page.tsx` | 1 537 | 19 | 2 | 9 | 15 |
| `src/components/formation/SequencePlayer.tsx` | 1 442 | 22 | 3 | 1 | 0 |
| `src/app/admin/news/manual/page.tsx` | 1 349 | 17 | 2 | 3 | 3 |
| `src/components/admin/news/AudioPodcastBlock.tsx` | 974 | 12 | 2 | 8 | 8 |
| `src/app/admin/formations/[id]/sequences/[sequenceId]/questions/new/page.tsx` | 818 | 17 | 2 | 2 | 2 |
| `src/app/admin/epp/[id]/page.tsx` | 790 | 15 | 2 | 7 | 10 |
| `src/app/admin/formations/[id]/sequences/[sequenceId]/page.tsx` | 786 | 13 | 2 | 4 | 7 |
| `src/app/admin/news/[id]/page.tsx` | 780 | 14 | 2 | 3 | 4 |
| `src/app/admin/news/page.tsx` | 774 | 7 | 6 | 1 | 6 |

Pour chacun, jugement sur la possibilité d'extraction :

| Fichier | Extraction recommandée | Difficulté |
|---|---|---|
| `DailyQuizModal.tsx` | Hook `useDailyQuizFlow()` (état du quiz, soumission, progression) + sous-composants `<QuestionScreen>`, `<ResultScreen>` | **High** — flot d'UX complexe, à découper avec soin |
| `formation/[theme]/epp/page.tsx` | Hook `useEppData()` + composants `<EppQuestionList>`, `<EppActionPanel>` ; les 15 appels Supabase peuvent migrer dans le hook | **High** |
| `SequencePlayer.tsx` | Hook `useSequenceState()` + sous-composants karaoke / whiteboard / quiz déjà existants à brancher | **High** |
| `admin/news/manual/page.tsx` | Découpage en 3-4 étapes (`<UrlStep>`, `<MetadataStep>`, `<PreviewStep>`) ; hook `useManualIngestion()` | **Medium** |
| `AudioPodcastBlock.tsx` | Hook `usePodcastGeneration()` (8 appels Supabase) ; le rendu reste dans le composant | **Medium** |
| `admin/formations/.../questions/new/page.tsx` | Logique de validation Zod + handlers à extraire dans `useQuestionForm()` | **Medium** |
| `admin/epp/[id]/page.tsx` | Hook `useEppDetail()` (10 appels) + composants par section | **Medium** |
| `admin/formations/.../sequences/[sequenceId]/page.tsx` | Hook `useSequenceAdmin()` ; rendu en sous-composants | **Medium** |
| `admin/news/[id]/page.tsx` | Hook `useNewsDetail()` ; rendu en sections | **Medium** |
| `admin/news/page.tsx` | Listing — moins de logique métier, surtout filtres et pagination, à transformer en `useNewsList()` + composant table | **Low/Medium** |

L'app dispose déjà de **bons hooks de données** dans `src/lib/hooks/` (`useUser`,
`useAxes`, `useFormations`, `useNews`, `useDemarches`, `useUserAttestations`,
`useWeeklyLeaderboard`, `useSatisfactionSurvey`). Ces hooks ne sont
malheureusement pas utilisés systématiquement : les pages admin font leurs
propres `createClient()` + `useState` + `useEffect`, court-circuitant la couche
hook. **45 fichiers importent directement le client Supabase** (35 d'entre eux
sont des pages admin). Une politique "pas de Supabase dans les pages, tout passe
par un hook" diviserait par 2-3 la taille de plusieurs pages.

`src/components/admin/news/AudioPodcastBlock.tsx` (10 fichiers en aval) montre
le pattern à éviter à grande échelle : un composant qui fetche, transforme et
rend en 974 lignes. Le porter sous forme `useAudioPodcast(audioId)` rendrait le
composant testable et lui permettrait d'être recyclé dans le futur player
redesign.

---

### 2.5 État du design system existant

| Élément | État | Détail |
|---|---|---|
| Dossier `src/components/ui/` | **3 composants** | `Badge.tsx` (jamais utilisé), `FilterTabs.tsx` (1 utilisation), `ThemeCard.tsx` (utilisé pour son type uniquement par 3 fichiers) |
| `tailwind.config.ts` | **8 tokens couleur, 0 spacing, 0 fontSize, 0 shadow custom** | Les tokens définis (`ds-*`, `axe*`) sont pour 5/8 jamais utilisés. Aucune scale custom. Aucun mode sombre via classe. |
| Variables CSS dans `globals.css` | **11 variables** | `--color-bg`, `--color-bg-card`, `--color-bg-card-hover`, `--color-bg-input`, `--color-border`, `--color-border-light`, `--color-text-primary`, `--color-text-secondary`, `--color-text-muted`, `--color-bottomnav`. Utilisées principalement par la zone POC audio/timeline, pas par les pages admin. |
| Utilitaires CSS custom | `.no-scrollbar`, `.scrollbar-hide`, `.safe-bottom`, `.animate-fade-in`, `.animate-fadeIn`, `.animate-wiggle` | Utiles ; pas de doublon majeur sauf `fade-in` vs `fadeIn` qui définissent la même animation |
| Convention de nommage des composants | **Mixte** : default export vs named export, `*Card`/`*Modal`/`*Button` vs noms libres | Pas de problème grave mais pas de convention écrite non plus |
| Helpers de classes (`clsx`, `cva`, `tailwind-merge`) | **Aucun** | Pas dans `package.json`. Conséquence : chaque variante de composant duplique la chaîne de classes en littéral. |
| Mode multi-tenant | `--tenant-primary` injecté en CSS variable, lu via `style={{ color: 'var(--tenant-primary)' }}` dans 6 fichiers `tenant/admin/*` | Cohérent et sain, mais isolé à la zone tenant. |
| Variables d'axe pédagogique | `src/lib/constants/axis.ts` exporte `axisIcons`, `axisBgColors`, `axisColors` | Mappings hex en TS, utilisés via `style={{ color: axis.color }}`. Une bonne pratique localisée mais qui ne suit pas la convention CSS variables. |

**Bilan** : il existe **trois approches concurrentes** dans le projet :

1. **Hex en dur** (~95% des cas, ~70% du code).
2. **Tokens Tailwind `ds-*`/`axe*`** (~5%, principalement zone admin/poc).
3. **Variables CSS** (~5%, principalement zone audio-enriched et tenant).

Aucune n'est suffisamment dominante pour s'imposer naturellement. Choisir la
convention cible est probablement le travail de réflexion #1 avant toute refonte.

---

## 3. Plan de refactoring suggéré

### 3.1 Quick wins (< 2h)

1. **Renommer/aligner les tokens couleur dans `tailwind.config.ts`** : ajouter
   `primary` (= `#2D1B96`), `primary-hover` (= `#231575`), supprimer les `axe*`
   inutilisés. Effort : 30 min, **0 régression** car les noms existants sont
   préservés en alias.
2. **Activer la convention `colors-*` documentée**. Ajouter un commentaire
   en tête de `globals.css` listant les 11 variables CSS et leur usage prévu.
   Effort : 30 min.
3. **Supprimer les animations dupliquées** `fade-in` et `fadeIn` dans
   `globals.css` (gardent un seul nom). Effort : 15 min.
4. **Brancher le composant `Badge` existant** sur 4-5 sites de quick win
   (badges "CP", "Bonus", "EPP" déjà couverts par le composant). Effort : 1h,
   **−40 lignes** environ.
5. **Ajouter `clsx` ou `tailwind-merge`** au projet (1 dep, 0 break) pour
   préparer la suite. Effort : 15 min.

**Gain immédiat** : démontrer la viabilité de la démarche, fournir un terrain
de référence pour la suite.

### 3.2 Chantiers moyens (1-2 jours)

1. **Composant `<Button>`** avec variantes `primary | secondary | ghost | danger`,
   tailles `sm | md | lg`, état `loading`/`disabled`. Migration progressive : 5-8
   pages admin pour démonstration, le reste sur des PRs ciblés. **~1.5j** total.
2. **Composant `<PageHeader>`** (back link + titre + actions). Migration des 27
   pages admin. **~0.5j**.
3. **Composant `<Card>` + `<CardHeader>` + `<CardBody>`** comme conteneur de base,
   variantes `light | dark`. Migration des 6-8 sites les plus évidents.
   **~1j**.
4. **Composant `<Badge>`** : étendre celui qui existe (variantes contextuelles
   `info | success | warning | danger | neutral`, tailles). Migrer les
   `STATUS_BADGE` / `TYPE_BADGE` / `PLAN_BADGE`/ `CATEGORY_BADGE_CLASSES` locaux.
   **~1j**.
5. **Migration de la couleur primaire** : remplacer 496 `#2D1B96` et 54 `#231575`
   par les tokens. Faisable via codemod (sed + revue manuelle). **~1j**.

### 3.3 Chantiers lourds (semaine+)

1. **Composant `<Modal>` complet** avec framer-motion, focus trap, scroll lock,
   variantes mobile/desktop. Migration des 8 modals existants. **~3-4j**.
2. **Composant `<TextField>` / `<Select>` / `<Textarea>`** pour formulaires admin
   et profil. **~2-3j**.
3. **Découpage des 5 plus gros fichiers** (`DailyQuizModal`, `epp/page`,
   `SequencePlayer`, `news/manual/page`, `AudioPodcastBlock`) — chacun est un
   chantier en soi de 1-2 jours pour extraction de hook + sous-composants sans
   régression visuelle.
4. **Unification thème clair/sombre** : aujourd'hui la zone `(app)` est sombre
   et la zone `admin` est claire avec aucune frontière formelle. Un mode
   commun à variables CSS (avec préfixe `--surface-*`, `--text-*`) serait
   l'occasion de tester la cohérence à travers toute l'app. **1 semaine min.**
5. **Migration de tous les hex restants vers tokens** une fois les tokens stables
   (~110 hex distincts à mapper). **~3-4j** y compris la revue manuelle.

### 3.4 Ordre de priorité recommandé

```
Étape 1 : Quick wins                          (≈ ½ journée)
Étape 2 : Tokens couleur + Button + PageHeader (≈ 3-4 jours)
   ↓
   GO/NO-GO : tester la migration sur 1 page admin de bout en bout
   ↓
Étape 3 : Card, Badge consolidés               (≈ 2 jours)
Étape 4 : Modal, formulaires                   (≈ 1 semaine)
Étape 5 : Découpage des pages-monstres         (à lisser sur 2-3 sprints,
                                                en marge des features)
Étape 6 : Migration hex/tokens en masse        (≈ 3-4 jours, codemod)
```

L'étape 2 est le **point critique** : si elle se passe bien, la refonte design
ultérieure devient triviale. Si elle se passe mal, c'est un signal qu'une
refonte ambitieuse n'est pas réaliste sans un travail plus profond.

---

## 4. Annexe : exemples de migration

> **Rappel : aucun changement de code n'est appliqué dans ce ticket.** Les blocs
> ci-dessous sont uniquement illustratifs.

### 4.1 Exemple — Token couleur primaire

**Avant** (réparti sur 76 fichiers) :

```tsx
// src/app/admin/news/manual/page.tsx (extrait, parmi 17 occurrences ici)
<button className="bg-[#2D1B96] hover:bg-[#231575] text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
  Ingérer
</button>

// src/components/PWAInstallBanner.tsx
<div className="text-[#2D1B96]">…</div>

// src/app/(app)/page.tsx
<h1 className="text-[#00D1C1]">…</h1>
```

**Après** (`tailwind.config.ts`) :

```ts
// tailwind.config.ts
extend: {
  colors: {
    primary: {
      DEFAULT: '#2D1B96',
      hover:   '#231575',
      muted:   '#1a1060',
    },
    accent: {
      DEFAULT: '#00D1C1',  // ex ds-turquoise
      hover:   '#00B8A9',
    },
    // alias historiques conservés pendant la migration
    'ds-blue': '#2D1B96',
    'ds-turquoise': '#00D1C1',
  },
},
```

```tsx
// src/app/admin/news/manual/page.tsx
<button className="bg-primary hover:bg-primary-hover text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors">
  Ingérer
</button>
```

**Bénéfice concret** : Julie veut changer le bleu de marque ?
1 ligne dans `tailwind.config.ts` au lieu de 76 fichiers à scanner.

### 4.2 Exemple — Composant `<Button>` partagé

**Avant** (`src/app/admin/access-management/page.tsx`, dupliqué dans ~50 autres pages) :

```tsx
<button
  onClick={handleSearch}
  disabled={loading}
  className="inline-flex items-center gap-2 px-4 py-2 bg-[#2D1B96] hover:bg-[#231575] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
>
  <Search className="w-4 h-4" />
  Rechercher
</button>
```

**Après** :

```tsx
// src/components/ui/Button.tsx — nouveau
import { cva } from 'class-variance-authority'

const buttonStyles = cva(
  'inline-flex items-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50',
  {
    variants: {
      variant: {
        primary:   'bg-primary text-white hover:bg-primary-hover',
        secondary: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
        ghost:     'text-gray-700 hover:bg-gray-100',
        danger:    'bg-red-500 text-white hover:bg-red-600',
      },
      size: {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2 text-sm',
        lg: 'px-6 py-3 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

// usage
<Button onClick={handleSearch} disabled={loading}>
  <Search className="w-4 h-4" />
  Rechercher
</Button>
```

**Bénéfice concret** : tous les boutons primaires se mettent à jour
simultanément si on change la définition. Aujourd'hui, 100+ chaînes
strictement identiques sont copiées-collées.

### 4.3 Exemple — Extraction logique/UI sur `AudioPodcastBlock`

**Avant** : `src/components/admin/news/AudioPodcastBlock.tsx` (974 lignes, 12
useState, 8 appels Supabase, 8 fonctions async, du JSX du début à la fin du fichier).

**Après** :

```ts
// src/lib/hooks/useAudioPodcast.ts — extraction de toute la couche données
export function useAudioPodcast(synthesisId: string) {
  const [audio, setAudio] = useState<PodcastAudio | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async () => { /* … 8 appels Supabase … */ }
  const cancel    = async () => { /* … */ }
  const refresh   = async () => { /* … */ }

  return { audio, loading, error, generate, cancel, refresh }
}
```

```tsx
// src/components/admin/news/AudioPodcastBlock.tsx — passe à ~250 lignes
export function AudioPodcastBlock({ synthesisId }: Props) {
  const { audio, loading, error, generate, cancel } = useAudioPodcast(synthesisId)
  // … 100% UI à partir d'ici
}
```

**Bénéfice concret** :
- Le composant peut être restylé sans toucher au code Supabase.
- Le hook devient testable indépendamment.
- Quand un autre écran (tenant ? mobile ?) doit afficher le podcast, il
  réutilise le hook au lieu de re-fetcher.

---

## Synthèse en une ligne

> Le projet a un design system **embryonnaire mais pas appliqué** ; une refonte
> design future coûtera **~3× plus cher** sans un pré-refactoring de 8-12 jours
> centré sur tokens couleur + 6 composants atomiques + extraction des 5
> pages-monstres.
