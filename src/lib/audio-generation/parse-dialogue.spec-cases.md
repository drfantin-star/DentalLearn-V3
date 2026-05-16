# `parse-dialogue` + `chunk-dialogue` — cas de test (à porter en Jest)

Ce fichier documente les cas de test attendus pour `parseDialogueScript`,
`validateDialogue`, `computeScriptStats` (`src/lib/audio-generation/parse-dialogue.ts`)
et `splitIntoChunks` (`src/lib/audio-generation/chunk-dialogue.ts`).

> **Dette technique** : le projet n'a pas de runner de test installé (pas de
> Jest / Vitest dans `package.json`). Ces cas seront portés en `*.test.ts`
> dès qu'un runner sera ajouté.

## Constantes

```ts
const SOPHIE = 't8BrjWUT5Z23DLLBzbuY'
const MARTIN = 'ohItIVrXTBI80RrUECOD'
```

## `parseDialogueScript`

| # | Description | Input | Output attendu |
|---|---|---|---|
| 1 | Script minimal 2 répliques | `"Sophie: Bonjour\nMartin: Salut"` | `[{voice_id: SOPHIE, text: 'Bonjour', speaker: 'sophie'}, {voice_id: MARTIN, text: 'Salut', speaker: 'martin'}]` |
| 2 | Lignes `#` ignorées | `"# commentaire\nSophie: Hello\n# autre\nMartin: Hi"` | 2 répliques (commentaires retirés) |
| 3 | Lignes vides ignorées | `"\nSophie: A\n\n\nMartin: B\n"` | 2 répliques |
| 4 | Balises `[curious]` préservées dans `text` | `"Sophie: [curious] Vraiment ?\nMartin: [explaining] Oui."` | `text` = `'[curious] Vraiment ?'` puis `'[explaining] Oui.'` |
| 5 | Case-insensitive `SOPHIE:` | `"SOPHIE: A\nmartin: B"` | speakers `['sophie', 'martin']`, voice_ids corrects |
| 5b | Texte vide après `:` → ligne ignorée | `"Sophie:   \nMartin: ok"` | 1 réplique (Martin) |
| 5c | Ligne sans préfixe locuteur ignorée | `"Sophie: A\nblabla\nMartin: B"` | 2 répliques (ligne `blabla` skip) |

## `validateDialogue`

| # | Description | Input | Errors attendues |
|---|---|---|---|
| 6 | < 2 répliques | `[{voice_id: SOPHIE, text: 'A', speaker: 'sophie'}]` | au moins 1 erreur mentionnant "minimum" + manque Martin |
| 7 | Total chars > 30 000 | 50 inputs de 700 chars (35 000 total) | erreur mentionnant 30 000 (et > 50 → 2e erreur) |
| 7b | Sophie uniquement | 5 répliques Sophie | erreur "au moins une réplique Sophie et une réplique Martin" |
| 7c | Réplique texte vide | (cas construit avec `text: '   '`) — non produit par le parser, mais validable | erreur "texte vide" |

## `computeScriptStats`

Sur 2 répliques connues — `text: 'Hello world'` (11 chars) et `text: 'Bonjour'` (7 chars) :
- `chars` = 18
- `repliques` = 2
- `estimatedDurationMin` = `18 / 750` ≈ `0.024`
- `estimatedCostEur` = `18 / 1000 * 0.05` = `0.0009`

## `splitIntoChunks`

| # | Description | Inputs (`text.length`) | `maxChars` | Chunks attendus |
|---|---|---|---|---|
| 8 | 3 inputs de 10 chars, max 20 | `[10, 10, 10]` | 20 | 2 chunks : `[[10,10], [10]]` (le 3e dépasserait → flush) |
| 9 | Input seul > maxChars forme son propre chunk | `[5, 100, 5]` | 20 | 3 chunks : `[[5], [100], [5]]` |
| 10 | Tous tiennent dans 1 chunk | `[10, 10]` | 100 | 1 chunk `[[10,10]]` |
| 11 | Liste vide | `[]` | 20 | `[]` |
