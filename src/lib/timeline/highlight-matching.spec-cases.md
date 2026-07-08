# `highlight-matching` — cas de test (à porter en Jest)

Ce fichier documente les cas de test attendus pour `labelTokens` et
`enrichTimelineHighlights` (`src/lib/timeline/highlight-matching.ts`).

> **Dette technique** : le projet n'a pas encore de runner de test installé
> (pas de Jest / Vitest dans `package.json`). Ces cas seront portés en
> `*.test.ts` dès qu'un runner sera ajouté. Aucun import externe nécessaire
> en dehors du module lui-même.

Les timings des fixtures "réelles" ci-dessous proviennent de la timeline
publiée auditée en Phase 0 (séquence « Démarche diagnostique clinique »,
`45a4c315-f513-4504-8ba5-de56987e4bfe`, transcript word-level ElevenLabs).

## Cas pour `labelTokens`

| # | Description | Input | Output attendu |
|---|---|---|---|
| T1 | Normalisation accents + casse | `"Sondage PARODONTAL ponctuel"` | `['sondage', 'parodontal', 'ponctuel']` |
| T2 | Ponctuation et élisions découpées | `"Pas d'effet de coin localisé"` | `['effet', 'coin', 'localise']` (`pas`, `d`, `de` exclus) |
| T3 | Stopwords retirés | `"Force répartie sur toute l'occlusion"` | `['force', 'repartie', 'toute', 'occlusion']` (`sur`, `l` exclus) |
| T4 | Nombres >= 2 chiffres conservés, 1 chiffre exclu | `"9,3 % et 60 mm sur 5"` | `['60']` (`9`, `3`, `5` exclus — 1 chiffre ; `mm`, `et` trop courts) |
| T5 | Déduplication | `"fêlure sur fêlure"` | `['felure']` |
| T6 | Libellé vide ou purement ponctuation | `"→ ?"` | `[]` |

## Fenêtres de recherche

| # | Description | Attendu |
|---|---|---|
| W1 | Fenêtre = `[start_sec scène, start_sec scène suivante)` — les scènes réelles se CHEVAUCHENT (audit : scene-2 démarre à 36,76 s avant la fin de scene-1 à 45,21 s) | un mot à 40,0 s appartient à la fenêtre de scene-2, pas de scene-1 |
| W2 | Dernière scène : fenêtre ouverte jusqu'à la fin de l'audio | mots après `start_sec` de la dernière scène tous inclus |
| W3 | Scène sans aucun mot dans sa fenêtre | items en échec `reason: 'empty_window'` |

## Cas de matching réussis (documentés Phase 0)

Fixture : extraits word-level réels, un item par cas.

| # | Libellé item (template) | Mots de la fenêtre (extraits) | Bornes attendues |
|---|---|---|---|
| M1 | `"Sondage parodontal ponctuel"` (flowchart scene-1, fenêtre 20,21→36,76) | `sondage` 26.384→26.88, `parodontal` 26.94→27.52, `ponctuel.` 27.58→28.68 | `highlight_at_sec = 26.384`, `highlight_end_sec = 28.68` (3/3 tokens, span contigu) |
| M2 | `"Bleu de méthylène pour objectiver"` (flowchart scene-7) | `bleu` 202.302→202.562, `méthylène` 202.69→203.202, `objectiver` 203.419→204.002 | `202.302 → 204.002` (3/3) |
| M3 | `"Force répartie sur toute l'occlusion"` (comparison scene-2) | `répartit` 41.04→41.68, `force` 41.827→42.16, `toute` 42.44→42.64, `l'occlusion` 42.66→43.2 | `41.04 → 43.2` — flexion `répartie`/`répartit` couverte par préfixe 5 |
| M4 | `"Pronostic sévèrement compromis"` (grid scene-8) | `compromet` 230.382→231.042, `sévèrement` 231.095→231.522, `pronostic.` 231.73→232.323 | `230.382 → 232.323` — ordre des mots inversé : le match est token-set, pas séquentiel |
| M5 | Mono-token exact : `"Transillumination"` (scene-1) | `transillumination` 24.773→25.68 | `24.773 → 25.68` — libellé mono-token : égalité exacte exigée |

## Cas d'échec (repli = pas de bornes, documentés Phase 0)

| # | Libellé item | Raison attendue |
|---|---|---|
| F1 | `"Cuspide cible identifiée"` (scene-5) | `cible` et `identifiée` jamais prononcés → 1/3 tokens < 60 % → `below_threshold`, aucun champ écrit |
| F2 | `"Zone d'ombre visible → fêlure confirmée"` (scene-6) | `zone`, `visible` absents de la fenêtre → 3/5 = 60 % mais dispersion réelle ; si < 60 % après stemming strict → `below_threshold` (cas limite : accepté ssi >= 0.6 exactement — le test fige le comportement constaté) |
| F3 | `"Pression sur cuspide fêlée"` (causal scene-3) | `cuspide` prononcé UNIQUEMENT hors fenêtre (scene-2 et scene-5) → token non matché. MAIS le stemming léger apparie `fêlée`/`fêlés` → 2/3 tokens = 67 % >= 60 % → item finalement ACCEPTÉ (bornes `pression` 75.974 → `fêlés` 79.041). Estimé en échec lors de l'audit Phase 0 (matcher sans stemming) — le module fait mieux ; le test fige ce comportement |
| F3b | Libellé dont TOUS les mots ne sont prononcés que hors fenêtre (synthétique) | 0 token matché dans la fenêtre → `below_threshold`, aucun champ écrit |
| F4 | Mono-token non exact : libellé `"Radiographies"` avec seul `radiographie` dans la fenêtre | mono-token exige l'exact → pas de bornes |

## Tightest-span

| # | Description | Attendu |
|---|---|---|
| S1 | Token répété plus loin dans la fenêtre (audit : figure `"9,3 % ..."` scene-4, tokens `dents`, `fêlées`, `douleur`, `relâchement`, `seul`, `symptôme` réapparaissent entre 96 s et 118 s) | bornes = plus petite fenêtre contiguë couvrant une occurrence de CHAQUE token matché (~96,2 → 101,8 s), PAS min/max de toutes les occurrences (96,2 → 118,4 s) |
| S2 | Une seule occurrence de chaque token | bornes = premier mot matché → dernier mot matché |

## Attribution gloutonne (6A)

Fixture : scene-12 réelle — `left.cards[1]` `"Ne diagnostique pas la fêlure"` et
`right.cards[0]` `"Diagnostic de la fêlure elle-même"` matchent les mêmes mots
(`diagnostiquer la fêlure elle-même`, 331,8 → 333,6 s).

| # | Description | Attendu |
|---|---|---|
| G1 | Deux items en collision sur le même span | le premier dans l'ordre des items (`left.cards[1]`) obtient les bornes ; les mots du span sont consommés |
| G2 | Second item, mots restants insuffisants | `matched: false`, `reason: 'window_consumed'` (et non `below_threshold`) |
| G3 | Second item pouvant matcher ailleurs dans la fenêtre (autre occurrence des tokens hors span consommé) | il matche sur l'occurrence suivante disponible |

## Skip et robustesse

| # | Description | Attendu |
|---|---|---|
| R1 | Timeline `auto_llm_extraction_approx` sans mots (`segments[].words` vides) | `skipped: true`, `skipReason: 'no_word_level_transcript'`, timeline retournée inchangée |
| R2 | Timeline sans scènes | `skipped: true`, `skipReason: 'no_scenes'` |
| R3 | Idempotence : timeline déjà enrichie repassée dans le module | mêmes bornes en sortie ; item ne matchant plus (libellé édité) → bornes RETIRÉES |
| R4 | Pureté : l'objet d'entrée n'est jamais muté | comparaison profonde avant/après appel identique |
| R5 | Item au libellé vide | `reason: 'no_tokens'` |
| R6 | Tous templates couverts | grid/flowchart `cards[]`, comparison `left/right.cards[]`, causal `nodes[]` et legacy `cause`+`effects[]`, figures `figures[]` (label = `value + label`), timeline `events[]` (préférés) et `steps[]`, recap `figures[]` |

> **Note périmètre Recap** : `impact` et `caveats` sont des chaînes nues dans
> le schéma (pas des objets) — impossible d'y attacher des bornes sans champ
> racine dédié. Exclus du Lot 1, signalé en Observations.
