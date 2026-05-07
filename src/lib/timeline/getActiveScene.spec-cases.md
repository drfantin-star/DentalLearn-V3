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
