# `findCurrentWord` — cas de test (à porter en Jest)

Ce fichier documente les cas de test attendus pour `flattenTranscript` et
`findCurrentWord` (`src/lib/timeline/findCurrentWord.ts`).

> **Dette technique** : le projet n'a pas encore de runner de test installé
> (pas de Jest / Vitest dans `package.json`). Ces cas seront portés en
> `*.test.ts` dès qu'un runner sera ajouté. Aucun import externe nécessaire
> en dehors de `findCurrentWord` lui-même.

## Fixture commune `wordsBasic`

Tableau `FlatWord[]` minimal utilisé par la majorité des cas :

```ts
const wordsBasic: FlatWord[] = [
  { segmentIndex: 0, wordIndex: 0, start_sec: 0.0, end_sec: 0.5, text: 'Bonjour', speaker: 'sophie' },
  { segmentIndex: 0, wordIndex: 1, start_sec: 0.6, end_sec: 1.0, text: 'Martin',  speaker: 'sophie' },
  { segmentIndex: 1, wordIndex: 0, start_sec: 1.2, end_sec: 1.8, text: 'Salut',   speaker: 'martin' },
]
```

## Cas pour `findCurrentWord`

| # | Description | Input `currentTime` | Output attendu |
|---|---|---|---|
| 1 | Premier mot, premier instant exact | `0.0` | `wordsBasic[0]` ("Bonjour") |
| 2 | Premier mot ne commence pas à 0, on appelle à 0 | `0` (avec fixture où `wordsBasic[0].start_sec = 0.5`) | `null` |
| 3 | Fin exacte de la timeline (= `end_sec` du dernier mot) | `1.8` | `null` (au-delà de la fin) |
| 4 | Bien au-delà de la fin | `5.0` | `null` |
| 5 | Gap entre deux mots → mot précédent | `0.55` (entre `wordsBasic[0]` 0.5 et `wordsBasic[1]` 0.6) | `wordsBasic[0]` ("Bonjour") |
| 6 | `currentTime` négatif | `-1.0` | `null` |
| 7 | Tableau vide | `0.5` (sur `[]`) | `null` |
| 9 | Recherche binaire sur transcript large | `currentTime` ciblant le mot d'index 25 sur un fixture de 50 mots | `wordsLarge[25]` |

### Cas additionnels suggérés

| # | Description | Input | Output attendu |
|---|---|---|---|
| 1b | Mot actif "milieu", au début de la window | `0.6` | `wordsBasic[1]` ("Martin") |
| 1c | Mot actif "milieu", au milieu de la window | `0.8` | `wordsBasic[1]` ("Martin") |
| 5b | Gap large (entre segments) | `1.1` | `wordsBasic[1]` ("Martin", dernier mot terminé) |

### Construction du fixture `wordsLarge` pour le cas 9

```ts
const wordsLarge: FlatWord[] = Array.from({ length: 50 }, (_, i) => ({
  segmentIndex: 0,
  wordIndex: i,
  start_sec: i * 0.3,
  end_sec: i * 0.3 + 0.25, // gap de 0.05s entre chaque mot
  text: `mot${i}`,
  speaker: 'sophie',
}))
// findCurrentWord(wordsLarge, 25 * 0.3 + 0.1) === wordsLarge[25]
```

## Cas pour `flattenTranscript`

| # | Description | Input | Output attendu |
|---|---|---|---|
| 8 | `transcript` undefined | `undefined` | `[]` |
| 8b | `transcript.segments` undefined | `{ segments: undefined as any }` | `[]` |
| 8c | `transcript.segments` vide | `{ segments: [] }` | `[]` |
| 8d | Segment avec `words: []` | `{ segments: [{ start_sec: 0, end_sec: 1, speaker: 'sophie', text: '', words: [] }] }` | `[]` |
| 8e | Segment avec `words` undefined | comme 8d mais sans `.words` | `[]` |
| 8f | Indices propagés correctement | `{ segments: [{ ..., words: [{ start_sec: 0, end_sec: 0.5, text: 'A' }] }, { ..., words: [{ start_sec: 0.6, end_sec: 1.0, text: 'B' }] }] }` | `[{ segmentIndex: 0, wordIndex: 0, ..., text: 'A' }, { segmentIndex: 1, wordIndex: 0, ..., text: 'B' }]` |
| 8g | Speaker propagé depuis le segment | un segment `'martin'` puis un segment `'sophie'` | mots avec `speaker` correct |
