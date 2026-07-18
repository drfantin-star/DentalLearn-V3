# 🎨 Palette couleurs Certily — SOURCE DE VÉRITÉ

> Référence unique des couleurs de l'app. En cas de doute, **c'est ce fichier qui fait foi.**
> Toute couleur d'axe / catégorie / spécialité vient d'ici, via la fonction utilitaire unique `getCategoryStyle(slug)` (chantier unification, phase 3). Aucun hex hors du fichier de mapping.
>
> Dernière mise à jour : **18 juillet 2026** — refonte complète issue du chantier unification colorimétrique (audit Phase 0 du 18/07 + arbitrages Julie). Remplace intégralement la version du 3 juillet.

---

## 0. Doctrine (décision 2'B — 18/07/2026)

**La couleur d'une carte porte le THÈME, partout et pour tous les contenus** (formations, news, événements, chips, cartes thème). Cette règle est unique — elle s'applique identiquement à l'Axe 1, à l'Axe 3 et à l'Axe 4.

**L'axe est porté par le contexte, pas par les cartes** : headers de page (/patient orange, /sante rose), radar CP, bandeaux d'attestation, PDF.

**Le référentiel clinique est UNIQUE et partagé news ↔ formations** (décision 1A) : une spécialité news et sa catégorie formation équivalente portent la même couleur, garanti par une table d'alias dans le mapping (`dent-resto` = `restauratrice`, etc.).

> ⚠️ L'ancienne règle « un seul dégradé par axe pour les Axes 3/4 » (§3 de la version du 03/07) est **abrogée**. La surface Événements, qui l'appliquait, bascule en per-thème en phase 3.

---

## 1. Couleurs d'axe

Usage : headers de page, radar CP, bandeaux d'attestation, base couleur des PDF. **Pas les cartes de contenu** (sauf coïncidence avec une couleur de thème).

| Axe | Nom | Couleur | Hex |
|---|---|---|---|
| Axe 1 | Connaissances | violet | `#8B5CF6` |
| Axe 2 | Pratiques / EPP | teal | `#0F7B6C` |
| Axe 3 | Relation Patient | orange | `#D97706` |
| Axe 4 | Santé Praticien | rose | `#EC4899` |

Neutre système : `#6B7280` / `#4B5563` (cf. `axeColors.ts`).

---

## 2. Référentiel clinique unifié (news ↔ formations)

Dégradés `dark → light`. La colonne « alias formation » indique le slug `formations.category` équivalent : **même entrée, même couleur, par construction**.

| Slug news | Alias formation | Nom | Dégradé | Changement 18/07 |
|---|---|---|---|---|
| `odf` | *(réservé : `orthodontie`)* | ODF / Orthodontie | `#C026D3 → #E879F9` fuchsia | ✏️ CHANGÉ (ex violet = Axe 1) |
| `implanto` | `implant` | Implantologie | `#10B981 → #34D399` vert | inchangé (formations s'alignent) |
| `chir-orale` | `chirurgie` | Chirurgie orale | `#EF4444 → #F87171` rouge | inchangé (formations s'alignent) |
| `endo` | `endodontie` | Endodontie | `#6366F1 → #818CF8` indigo | inchangé (formations s'alignent) |
| `dent-resto` | `restauratrice` | Dentisterie restauratrice | `#F59E0B → #FBBF24` ambre | inchangé (formations s'alignent) |
| `paro` | `parodontologie` | Parodontologie | `#EC4899 → #F472B6` rose | inchangé (formations s'alignent) — partage assumé avec l'Axe 4 |
| `proth` | `prothese` | Prothèse | `#F97316 → #FB923C` orange | inchangé (formations s'alignent) — partage assumé avec l'Axe 3 |
| `sante-pub` | — | Santé publique | `#0284C7 → #38BDF8` ciel | ✏️ CHANGÉ (ex cyan = numerique) |
| `occluso` | — | Occlusodontie | `#65A30D → #A3E635` lime | ✏️ CHANGÉ (ex teal = Axe 2) |
| `pedo` | — | Pédodontie | `#EAB308 → #FDE047` jaune | ✏️ CHANGÉ (ex bleu Klein = soft-skills) |
| `gero` | — | Gérodontologie | `#7C2D12 → #C2410C` brun terracotta | ✏️ CHANGÉ (ex lavande ≈ Axe 1) |
| `actu-pro` | — | Actualité professionnelle | `#4B5563 → #9CA3AF` gris neutre | ✏️ CHANGÉ (ex teal = Axe 2) |
| — | `esthetique` | Esthétique | `#8B5CF6 → #A78BFA` violet | ✏️ formations réalignées sur la charte (ex indigo en code) |
| — | `numerique` | Numérique / IA | `#155E75 → #67E8F9` cyan | inchangé (seul match parfait de l'audit) |
| — | `radiologie` | Radiologie | `#1E40AF → #3B82F6` bleu acier | ✅ DÉFINI (valeur déjà présente en code, jamais posée) |

> **Réservations futures** : si une catégorie formation est créée pour une spécialité news orpheline, elle prend d'office la couleur de la spécialité (ex : `orthodontie` → fuchsia odf).
> **Sens de l'alignement (1A)** : sur les 6 paires existantes, ce sont les cartes **formation** qui changent de teinte pour rejoindre la couleur news/charte — zéro changement visuel côté news (le plus gros volume).

---

## 3. Thèmes Axe 3 — Relation Patient (8 thèmes, page /patient)

Couleurs libres par thème (doctrine 2'B). Priorité : distinction maximale entre les 8 qui se côtoient sur /patient.

| Slug | Nom | Dégradé | Note |
|---|---|---|---|
| `communication` | Communication | `#FB7185 → #FDA4AF` corail | ex orange (= proth) |
| `consentement` | Consentement | `#2563EB → #93C5FD` bleu confiance | ex ambre (= dent-resto) |
| `conflits` | Gestion des conflits | `#9F1239 → #E11D48` bordeaux | ex rouge (= chir-orale, risques-pro) |
| `decision-partagee` | Décision partagée | `#16A34A → #4ADE80` vert franc | ex amber |
| `annonce-diagnostic` | Annonce diagnostic | `#B45309 → #F59E0B` cuivre | héritage resserré |
| `education-therapeutique` | Éducation thérapeutique | `#14B8A6 → #99F6E4` menthe | ex orange foncé |
| `ethique-deontologie` | Éthique & déontologie | `#CA8A04 → #FDE68A` doré | ex ambre (≈ consentement) |
| `numerique-relation` | Numérique & relation | `#64748B → #CBD5E1` gris tech clair | neutre conservé, éclairci |

---

## 4. Thèmes Axe 4 — Santé Praticien (5 thèmes, page /sante)

| Slug | Nom | Dégradé | Note |
|---|---|---|---|
| `ergonomie` | Ergonomie | `#EC4899 → #F9A8D4` rose | héritage conservé — partage assumé avec paro / couleur d'axe |
| `stress-burnout` | Stress & burnout | `#86198F → #D946EF` prune | ex violet (= Axe 1) |
| `risques-pro` | Risques professionnels | `#EA580C → #FB923C` orange sécurité | ex rouge (= conflits) |
| `violences` | Violences | `#991B1B → #EF4444` rouge sombre | assombri vs chir-orale |
| `pratique-reflexive` | Pratique réflexive | `#7C3AED → #C4B5FD` lavande | ex indigo (= endo) — créneau libéré par gero |

---

## 5. Catégories transverses & bonus

| Slug | Nom | Dégradé | Note |
|---|---|---|---|
| `soft-skills` | Soft skills | `#1E2A9A → #3B4FD6` bleu Klein | charte 03/07 confirmée — ⚠️ **jamais répercutée en code** (toujours lime `#4D7C0F → #84CC16`), à corriger en phase 3 |
| `management` | Management | `#78716C → #A8A29E` taupe | catégorie bonus, conservée telle quelle |
| `organisation` | Organisation | `#64748B → #94A3B8` ardoise | catégorie bonus, conservée — famille grise partagée avec numerique-relation / actu-pro (contexts disjoints) |

---

## 6. Partages de famille assumés (décision 4A étendue)

Avec ~30 entrées, la roue chromatique est pleine : certains partages de **famille** de teinte entre contextes qui ne se croisent jamais sont assumés et documentés. Règle : jamais deux cartes de la même couleur côte à côte sur un même écran.

| Partage | Contextes | Statut |
|---|---|---|
| Orange | proth (clinique) / couleur d'axe Axe 3 / risques-pro (Axe 4) / cuivre annonce-diagnostic (Axe 3) | assumé — nuances distinctes |
| Rose | paro (clinique) / couleur d'axe Axe 4 / ergonomie (Axe 4) / corail communication (Axe 3) | assumé |
| Violet/fuchsia | Axe 1 / lavande pratique-reflexive / fuchsia odf / prune stress-burnout | assumé — valeurs bien séparées |
| Rouge | chir-orale (vif) / violences (sombre) / bordeaux conflits (framboise) | assumé |
| Vert | implanto (émeraude) / decision-partagee (franc) / lime occluso | assumé |
| Bleu | bleu acier radiologie / bleu confiance consentement / ciel sante-pub / bleu Klein soft-skills / cyan numerique | assumé — 5 bleus, tous distincts en valeur/saturation |
| Teal | Axe 2 / menthe education-therapeutique | assumé — menthe nettement plus claire |
| Jaune | pedo (vif) / doré ethique-deontologie | assumé |
| Gris | actu-pro / numerique-relation / organisation / neutre système | assumé — catégories à faible visibilité |

---

## 7. ⚠️ Points de vigilance & dettes actées

1. **Tokens Tailwind `axe1`–`axe4` + `src/lib/constants/axis.ts`** : système fantôme (0 usage sémantique, audit 18/07) → **SUPPRESSION en phase 3** (décision 5A). Le point de vigilance n°1 de l'ancienne charte est levé.
2. **Couleurs interdites `#2D1B96` / `#00D1C1`** : toujours vivantes via `primary`/`accent`/`ds-turquoise`/`ds-blue` (28+ fichiers), le gradient DailyQuizModal (8 occurrences) et le fallback EnrichedAudioPlayer → **hors périmètre du chantier, ticket séparé** (décision 6A).
3. **soft-skills** : bleu Klein jamais répercuté en code → phase 3.
4. **Foyers de duplication autoeval (17 fichiers) + EPP (12 fichiers)** : hex corrects mais recopiés → migration vers l'utilitaire en phase 3, **commit distinct** (décision 7A), valeurs inchangées.
5. **Bibliothèque + header /formation** : Axe 1 bleu marine `#1E40AF → #3B82F6` → passe au violet Axe 1 charte. Le bleu libéré est réattribué à **radiologie**.
6. **Événements** : `eventCategoryGradientStyle` bascule du dégradé d'axe (3/4) vers per-thème ; commentaire périmé d'`eventCategories.ts` (réf. 20260718g → 20260718i) à corriger au passage.
7. **Fusion des 3 fichiers news** (`quiz/themeColors.ts`, `news-cover.ts`, `NewsCardSVG.tsx`) dans le mapping unique — objectif fondateur du chantier.
8. **Extension future news Axes 3/4** : côté couleur, zéro travail (les 13 entrées existent) ; le travail serait dans `news_taxonomy` + le prompt de scoring Haiku.

---

## 8. Implémentation cible (phase 3)

- **Une fonction utilitaire unique** : `getCategoryStyle(slug)` → `{ from, to, badge, label }`, alimentée par UN mapping conforme à ce fichier.
- **Table d'alias** intégrée : `restauratrice → dent-resto`, `implant → implanto`, `chirurgie → chir-orale`, `endodontie → endo`, `parodontologie → paro`, `prothese → proth`.
- Remplace tous les mappings locaux : news (3 fichiers), CATEGORY_CONFIG (dégradés), événements, bibliothèque.
- **Aucun hex de catégorie/axe hors du fichier de mapping.**
- Vérification : `npx next build` + smoke visuel des 4 familles de cartes (formations, news, événements, bibliothèque) desktop + mobile, pages /patient et /sante incluses.

---

## Historique des décisions (18/07/2026)

| Code | Décision |
|---|---|
| 1A | CATEGORY_CONFIG s'aligne sur les couleurs news/charte (référentiel clinique unique) |
| 2 + 2'B | Couleur = thème partout, y compris Axes 3/4 (couleurs libres) ; règle « un dégradé par axe » abrogée |
| 3C | Recoloration des 5 collisions news (odf, occluso, pedo, sante-pub, gero) + actu-pro |
| 4A | Partages de famille inter-contextes tolérés et documentés (§6) |
| 5A | Suppression tokens axe1–4 + axis.ts |
| 6A | Couleurs interdites #2D1B96/#00D1C1 → ticket séparé |
| 7A | Foyers autoeval/EPP migrés en phase 3, commit distinct |
| — | Radiologie = bleu acier ; gero = brun terracotta (gero-C) |
