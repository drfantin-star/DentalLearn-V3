# RECAP Session — POC Visualisation Audio T4 (Bibliothèque whiteboard complète)

**Date** : 7 mai 2026
**Durée session** : ~1 journée
**Tickets traités** : POC-T4.1, POC-T4.2, POC-T4.3 (3 sous-tickets, 6 templates whiteboard livrés)
**Spec de référence** : `spec_poc_visualisation_audio_v1_0.md` §5 (templates whiteboard) + §10 Ticket 4
**Sessions précédentes** :
- `RECAP_SESSION_POC_AUDIO_T1_T2_05MAI2026.md` (BDD, Storage, pipeline Python)
- `RECAP_SESSION_POC_AUDIO_T3_06MAI2026.md` (karaoké React + schéma Timeline T3)

**Branches mergées sur main** :
- T4.1 — `claude/whiteboard-foundations-ZRceq` (squash-merged)
- T4.2 — `claude/poc-t4-2-whiteboard-linear` (squash-merged)
- T4.3 — `claude/add-causal-template-8c8ri` (squash-merged)

**Statut global** : ✅ Validé et mergé. Bibliothèque whiteboard COMPLÈTE.

---

## Sommaire

- [1. Périmètre livré (vue d'ensemble)](#1-périmètre-livré-vue-densemble)
- [2. T4.1 — Foundations](#2-t41--foundations-getactivescene--grid--figures--wrapper)
- [3. T4.2 — Templates linéaires](#3-t42--templates-linéaires-flowchart--comparison--timeline)
- [4. T4.3 — Causal](#4-t43--causal-graphe-nodesedges)
- [5. Décisions arbitrées (référence pour T5/T7/T8)](#5-décisions-arbitrées-référence-pour-t5t7t8)
- [6. Schéma Timeline — état après T4 + divergences vs spec POC v1.0](#6-schéma-timeline--état-après-t4--divergences-vs-spec-poc-v10)
- [7. Patterns techniques retenus](#7-patterns-techniques-retenus)
- [8. Dettes loggées](#8-dettes-loggées)
- [9. Tickets restants POC](#9-tickets-restants-poc)
- [10. Prompt d'amorçage — Nouvelle session T5](#10-prompt-damorçage--nouvelle-session-t5)

---

## 1. Périmètre livré (vue d'ensemble)

Bibliothèque de **6 templates whiteboard structurés** (HTML/CSS + framer-motion) consommables par `<EnrichedAudioPlayer>` (T7, formations user) et `<NewsVisualSequence>` (T8, news user). Tous responsive desktop + mobile, animations cohérentes, schéma Zod étendu de manière strictement additive (rétro-compatible avec les payloads T3).

### Composants livrés (8 fichiers nouveaux)

| Fichier | Rôle |
|---|---|
| `src/lib/timeline/getActiveScene.ts` | Helper pur, sélection de scène active selon `currentTime`. JSDoc + 15 cas documentés en `.spec-cases.md`. |
| `src/components/audio-enriched/StructuredWhiteboard.tsx` | Wrapper, sélection du sous-template selon `template.kind`, AnimatePresence transitions, throttle 2 Hz. |
| `src/components/audio-enriched/templates/Grid.tsx` | Grille N colonnes responsive, stagger 100ms, COLS_CLASS map pour purge JIT. |
| `src/components/audio-enriched/templates/Figures.tsx` | Chiffres clés horizontaux (desktop) / verticaux (mobile), pulse infini sur `emphasis`. |
| `src/components/audio-enriched/templates/Flowchart.tsx` | Étapes en chaîne avec flèches SVG. Vertical forcé en mobile, horizontal en md+ (selon prop). |
| `src/components/audio-enriched/templates/Comparison.tsx` | 2 colonnes côte à côte (desktop) / stack vertical (mobile), divider central conditionnel. |
| `src/components/audio-enriched/templates/Timeline.tsx` | Frise chronologique : mode `events` (préféré, frise horizontale → liste verticale en mobile) + mode `steps` (legacy fallback). |
| `src/components/audio-enriched/templates/Causal.tsx` | Graphe `nodes/edges` avec layout déterministe selon nombre (2=ligne, 3=triangle, 4=losange, 5=pentagone). Mode legacy `cause/effects` également supporté. Mobile = chaîne verticale. |

### Fichiers étendus (additivement)

| Fichier | Modifications |
|---|---|
| `src/lib/timeline/schema.ts` | +60 lignes additives. `CardContent.variant` (T4.1), `Figures.items[].emphasis` (T4.1), `Flowchart.orientation` (T4.2), `Timeline.events[]` (T4.2), `Causal.nodes/edges` (T4.3) avec `.refine()` validateur cross-fields. |
| `src/lib/timeline/mocks/whiteboard-scenes.mock.ts` | 6 scènes étalées sur 100s, contenu pédagogique réel (dent fêlée, tenons, protocole soin). |
| `src/app/admin/poc/whiteboard-templates/page.tsx` | Server Component, `isSuperAdmin` server-side de `@/lib/auth/rbac`, `redirect('/')`. Pattern identique à `news/sources` et `poc/karaoke`. |
| `src/app/admin/poc/whiteboard-templates/WhiteboardTemplatesPOCClient.tsx` | Client component, slider 0-100s pour test `getActiveScene` + galerie isolée 6 cards live. |

### Total sur les 3 sous-tickets

- **+1857 lignes ajoutées** sur les 3 PRs (5 commits T4.2 + 3 commits T4.3 + 1 commit T4.1)
- **0 nouvelle dépendance npm** (framer-motion et zod déjà présents post-T3)
- **0 modification de `src/context/AudioContext.tsx`** (DPC + anti-skip strictement préservés)
- **0 occurrence de `localStorage` / `sessionStorage`** dans les fichiers livrés
- **`npx tsc --noEmit`** passe sur les 3 PRs

---

## 2. T4.1 — Foundations (getActiveScene + Grid + Figures + wrapper)

**Branche** : `claude/whiteboard-foundations-ZRceq` mergée le 7 mai 2026

### Livrables

- Helper pur `getActiveScene(currentTime, scenes): Scene | null` — règle "la scène avec `start_sec ≤ currentTime ≤ end_sec` la plus récente".
- Spec-cases markdown : 15 cas documentés (vide, bornes, gap, chevauchement, non-trié, etc.).
- `<StructuredWhiteboard>` wrapper avec `AnimatePresence mode="wait"`, throttle via `useMemo(..., [Math.floor(currentTime * 2), scenes])` (2 Hz suffit pour scènes 20-45s).
- Grid + Figures live avec animations cascade (stagger 100ms / 150ms).
- Page démo `/admin/poc/whiteboard-templates` avec slider et galerie isolée.
- Mock complet 6 scènes étalées sur 100s (3 scènes T4.1 actives + 3 placeholders pour T4.2/T4.3).

### Décisions techniques

- **Schéma T3 réel ≠ spec POC littérale** : Claude Code a adapté les composants aux types T3 (`start_sec/end_sec` au lieu de `trigger_at_sec/display_duration_sec`, `columns` au lieu de `cols`, `figures` au lieu de `items`). Extension additive `variant` et `emphasis` apportée.
- **Tokens design custom DentalLearn** au lieu de `bg-gray-50/bg-white/purple-50` de la spec littérale (cohérence avec T3 thème dark).
- **Placeholders explicites** pour les 4 templates non livrés en T4.1 ("Template `flowchart` — à livrer T4.2") au lieu de masquer les scènes correspondantes — permet de tester `getActiveScene` sur l'ensemble de la timeline mockée dès T4.1.

### Itérations / corrections

Aucune correction post-merge nécessaire. La PR a été mergée d'un coup après vérification visuelle desktop OK.

⚠️ **Investigation initiale "schéma divergent" — fausse alerte** : Au moment d'attaquer T4.2, j'ai cru détecter une réécriture du schéma T3 par T4.1 (start_sec/end_sec, cause/effects au lieu de nodes/edges, etc.). En réalité, le schéma T3 mergé sur main contenait déjà ces choix de simplification — pas une régression T4.1. Diagnostic confirmé après mise à jour de main local et inspection du diff (11 lignes ajoutées additivement sur schema.ts, 0 supprimée). Pas de patch correctif nécessaire.

---

## 3. T4.2 — Templates linéaires (Flowchart + Comparison + Timeline)

**Branche** : `claude/poc-t4-2-whiteboard-linear` (5 commits) mergée le 7 mai 2026

### Phasage en 3 commits + responsive sweep

Le ticket a été découpé en commits intermédiaires successifs avec validation visuelle entre chaque. Stratégie utile vu les 3 templates indépendants à livrer.

| Commit | Sujet |
|---|---|
| `a9fe700` | Schema additif (`Flowchart.orientation`, `Timeline.events[]` + refine `steps OU events`) + composants Flowchart & Comparison |
| `0ea4077` | Wiring intermédiaire Flowchart + Comparison dans wrapper + galerie (validation visuelle ici) |
| `38d43bb` | Timeline template avec mode dual desktop frise / mobile liste verticale |
| `29de80f` | Wiring Timeline + galerie complète |
| `cf0daf8` | **Phase 6 responsive sweep** sur les 5 templates (Grid breakpoints, Figures flex-col mobile, Flowchart vertical auto en mobile) |

### Livrables clés

**Schéma additif** :
- `Flowchart.orientation: 'horizontal' | 'vertical'` optionnel (défaut `horizontal` côté composant)
- `Timeline.events[]: { at_label, text }` optionnel + refine cross-field "steps OU events requis"

**Templates** :
- `Flowchart` — flèches SVG via `<defs><marker>` réutilisable. Stagger card-flèche-card-flèche.
- `Comparison` — schéma T3 enrichi `{ left: { title, cards[] }, right: { title, cards[] } }` (plus riche que la spec littérale `left: CardContent`). Conservé.
- `Timeline` — mode dual : frise horizontale (axe + dots + labels alternés au-dessus/en-dessous) sur desktop ; liste verticale type "fil d'événements" (dot + barre verticale + texte à droite) sur mobile.

### Décision responsive (Phase 6)

Suite à validation visuelle T4.1 + retour Dr Fantin :

> *"Le but de ces visualisations audio c'est pour que ça apparaisse côté front user, pas dans le backoffice. Backoffice pas responsive obligatoirement, mais partie user formations/home/news en mode responsive."*

Cohérent avec spec POC v1.0 §0.2 + dette D23. **Décision actée** :
- ✅ Les **composants** sont responsive (consommables T7/T8 user).
- ❌ La **page admin POC** reste cassée en mobile (acceptable, validation via masquage sidebar via console DevTools).

Méthode de validation visuelle mobile :
```javascript
document.querySelectorAll('aside, nav').forEach(el => el.style.display = 'none')
```

### Validation visuelle

| Vue | Statut |
|---|---|
| Desktop section 1 (slider) | ✅ |
| Desktop section 2 (galerie) | ✅ |
| Mobile composants (sans sidebar admin) | ✅ — Grid 2×2, Figures stack vertical, Flowchart vertical auto, Comparison stack vertical, TimelineTemplate fil d'événements |

---

## 4. T4.3 — Causal (graphe nodes/edges)

**Branche** : `claude/add-causal-template-8c8ri` (3 commits) mergée le 7 mai 2026

⚠️ Le nom de branche imposé par le tooling Claude Code (`claude/add-causal-template-8c8ri`) diffère de celui demandé dans le prompt (`claude/poc-t4-3-causal-template`). Sans impact — le contenu est conforme.

### Livrables

| Commit | Sujet |
|---|---|
| `8476a85` | Schema additif (nodes/edges + refine validation cross-field stricte) |
| `111cd5c` | Composant Causal dual graph/star, responsive desktop/mobile |
| `e3e46c8` | Wiring + mock dent fêlée mode `nodes+edges` + galerie complète |

### Schéma additif `CausalTemplateSchema` — choix retenu : option (a)

Trois options évaluées, **option (a)** retenue :

- **(a)** ✅ Étendre additivement avec `nodes?` et `edges?` en plus de `cause?/effects?` legacy. Validation `.refine()` accepte EITHER `(cause+effects)` OR `(nodes[≥2 with id]+edges referencing those ids)`.
- (b) Refactor breaking `cause/effects → nodes/edges` (refusé : aucun gain, casse compat).
- (c) Garder uniquement legacy `cause/effects` (refusé : dégrade la spec POC).

**Validation `.refine()` cross-field** :
- Mode legacy valide : `cause && effects.length > 0`
- Mode graphe valide : `nodes.length >= 2` AND tous les nodes ont un `id` AND toutes les `edges.from/to` référencent un `id` existant
- Sinon rejet

6 cas Zod testés (3 valides : legacy / graphe / diamond — 3 rejetés : vide / sans id / edge orpheline).

### Composant Causal

**Layout déterministe desktop selon `nodes.length`** :

| Nombre | Layout |
|---|---|
| 2 | Ligne horizontale |
| 3 | Triangle (haut centre + bas-gauche + bas-droite) |
| 4 | Losange (haut/gauche/droite/bas) |
| 5 | Pentagone (ordre horaire) |

Container `aspect-[4/3] w-full` avec viewBox SVG `0 0 100 75`. Cards positionnées en absolute via percentages. Edges en `<motion.line>` avec `pathLength: 0 → 1` animation (effet "dessin"). Labels d'edges optionnels avec fond simulé via `<rect>` derrière le `<text>`.

**Layout mobile** : chaîne verticale empilée. Ordre des nodes = ordre du tableau (simplification topologique acceptable POC). Si une edge existe entre 2 nodes consécutifs avec un label, ce label apparaît centré sur le trait vertical en italique.

**Animations en 3 phases** :
1. Cascade nodes (stagger 200ms, scale 0.9 → 1)
2. Tracé des edges (`pathLength` 600ms, démarrage post-cascade)
3. Labels d'edges en fondu après tracé

### Mock 70-85s mis à jour en mode `nodes + edges`

```typescript
{
  kind: 'causal',
  nodes: [
    { id: 'n1', text: 'Stress occlusal répété' },
    { id: 'n2', text: 'Microfissure émail' },
    { id: 'n3', text: 'Propagation dentine' },
    { id: 'n4', text: 'Fracture complète', variant: 'warning' },
  ],
  edges: [
    { from: 'n1', to: 'n2', label: 'fatigue' },
    { from: 'n2', to: 'n3' },
    { from: 'n3', to: 'n4', label: 'si non traité' },
  ],
}
```

### Validation visuelle

| Vue | Statut |
|---|---|
| Desktop standard (galerie ~600px) | ✅ Losange compact lisible |
| Desktop très large (>1600px, page slider) | ⚠️ Très étalé, edges en longues diagonales — cf. dette **POC-T4-D5** |
| Mobile (iPhone 14 Pro, sans sidebar) | ✅ Chaîne verticale impeccable, labels italiques, variants OK |

---

## 5. Décisions arbitrées (référence pour T5/T7/T8)

| Code | Sujet | Décision | Justification |
|---|---|---|---|
| **T4-D1** | Tokens design | DentalLearn custom (`ds-turquoise`/`axe3`/`emerald-500`) au lieu de spec littérale (`purple-50`/`amber-50`) | Le projet n'utilise pas shadcn/ui, thème dark forcé depuis T3 |
| **T4-D2** | Découpage T4 | 3 sous-tickets séquentiels (foundations / linéaires / causal) | Pinçage des bugs visuels au plus tôt sur templates complexes |
| **T4-D3** | Layout Causal | Déterministe (cercle/triangle/losange/pentagone) | Force-directed coûteux et fragile pour POC, illisible >5 nodes |
| **T4-D4** | Page démo POC | `/admin/poc/whiteboard-templates` avec auth `isSuperAdmin` | Pattern T3 (`/admin/poc/karaoke`) reproduit |
| **T4-D5** | Mock format | Une fausse Timeline avec 6 scènes étalées sur 100s + slider sur la page démo | Permet de tester `getActiveScene` ET les transitions framer-motion en condition réelle |
| **T4-D6** | Schéma divergent vs spec POC | Conservation du schéma T3 + extensions additives par sous-ticket (variant/emphasis T4.1, orientation/events T4.2, nodes/edges T4.3) | Rétro-compat T3 préservée, pas de breaking change |
| **T4-D7** | Responsive scope | Composants OUI, page admin POC NON | Cohérent spec §0.2 + dette D23 + retour Dr Fantin |
| **T4-D8** | Causal mode mobile | Chaîne verticale ordre du tableau, perte topologie acceptable | 430px illisible pour vrai graphe ; cohérent Flowchart vertical en mobile |
| **T4-D9** | Naming `<TimelineTemplate>` | Composant exporté sous nom `TimelineTemplate` (pas `Timeline`) | Évite collision avec type `Timeline` racine du schéma JSON |

---

## 6. Schéma Timeline — état après T4 + divergences vs spec POC v1.0

### État actuel `src/lib/timeline/schema.ts` (post-T4.3 mergé)

```typescript
type Scene = {
  id: string;
  start_sec: number;          // ⚠️ T3 utilise start_sec/end_sec
  end_sec: number;            //    spec POC v1.0 dit trigger_at_sec + display_duration_sec
  title?: string;             // optionnel (spec dit requis)
  template: SceneTemplate;
  // pedagogical_intent absent (spec dit optionnel)
};

type CardContent = {
  text: string;               // max 60 chars
  subtitle?: string;          // max 40 chars
  icon?: string;              // hors spec, conservé
  variant?: 'highlight' | 'warning' | 'success';  // T4.1 additif
  // pas d'`id` requis sur CardContent en général
  // (Causal.nodes ajoute `id?: string` requis via .refine())
};

type SceneTemplate =
  | { kind: 'flowchart'; cards: CardContent[]; orientation?: 'horizontal' | 'vertical' }  // T4.2
  | { kind: 'grid'; columns: number; cards: CardContent[] }
  | { kind: 'comparison'; left: { title: string; cards: CardContent[] }; right: { title: string; cards: CardContent[] } }
  | {
      kind: 'causal';
      cause?: CardContent;        // legacy
      effects?: CardContent[];    // legacy
      nodes?: Array<CardContent & { id?: string }>;  // T4.3 additif
      edges?: Array<{ from: string; to: string; label?: string }>;  // T4.3
    }
  | { kind: 'figures'; figures: Array<{ value: string; label: string; emphasis?: boolean }> }  // T4.1 emphasis
  | { kind: 'timeline'; steps?: CardContent[]; events?: Array<{ at_label: string; text: string }> };  // T4.2 events

type TimelineConcept = {
  id: string;
  label: string;
  start_sec: number;
  end_sec: number;
  importance?: number;
};
// ⚠️ spec POC v1.0 dit Concept.term/definition/at_sec/at_word_index/source — DIVERGENT
```

### Tableau divergences vs spec POC v1.0

| Élément | Spec POC v1.0 | Schéma actuel post-T4 | Statut |
|---|---|---|---|
| `Scene` timing | `trigger_at_sec` + `display_duration_sec` | `start_sec` + `end_sec` | Équivalent fonctionnel — le composant `getActiveScene` calcule pareil |
| `Scene.title` | requis | optionnel | Légère divergence, sans impact |
| `Scene.pedagogical_intent` | optionnel (debug édition admin) | absent | À ajouter quand T6 (éditeur) sera implémenté |
| `TimelineConcept` | `term/definition/at_sec/at_word_index/source` | `id/label/start_sec/end_sec/importance` | 🔴 **DIVERGENT** — à résoudre avant T5 (LLM) ou T3-bis (`ConceptBadges`) |
| `CardContent.id` | requis | absent (sauf Causal.nodes via `.refine()`) | Cohérent avec usage actuel |
| `Flowchart` | `steps + orientation` | `cards + orientation?` | Renaming `cards`/`steps` sans impact |
| `Grid` | `cols: 2 \| 3 \| 4` | `columns: number` | Renaming + plus permissif (validation runtime côté composant) |
| `Comparison` | `left: CardContent` simple | `left: { title, cards[] }` enrichi | Notre version est plus riche, conservée |
| `Causal` | `nodes + edges` uniquement | `cause/effects` legacy + `nodes/edges` additif | Compatible spec via mode `nodes/edges` |
| `Figures` | `items + emphasis` | `figures + emphasis` | Renaming sans impact |
| `Timeline` | `events: { at_label, text }` | `steps?` legacy + `events?` additif | Compatible spec via mode `events` |

### Implications pour T5

L'agent LLM Claude Sonnet (T5) va générer des outputs JSON. Décision à prendre au moment du prompt T5 :

- **Option A** : Aligner le prompt LLM sur le schéma actuel (champs : `start_sec/end_sec`, `cards`, `columns`, `figures`, mode `events` et `nodes/edges` modernes). C'est la cohérence avec le code livré.
- **Option B** : Aligner le prompt LLM sur la spec POC littérale (`trigger_at_sec`, `steps`, `cols`, `items`, etc.) puis mapper côté serveur après réception. C'est la cohérence avec la spec.
- **Option C** : Réécrire le schéma post-T4 pour matcher la spec POC littérale, mettre à jour les composants. Cassant.

Recommandation préliminaire (à confirmer en début de T5) : **Option A**, le schéma actuel est la vérité opérationnelle. Le prompt LLM doit produire des champs qui passent `TimelineSchema.parse()` directement.

### Concept schema — sujet ouvert pour T3-bis ou T5

Le format `TimelineConcept` actuel (`id/label/start_sec/end_sec/importance`) ne matche pas la spec (`term/definition/at_sec/at_word_index/source`). Aucun composant `<ConceptBadges>` n'est encore livré (T3-bis reporté). Décision à prendre :

- Si T5 livre les concepts en même temps que les scenes (ce que dit la spec §6), il faudra trancher au moment du prompt T5.
- Sinon, T3-bis devra être préfacé par un patch additif sur `TimelineConcept` pour ajouter `term/definition/at_sec/source` optionnels.

---

## 7. Patterns techniques retenus

### Animations framer-motion

- **Throttle dans le wrapper** : `useMemo(() => getActiveScene(currentTime, scenes), [Math.floor(currentTime * 2), scenes])` — recalcul 2 Hz suffisant pour scènes qui durent 20-45s.
- **Transitions entrée/sortie** : `<AnimatePresence mode="wait">` au niveau du wrapper. Entrée `opacity 0→1, y 8→0` 400ms easing `[0.4, 0, 0.2, 1]`, sortie `opacity 1→0` 300ms.
- **Cascade interne aux templates** : stagger via `delay: index * NNN` (Grid 100ms, Figures 150ms, Flowchart 200ms incluant flèches, Timeline 200ms, Causal 200ms).
- **`pathLength` SVG** (Causal edges) : `<motion.line initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay }}>` — effet "dessin" très propre.
- **Pulse infini** (Figures emphasis) : `animate={{ scale: [1, 1.04, 1] }}` avec `repeat: Infinity, duration: 2.5`.

### Tailwind purge JIT — pièges évités

- **Toujours préférer un mapping explicite** quand une classe dépend d'une variable :
  ```typescript
  const COLS_CLASS: Record<2 | 3 | 4, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  }
  ```
  Plutôt que `grid-cols-${cols}` qui ne sera pas détecté par le purge.
- **`bg-emerald-500/15`** ✅ autorisé. **`bg-emerald-50`** ❌ interdit (pastel light theme spec littérale).

### Responsive — pattern dual `hidden md:block`

Pour les composants à comportement dual desktop/mobile (Timeline `events` mode, Causal graph mode) :

```tsx
return (
  <>
    <div className="hidden md:block">{renderDesktop()}</div>
    <div className="md:hidden">{renderMobile()}</div>
  </>
)
```

Plus lisible que les conditions JS sur viewport, et SSR-safe.

### Auth super_admin server-side

Pattern strict pour pages admin POC, identique T3/T4 :

```typescript
// page.tsx (Server Component)
import { redirect } from 'next/navigation'
import { isSuperAdmin } from '@/lib/auth/rbac'

export default async function Page() {
  const allowed = await isSuperAdmin()
  if (!allowed) redirect('/')
  return <ClientComponent />
}
```

### Validation Zod cross-field via `.refine()`

Cas Causal (T4.3) : valider que les `edges.from/to` référencent des `nodes.id` existants nécessite un `.refine()` qui accède à plusieurs champs. Pattern :

```typescript
.refine(
  (t) => {
    if (t.cause && t.effects?.length) return true  // legacy OK
    if (t.nodes && t.nodes.length >= 2) {
      const allHaveId = t.nodes.every((n) => typeof n.id === 'string' && n.id.length > 0)
      if (!allHaveId) return false
      const ids = new Set(t.nodes.map((n) => n.id as string))
      return (t.edges ?? []).every((e) => ids.has(e.from) && ids.has(e.to))
    }
    return false
  },
  { message: '...' },
)
```

⚠️ Zod 4 supporte `.refine()` à l'intérieur d'un `discriminatedUnion` — confirmé en T4.3. En cas de problème de typage, possible de remonter le `.refine()` au niveau du `SceneSchema` parent.

### Workflow validation visuelle Vercel preview + DevTools mobile

1. Push branche → Vercel build automatique → URL preview reçue via webhook GitHub.
2. Validation desktop d'abord (slider sur tous les timestamps + galerie isolée).
3. Validation mobile via DevTools iPhone 14 Pro (430×932) **avec masquage sidebar admin** :
   ```javascript
   document.querySelectorAll('aside, nav').forEach(el => el.style.display = 'none')
   ```
4. Captures screenshot pour archivage et reporting.

### Workflow Claude Code — commits intermédiaires avec validation

Stratégie efficace pour T4.2 (3 templates indépendants) :

1. Phase A : code des composants (sans wiring) → push intermédiaire
2. Phase B : wiring partiel + validation visuelle utilisateur
3. Phase C : composants restants + wiring final
4. Phase finale : sweep responsive

Évite les gros diffs reviewer + permet pinçage de bugs avant accumulation.

---

## 8. Dettes loggées

| Code | Dette | Origine | Priorité | À traiter quand |
|---|---|---|---|---|
| **POC-T3-D4** | Pipeline Python ElevenLabs concatène les chunks audio sans header Xing/LAME → seek JS partiellement cassé sur les MP3 produits | T3 | Moyenne | Avant T7 (intégration formation user, où seek natif compte) |
| **POC-T4-D5** | `<Causal>` n'a pas de `max-width` interne. Sur écrans très larges (>1600px) en mode graphe, rendu très étalé avec edges en longues diagonales et labels flottants | T4.3 | Faible (cosmétique) | Pendant T7 (`<EnrichedAudioPlayer>` imposera un `max-w-3xl` ou similaire sur le container parent) |
| **POC-T4-D6** | Concept schema `TimelineConcept` divergent vs spec POC v1.0. Format actuel `{id, label, start_sec, end_sec, importance}` vs spec `{term, definition, at_sec, at_word_index, source}` | T3 (héritage), confirmé T4 | Moyenne | À trancher en début de T5 (le LLM produit-il les concepts ?) ou T3-bis (`ConceptBadges`) |
| **POC-T4-D7** | Page admin POC `/admin/poc/whiteboard-templates` non responsive (sidebar fixe pollue 50% du viewport mobile). Validation mobile possible uniquement via masquage console | T4.2 | Faible | Post-POC selon retours testeurs (cohérent dette D23 spec POC) |
| **POC-T4-D8** | `Scene.pedagogical_intent` (spec POC §2.1) absent du schéma actuel. Champ optionnel utile en édition admin pour debug LLM | T3 (héritage) | Faible | À ajouter additivement quand T6 (éditeur timeline) sera implémenté |
| **POC-T4-D9** | Causal en mobile perd la topologie réelle du graphe (rend en chaîne linéaire ordre du tableau). Si la topologie a plusieurs entrants/sortants, info dégradée | T4.3 | Faible (acceptable POC) | Post-POC, si retour testeurs montre que c'est gênant. Solution future : rendu en arbre vertical avec connecteurs explicites |
| **POC-T4-D10** | Pas de framework de test installé dans le repo. 24 cas documentés en markdown (`.spec-cases.md`) pour `findCurrentWord` (T3 = 9 cas) et `getActiveScene` (T4.1 = 15 cas) — portables en Jest le jour où | T3+T4 | Faible | Backlog amélioration dev |

---

## 9. Tickets restants POC

| Ticket | Statut | Effort estimé | Priorité | Dépendances |
|---|---|---|---|---|
| **T2-v2** | À planifier (POC-T3-D4 fix Xing/LAME) | 30-60 min | Moyenne | Avant T7 idéalement |
| **T5** : Agent extraction structurelle (LLM Claude Sonnet) | À démarrer | 2-3 jours | 🔴 Haute | T4 ✅ |
| **T6** : Page admin éditeur timeline | À démarrer après T5 | 2-3 jours | 🟠 Moyenne | T5 |
| **T3-bis** : ConceptBadges | Reporté avec T5 ou T6 | 0,5 jour | 🟡 Basse | T5 (concepts produits par LLM) |
| **T7** : `<EnrichedAudioPlayer>` + intégration formation user | À démarrer après T4-T6 | 1-2 jours | 🔴 Haute | T4 ✅, T5, T6 |
| **T8** : `<NewsVisualSequence>` + génération auto news | À démarrer après T4 | 1-1,5 jour | 🔴 Haute | T4 ✅ (peut démarrer en parallèle T5/T6) |
| **T9** : Tests utilisateurs + doc + smoke prod | Final | 1 jour | 🔴 Haute | Tous les autres |

### Ordonnancement recommandé pour la suite

**Sprint POC restant (~2 semaines)** :

1. **T5** (agent LLM extraction) — gros morceau, nécessite calibrage de prompt itératif
2. **T6** (éditeur admin) en parallèle ou après T5
3. **T8** (news déterministe) en parallèle de T5/T6 — pas de dépendance LLM, juste une fonction pure `buildNewsTimeline()` côté serveur
4. **T7** (intégration formation user) après T5/T6 — c'est l'aboutissement
5. **T2-v2** en intercalaire avant T7 si on veut un seek propre
6. **T3-bis** en bonus si concepts intéressants côté UX
7. **T9** clôture POC

### Décisions à confirmer en début de T5

| # | Sujet | Recommandation |
|---|---|---|
| Q1 | Format JSON sortie LLM | Aligner sur schéma actuel post-T4 (option A §6) |
| Q2 | Concepts produits par T5 ou par T3-bis ? | Par T5 (économise un appel LLM, cohérent spec §6) |
| Q3 | Concept schema à patcher | Si T5 produit concepts, additif `term/definition/at_sec/source` à ajouter avant développement |
| Q4 | Pattern `{"limit": N}` POST body bounding | Reproduire (cf. dette news pipeline IDLE_TIMEOUT 150s) |
| Q5 | Modèle LLM | `claude-sonnet-4-6` (cohérence pipeline news + budget input/output tokens) |

---

## 10. Prompt d'amorçage — Nouvelle session T5

```
Contexte du projet
Tu es l'assistant IA du projet DentalLearn, application mobile et web de formation continue contexte certification périodique pour chirurgiens dentistes. Concept inspiré de Duolingo et Kahoot. Format principal podcast audio + quizz récap + fiches pratiques. Section news podcast en parallèle.
Porteur : Dr Julie Fantin (Dentalschool).

Tes rôles principaux

1. Architecte technique :
- Stack PWA (Next.js 14 / TypeScript / Tailwind / Supabase / Vercel)
- Conseiller composants performants
- Sécurité et conformité RGPD/DPC

2. Développeur avec Claude Code :
- Composants React réutilisables
- Edge Functions Supabase / Routes API Next.js
- IMPORTANT : jamais localStorage/sessionStorage → React state uniquement

3. Conseiller stratégique :
- Prioriser fonctionnalités MVP
- Optimiser UX/UI pour engagement

Principes de travail

Développement :
- Code propre, commenté, maintenable
- Modifications additives, jamais destructives
- Préserver intégralement `src/context/AudioContext.tsx` (DPC tracking + anti-skip intact)
- Mobile-first responsive design pour TOUT composant côté user (formations/home/news)
- Backoffice admin pas obligatoirement responsive

Communication :
- Langage clair et professionnel
- Proposer des options avec avantages/inconvénients
- Alerter sur les risques ou limitations techniques
- Pour chaque ticket impliquant du visuel ou du fonctionnel : prévoir un protocole de test pas à pas pour Dr Fantin (qui n'est pas développeuse) avec explications des manipulations console / Vercel si nécessaires

Contraintes techniques critiques

❌ JAMAIS :
- localStorage ou sessionStorage (non supporté)
- Modification de `src/context/AudioContext.tsx` (DPC/anti-skip)
- Audio playback speed controls (no 0.8x / 1x / 1.5x)

✅ TOUJOURS :
- React state pour stockage
- TypeScript strict
- Réutilisation framer-motion (déjà installé) + zod (ajouté T3)
- ⚠️ Pour vérifier la structure d'une table BDD : TOUJOURS interroger Supabase directement via le connecteur MCP. Ne pas se fier à `DATABASE_SCHEMA.md` qui est statique et potentiellement obsolète.
- Path correct : `src/context/AudioContext.tsx` (SINGULIER, pas `contexts/`)
- Pattern `{"limit": N}` POST body bounding pour Edge Function avec batch LLM (IDLE_TIMEOUT 150s)

---

État actuel du POC visualisation audio (post-T4)

Tickets livrés et mergés sur main :
- ✅ POC-T1 : migration BDD + bucket Storage `audio-timelines`
- ✅ POC-T2 : pipeline Python `generate_audio.py` (with-timestamps + filtrage balises émotion). Run pilote sur Communication et Écoute Active S2 réussi.
- ✅ POC-T3 : composant karaoké React (KaraokeTranscript + schéma Zod + hooks + page admin /admin/poc/karaoke). Seek-by-click écarté du périmètre par décision produit.
- ✅ POC-T4.1 : foundations whiteboard (getActiveScene + StructuredWhiteboard wrapper + Grid + Figures + page démo /admin/poc/whiteboard-templates + mock 6 scènes étalées sur 100s)
- ✅ POC-T4.2 : 3 templates linéaires (Flowchart + Comparison + Timeline) + responsive sweep des 5 templates
- ✅ POC-T4.3 : Causal (graphe nodes/edges, layout déterministe selon nombre, mobile chaîne verticale)

Bibliothèque whiteboard COMPLÈTE après T4.

Patterns techniques retenus (cf. RECAP_SESSION_POC_AUDIO_T4_07MAI2026.md §7) :
- Tokens design custom DentalLearn (`ds-turquoise`/`axe3`/`emerald-500`) — pas shadcn/ui ni `bg-gray-50/purple-50`
- Schéma Zod TimelineSchema v1.0 dans `src/lib/timeline/schema.ts` — étendu additivement à chaque sous-ticket T4
- Auth super_admin server-side : `import { isSuperAdmin } from '@/lib/auth/rbac'` puis redirect
- Pattern dual desktop/mobile via `hidden md:block` + `md:hidden` pour les templates complexes
- Throttle 2 Hz dans wrapper via `useMemo(..., [Math.floor(currentTime * 2), scenes])`
- Pas de framework de test installé dans le repo (cas documentés en markdown .spec-cases.md)

Dettes connues à NE PAS traiter dans T5 :
- POC-T3-D4 : MP3 sans header Xing/LAME → seek partiellement cassé. À fixer avant T7.
- POC-T4-D5 : Causal `max-width` manquant. À fixer dans T7 via container parent.
- POC-T4-D6 : Concept schema divergent vs spec POC. Décision en début de T5 (cf. Q3 ci-dessous).
- POC-T4-D7 à D10 : non bloquantes T5.

---

Documents de référence disponibles dans ce Project

- `spec_poc_visualisation_audio_v1_0.md` (la spec de référence du POC, §6 = agent extraction LLM, §6.2 = prompt, §6.3 = validation côté serveur)
- `RECAP_SESSION_POC_AUDIO_T1_T2_05MAI2026.md`
- `RECAP_SESSION_POC_AUDIO_T3_06MAI2026.md`
- `RECAP_SESSION_POC_AUDIO_T4_07MAI2026.md` ← session précédente
- `DATABASE_SCHEMA.md` (référence ARCHIVÉE, croiser avec Supabase MCP)
- Référentiel certification périodique
- Templates pédagogiques

---

Objectif de cette session : Ticket POC-T5 — Agent extraction structurelle (LLM)

Spec de référence : `spec_poc_visualisation_audio_v1_0.md` §6 (entièrement) + §10 Ticket 5.

Périmètre brut :
- Route API serveur Next.js : `src/app/api/admin/timeline/extract-scenes/route.ts`
- Méthode POST, auth super_admin uniquement (helpers RBAC livrés Sprint 1)
- Body : `{ source_type, source_id, script_text?, transcript?, news_synthesis_data? }`
- Appel Anthropic API : modèle `claude-sonnet-4-6` (à confirmer)
- Prompt enrichi cf. spec §6.2 (formations) ou variation pour news
- Validation Zod stricte de la sortie LLM via `TimelineSchema`
- Retour : `{ success, timeline, llm_meta, warnings? }`
- Tests sur 1-2 scripts pilotes (Communication et Écoute Active S2 + une synthèse news)
- Métadonnées token usage logguées pour suivi coût

Effort estimé : 2-3 jours
Risque : Élevé (qualité output LLM à itérer sur prompt, format JSON à fiabiliser)

Décisions à confirmer en tout début de session :
- Q1 : Format JSON sortie LLM aligné sur schéma actuel post-T4 (recommandation : OUI, le schéma est la vérité opérationnelle, le prompt LLM doit produire des champs qui passent `TimelineSchema.parse()` directement)
- Q2 : Concepts produits par T5 ou par T3-bis dédié ? (recommandation : par T5, économise un appel)
- Q3 : Si Q2=T5, patch additif sur `TimelineConcept` pour ajouter `term/definition/at_sec/at_word_index/source` avant le développement
- Q4 : Pattern `{"limit": N}` POST body bounding (à reproduire de news pipeline IDLE_TIMEOUT 150s)
- Q5 : Modèle Claude — `claude-sonnet-4-6` confirmé ?

Contraintes architecturales :
- ⚠️ NE PAS modifier `src/context/AudioContext.tsx`
- Validation Zod stricte côté serveur après réception output LLM
- Truncate défensif des `card.text` à 60 chars (spec §6.3)
- Conversion `trigger_at_word_index` → `trigger_at_sec` via lookup dans `transcript.segments[].words[]`
- Fallback en cas d'index hors bornes : `trigger_at_sec = scene_index * (duration_sec / scenes.length)`

---

Lis d'abord :
1. `spec_poc_visualisation_audio_v1_0.md` §6 (entièrement) + §10 Ticket 5
2. `RECAP_SESSION_POC_AUDIO_T4_07MAI2026.md` §6 (état du schéma + divergences) et §9 (décisions à confirmer)
3. Inspecte `src/lib/timeline/schema.ts` actuel pour confirmer la cible de validation Zod
4. Inspecte le pattern Edge Function news pipeline (par exemple `supabase/functions/score_articles/`) pour reproduire le pattern `{"limit": N}` POST body bounding et la gestion d'erreurs LLM

Puis :
- Si tu n'as aucune question, propose-moi un plan détaillé de découpage T5 (sous-tickets si nécessaire) avant de produire le prompt Claude Code
- Sinon, pose tes questions de clarification (notamment Q1-Q5 ci-dessus) avant de produire le prompt

Note pour le déroulé de la session : prévoir un protocole de test pas à pas que je pourrai suivre sans connaissances de codeuse pour valider la qualité de l'output LLM sur la séquence pilote Communication et Écoute Active S2.
```

---

## Pour reprendre avec Claude dans un nouveau chat

1. Ouvrir un nouveau chat **dans le projet DentalLearn** (important pour que Claude ait accès aux fichiers projet)
2. Coller : `"On attaque le Ticket POC-T5 (agent LLM extraction). Récap T4 dans RECAP_SESSION_POC_AUDIO_T4_07MAI2026.md. Prêt ?"`
3. Claude lit le récap, confirme le contexte, pose les questions Q1-Q5, et on lance une session dédiée T5

---

## Statistiques de la session T4

- **Durée totale** : ~1 journée (3 sous-tickets enchaînés)
- **Sous-tickets** : 3 (T4.1, T4.2, T4.3)
- **Commits** : 9 sur les 3 branches (1 + 5 + 3)
- **PRs mergées** : 3 (squash-merge)
- **Lignes ajoutées** : ~1857 lignes (composants + tests + mock + page démo)
- **Lignes supprimées** : 0 (extensions purement additives)
- **Composants livrés** : 6 templates + 1 wrapper + 1 helper + 1 page démo
- **Bugs résolus** : 0 majeur. Validation visuelle propre dès première itération sur chaque sous-ticket grâce aux commits intermédiaires.
- **Tests manuels** : ~25 (slider sur 7 timestamps × 3 sous-tickets + galerie isolée + mobile sans sidebar)
- **Décisions produit** : 9 (T4-D1 à T4-D9)
- **Dettes loggées** : 4 nouvelles (D5/D7/D8/D9), 3 héritées clarifiées (D4/D6/D10)

*Session productive. Le découpage en 3 sous-tickets a permis un workflow itératif sain avec validation visuelle Vercel preview entre chaque, sans accumuler de bugs visuels comme T3 (qui avait nécessité 5 itérations de fix audio sur un seul ticket).*

*Bibliothèque whiteboard COMPLÈTE — la grammaire visuelle du POC est posée. Les prochains tickets (T5/T6/T7/T8) seront orientés vers la production de timelines réelles (LLM), l'édition (admin), et l'intégration côté user (formations + news).*

*Fin du récap. Tickets T4.1 + T4.2 + T4.3 clôturés.*
