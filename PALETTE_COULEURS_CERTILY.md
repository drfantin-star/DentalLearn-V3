# 🎨 Palette couleurs Certily — SOURCE DE VÉRITÉ

> Référence unique des couleurs de l'app. En cas de doute, **c'est ce fichier qui fait foi.**
> Toute couleur d'axe / catégorie doit venir d'ici (idéalement via les tokens Tailwind), jamais d'un hex tapé au hasard dans un composant.
>
> Dernière mise à jour : 3 juillet 2026.

---

## 1. Couleurs d'axe (référence charte)

| Axe | Nom | Couleur | Hex |
|---|---|---|---|
| Axe 1 | Connaissances | violet | `#8B5CF6` |
| Axe 2 | Pratiques / EPP | teal | `#0F7B6C` |
| Axe 3 | Relation Patient | orange | `#D97706` |
| Axe 4 | Santé Praticien | rose | `#EC4899` |

---

## 2. Axe 1 — sous-catégories cliniques (chaque catégorie a SON dégradé)

| Catégorie | Dégradé | Hex |
|---|---|---|
| Esthétique | violet | `#8B5CF6 → #A78BFA` |
| Dentisterie Restauratrice | amber | `#F59E0B → #FBBF24` |
| Chirurgie Orale | rouge / rose | `#EF4444 → #F87171` |
| Implantologie | vert | `#10B981 → #34D399` |
| Prothèse | orange | `#F97316 → #FB923C` |
| Parodontologie | rose | `#EC4899 → #F472B6` |
| Endodontie | indigo | `#6366F1 → #818CF8` |
| Numérique / IA | cyan | `#155E75 → #67E8F9` |
| Radiologie | **à définir** | — |

---

## 3. Axes 2, 3, 4 — un seul dégradé par axe (pas de couleur par catégorie)

| Axe | Dégradé de page | Hex |
|---|---|---|
| Axe 2 — Pratiques / EPP | teal | (couleur d'axe `#0F7B6C`) |
| Axe 3 — Relation Patient | orange | `#F97316 → #FBBF24` |
| Axe 4 — Santé Praticien | rose → violet | `#EC4899 → #A78BFA` |

> Les catégories de l'Axe 3 (communication, consentement, conflits, décision-partagée…) **partagent toutes** le dégradé orange de l'axe.
> Idem Axe 4 (ergonomie, stress-burnout, risques-pro, violences, pratique-réflexive) → dégradé rose/violet.

---

## 4. Catégories transverses

| Catégorie | Dégradé | Hex |
|---|---|---|
| soft-skills | **bleu Klein** (nouvelle définition, 03/07/2026) | `#1E2A9A → #3B4FD6` |

---

## 5. Mapping utilisé pour les CARTES FORMATION (champ `formations.category`)

Couleur du dégradé de chaque carte formation, selon la valeur `category` en base :

| `category` (base) | Dégradé | Hex |
|---|---|---|
| `esthetique` | violet | `#8B5CF6 → #A78BFA` |
| `restauratrice` | amber | `#F59E0B → #FBBF24` |
| `numerique` | cyan | `#155E75 → #67E8F9` |
| `communication` | orange (Axe 3) | `#F97316 → #FBBF24` |
| `consentement` | orange (Axe 3) — carte sans objet | `#F97316 → #FBBF24` |
| `soft-skills` | bleu Klein | `#1E2A9A → #3B4FD6` |

---

## 6. ⚠️ Points de vigilance (à réconcilier, PAS en urgence)

1. **Tokens code ≠ charte.** Dans `tailwind.config.ts`, `axe1 = #2D1B96` (bleu foncé) et non le violet `#8B5CF6` de la charte. À corriger à froid, **après un audit** des endroits qui utilisent ces tokens, pour ne rien casser.
2. **Orange partagé.** L'orange sert à la fois à l'Axe 3 (communication, consentement…) ET à la catégorie Prothèse (Axe 1). Deux formations d'axes différents peuvent donc être orange — c'est voulu par le système actuel, mais à garder en tête.
3. **Radiologie** : dégradé encore à définir.
