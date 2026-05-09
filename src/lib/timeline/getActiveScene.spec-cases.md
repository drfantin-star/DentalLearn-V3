# `getActiveScene` — cas de test (à porter en Jest)

Ce fichier documente les cas de test attendus pour `getActiveScene`
(`src/lib/timeline/getActiveScene.ts`).

> **Dette technique** : le projet n'a pas encore de runner de test installé
> (pas de Jest / Vitest dans `package.json`). Ces cas seront portés en
> `*.test.ts` dès qu'un runner sera ajouté. Aucun import externe nécessaire
> en dehors de `getActiveScene` lui-même.
>
> ⚠️ Le schéma `Scene` (livré T3) encode la fenêtre via `start_sec` /
> `end_sec` (pas `trigger_at_sec` + `display_duration_sec` comme la spec
> littérale §5.1). Tous les cas ci-dessous reflètent le schéma réel.

## Fixture commune `scenesBasic`

```ts
const scenesBasic: Scene[] = [
  {
    id: 's1',
    start_sec: 0,
    end_sec: 10,
    template: { kind: 'grid', columns: 3, cards: [] },
  },
  {
    id: 's2',
    start_sec: 15,
    end_sec: 27,
    template: { kind: 'figures', figures: [] },
  },
]
```

## Cas pour `getActiveScene`

| # | Description | Input `currentTime` | Output attendu |
|---|---|---|---|
| 1 | Tableau vide | `5` (sur `[]`) | `null` |
| 2 | `currentTime` négatif | `-1` | `null` |
| 3 | `currentTime` avant la première scène | `-0.001` | `null` |
| 4 | `currentTime = 0` exactement sur `start_sec` de s1 | `0` | `scenesBasic[0]` (s1) |
| 5 | `currentTime` au milieu de la fenêtre s1 | `5` | `scenesBasic[0]` (s1) |
| 6 | `currentTime = end_sec` exactement (borne incluse) | `10` | `scenesBasic[0]` (s1) |
| 7 | Gap entre s1 et s2 | `12` | `null` |
| 8 | `currentTime = start_sec` de s2 (borne incluse) | `15` | `scenesBasic[1]` (s2) |
| 9 | Au milieu de s2 | `20` | `scenesBasic[1]` (s2) |
| 10 | Bien après la dernière scène | `30` | `null` |

## Cas additionnels — chevauchement & ordre

### Fixture `scenesOverlap`

```ts
const scenesOverlap: Scene[] = [
  { id: 'a', start_sec: 0,  end_sec: 20, template: { kind: 'grid', columns: 2, cards: [] } },
  { id: 'b', start_sec: 10, end_sec: 30, template: { kind: 'figures', figures: [] } },
]
```

| # | Description | Input | Output attendu |
|---|---|---|---|
| 11 | Avant le chevauchement, seule `a` couvre | `5`  | `a` |
| 12 | Dans le chevauchement, la plus récente (`b`) gagne | `15` | `b` |
| 13 | Après expiration de `a`, seule `b` couvre | `25` | `b` |

### Fixture `scenesUnsorted` (robustesse au tri)

```ts
const scenesUnsorted: Scene[] = [
  { id: 'late',  start_sec: 50, end_sec: 60, template: { kind: 'grid', columns: 2, cards: [] } },
  { id: 'early', start_sec: 0,  end_sec: 10, template: { kind: 'grid', columns: 2, cards: [] } },
]
```

| # | Description | Input | Output attendu |
|---|---|---|---|
| 14 | Payload non trié, helper doit retrier | `5`  | `early` |
| 15 | Payload non trié, fenêtre tardive | `55` | `late` |

## Notes d'implémentation

- L'helper itère en sens inverse sur le tableau trié pour retourner la scène
  active la plus récente en cas de chevauchement.
- Le tri est non destructif : on `[...scenes].sort(...)` pour ne pas muter
  l'argument du caller (qui peut être référencé par d'autres composants
  React via `useMemo`).
- Une optimisation `isAscByStart` évite le coût du tri quand le payload est
  déjà trié — c'est le cas en pratique pour les timelines T2.

---

## Cas pour `getActiveOrLastScene` (POC-T7.2)

Variante "continuité visuelle" exposée par le même module. Sémantique :
**dernière scène dont `start_sec ≤ currentTime`**, sauf gap initial avant
la première scène où l'on retourne `null` (préservation de la cover).

> Pourquoi un helper distinct : `getActiveScene` est consommé par les
> pages T3/T4/T5/T6 qui s'appuient sur sa sémantique stricte (« null
> pendant les gaps »). Modifier `getActiveScene` casserait ces pages.
> Le helper est utilisé uniquement par `<EnrichedAudioPlayer>` (T7.2 et
> T7.3 user-side) où la continuité visuelle est demandée par produit.

### Cas avec `scenesBasic`

| # | Description | Input `currentTime` | Output attendu |
|---|---|---|---|
| 16 | Tableau vide | `5` (sur `[]`) | `null` |
| 17 | `currentTime` négatif | `-1` | `null` |
| 18 | Gap initial avant la première scène (cover préservée) | `-0.001` | `null` |
| 19 | `currentTime = 0` exactement sur `start_sec` de s1 | `0` | `s1` |
| 20 | Au milieu de s1 | `5` | `s1` |
| 21 | `currentTime = end_sec` de s1 (borne incluse) | `10` | `s1` |
| 22 | **Gap inter — s1 étendue** (différence vs `getActiveScene`) | `12` | `s1` |
| 23 | `currentTime = start_sec` de s2 | `15` | `s2` |
| 24 | Au milieu de s2 | `20` | `s2` |
| 25 | **Post-dernière-scène — s2 étendue** | `30` | `s2` |
| 26 | Bien après la fin (audio tail) | `1000` | `s2` |

### Cas avec `scenesOverlap`

| # | Description | Input | Output attendu |
|---|---|---|---|
| 27 | Avant le chevauchement, seule `a` couvre | `5` | `a` |
| 28 | Dans le chevauchement, la plus récente (`b`) gagne | `15` | `b` |
| 29 | Après expiration de `a`, seule `b` couvre | `25` | `b` |
| 30 | Post-dernière (`b` étendue) | `100` | `b` |

### Cas avec `scenesUnsorted`

| # | Description | Input | Output attendu |
|---|---|---|---|
| 31 | Payload non trié, helper doit retrier | `5` | `early` |
| 32 | Payload non trié, fenêtre tardive | `55` | `late` |
| 33 | Gap inter — `early` étendue (différence vs `getActiveScene`) | `25` | `early` |

### Cas réels pilote (séquence `e8dfa6b8-…`)

Avec scènes pilote (5 scènes : s1 [0,187.5], s2 [250.4,...], etc.) :

| # | Description | Input | Output attendu |
|---|---|---|---|
| 34 | Dans s1 active | `100` | `s1` |
| 35 | Gap inter 1-2 (audio à t=200s, attendu s1 étendue) | `200` | `s1` |
| 36 | Dans s4 active | `400` | `s4` |
| 37 | Post-s5 jusqu'à fin audio (538s) | `530` | `s5` |
| 38 | Gap initial (cover) | `0` (avant s1.start_sec si > 0) | `null` |

## Notes d'implémentation `getActiveOrLastScene`

- Réutilise l'helper interne `isAscByStart` du même module (pas exporté).
- Tri défensif identique à `getActiveScene`.
- Itération inverse pour retourner la scène la plus récente en cas de
  chevauchement après la fin de la première (cf. cas 30).
- Le wrapper T7.2 (`<EnrichedAudioPlayer>`) utilise la valeur retournée
  pour déterminer s'il rend `<StructuredWhiteboard>` ou la cover. Quand
  une scène est retournée, le wrapper passe à `<StructuredWhiteboard>`
  un `currentTime` calé à `displayedScene.start_sec + 0.5` (pattern déjà
  utilisé dans `TimelinePreviewPanel.tsx`) pour que le `getActiveScene`
  interne du whiteboard la trouve, même pendant un gap où le vrai
  `state.currentTime` audio ne tomberait dans aucune fenêtre de scène.
