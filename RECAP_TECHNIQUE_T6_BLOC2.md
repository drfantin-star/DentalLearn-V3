# RECAP technique POC-T6 BLOC 2 — Drag & drop + Régénération LLM + Concepts + Versions

Date : 8 mai 2026
Branche : `claude/drag-drop-llm-regen-LRcSP` (PR à créer vers `main`)
Banc de test pilote : séquence `e8dfa6b8-ef34-4454-a198-e6f973f466de`
("Communication non verbale", 5 scènes, 12 concepts).

---

## Contexte

Suite immédiate du BLOC 1 (mergé le 8 mai 2026). Ajout :

- **T6.4** : drag-reorder cosmétique des scènes en sidebar + drag-reorder
  intra-template pour Grid / Flowchart / Comparison / Figures / Timeline
  (Causal explicitement exclu — topologie non linéaire).
- **T6.5** : bouton « Régénérer via LLM » (formations uniquement),
  édition concepts (toggle hidden + édition term/definition + ajout
  manuel), panneau « Versions précédentes » (lecture seule, ouverture
  JSON brut dans un nouvel onglet).

Aucune modification de `src/context/AudioContext.tsx`. Validation Zod
côté serveur (PUT) intacte. Auth super_admin server-side conservée.

---

## Fichiers livrés

### Nouveaux

- `src/components/admin/timeline-editor/SortableList.tsx` — wrapper
  `<DndContext>` + `<SortableContext>` réutilisable, render-props,
  expose `<DragHandle>` standard (icône ⋮⋮). Sensors pointer +
  keyboard (a11y).
- `src/components/admin/timeline-editor/ConceptsEditor.tsx` — panneau
  dépliable `Concepts (N)`, collapsed par défaut. Toggle « Afficher »,
  édition term/definition, suppression confirmée, ajout manuel via
  modal léger.
- `src/components/admin/timeline-editor/VersionsPanel.tsx` — panneau
  dépliable `Versions précédentes (N)`. Liste triée desc, badge
  `[ACTUELLE]`, lien « Voir cette version » → onglet externe (JSON
  brut).
- `src/components/admin/timeline-editor/RegenerateConfirmModal.tsx` —
  modal de confirmation custom (pas de lib externe), affiche coût +
  durée annoncés + rappel versionning.
- `RECAP_TECHNIQUE_T6_BLOC2.md` (ce fichier).
- `PROTOCOLE_TEST_T6_BLOC2.md` — protocole de test pas-à-pas FR.

### Modifiés

- `package.json` + `package-lock.json` — ajout
  `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`,
  `@dnd-kit/utilities@^3.2.2` (≈ 43 kB gzipped au total).
- `src/lib/timeline/schema.ts` — ajout strictement additif
  `hidden: z.boolean().optional()` sur `TimelineConceptSchema`.
- `src/components/admin/timeline-editor/SceneListSidebar.tsx` —
  refonte avec `<SortableList>`, ajout poignée drag par ligne, tooltip
  `?` explicatif, prop `onReorder`, prop `onRegenerate` enabled
  (formation only) + spinner `isRegenerating`.
- `src/components/admin/timeline-editor/templates/GridEditor.tsx`,
  `FlowchartEditor.tsx`, `FiguresEditor.tsx`,
  `TimelineTemplateEditor.tsx`, `ComparisonEditor.tsx` — drag-reorder
  des cards/steps/figures/events. Comparison : reorder indépendant
  par colonne (left.cards et right.cards séparément).
- `src/components/admin/timeline-editor/templates/CausalEditor.tsx` —
  inchangé (pas de drag par décision spec BLOC 2).
- `src/app/admin/timelines/[type]/[id]/TimelineEditorClient.tsx` —
  intégration `onReorder`, `onRegenerate` (formations uniquement),
  `ConceptsEditor`, `VersionsPanel`, état `isRegenerating` qui locke
  l'UI éditeur via `pointer-events-none + opacity-60`. Calcul prix
  estimé Sonnet 4.6 ($3 / $15 per 1M tokens × 0.92 €/$) après réponse
  `extract-scenes`.
- `src/app/admin/timelines/formation/[sequence_id]/page.tsx` &
  `src/app/admin/timelines/news/[synthesis_id]/page.tsx` — passent
  désormais `initialTimelineUrl` au client (utilisé par VersionsPanel
  pour reconstruire les URL des versions).
- `src/components/admin/timeline-editor/.spec-cases.md` — ajout cas
  31–59 couvrant T6.4 + T6.5 + régressions BLOC 2.

---

## Décisions techniques

### D6 (BLOC 2) — Pattern render-props pour `SortableList`

Choix entre :
- (A) Wrapper qui rend lui-même le `<div>` avec `setNodeRef` + style
  transform, et expose au consumer `attributes` + `listeners` à
  étaler sur la poignée seule.
- (B) Render-props complet avec ref/style à étaler côté consumer.

Retenu : **A**. Plus simple à utiliser correctement, le wrapper
gère le style transform automatiquement. Le consumer ne s'occupe
que de poser une `<DragHandle {...handleProps} />` quelque part
dans son markup. Évite les bugs de mauvais ref placement.

### D7 (BLOC 2) — `hidden?` strictement additif sur `TimelineConcept`

Vérification rétro-compat :
- Pilote `e8dfa6b8-...` : 12 concepts générés en T5 sans `hidden`.
- Schéma : `hidden: z.boolean().optional()` → `undefined` accepté.
- Side car : la timeline parsée renvoie tous les concepts avec
  `hidden === undefined` ; le composant les considère « affichés »
  par défaut (ligne 60 ConceptsEditor : `const isHidden = concept.hidden === true`).
- PUT route : revalide via `TimelineSchema.safeParse()` → un payload
  qui contient le champ supplémentaire passe sans souci. Un payload
  qui n'en contient pas passe aussi (cas reload après-regen LLM).

Conclusion : zéro casse, zéro migration de données nécessaire.

### D8 (BLOC 2) — Drag-reorder cosmétique scènes : `start_sec` figés

Spec stricte BLOC 2 : seul l'ordre du tableau `timeline.scenes` change.
`start_sec` et `end_sec` sont conservés intact. Conséquence :
- `getActiveScene(currentTime, scenes)` continue de marcher pareil
  parce qu'elle parcourt tous les `scenes[]` et matche par
  `start_sec ≤ t < end_sec`. L'ordre ne joue qu'en cas de chevauchement
  (où la première rencontrée gagne) — décision déjà arbitrée en T6.2.
- L'UX cosmétique sert à grouper les scènes par thème dans la sidebar,
  pas à modifier la lecture.

Tooltip `?` ajouté pour expliciter au super_admin (cf. cas 33).

### D9 (BLOC 2) — Pas de drag-reorder pour Causal

Décision spec : la topologie nodes/edges d'un graphe causal n'a pas
d'ordre linéaire pertinent (le rendu graphe les place selon les
relations, pas selon l'ordre du tableau). Drag aurait été cosmétique
au mieux, trompeur au pire (les admins penseraient changer le
graphe). Édition manuelle préservée.

### D10 (BLOC 2) — Régénération LLM : pas de helper extract-context

Spec mentionne `/api/admin/sequences/[id]/extract-context` qui n'existe
pas dans la codebase actuelle. La route `/api/admin/timeline/extract-scenes`
fait déjà le boulot côté serveur via `loadFormationContextFromTimeline`
quand `script_text` / `transcript` sont absents du body. On envoie donc
un body minimal `{ source_type, source_id }` et la route lit le
`timeline_url` existant pour reconstituer le contexte.

Avantages : pas de duplication de code, pas de nouvelle route à
maintenir, comportement identique à `/admin/poc/extract-scenes`.

### D11 (BLOC 2) — Lock UI pendant régen LLM

Pendant `isRegenerating === true` :
- `SceneListSidebar` reçoit `isRegenerating` et désactive son bouton
  (avec spinner ⟳).
- Le wrapper `<div>` autour de la sidebar / preview / éditeur droit
  reçoit `pointer-events-none opacity-60` ; les boutons publish + save
  sont également désactivés via `editorLocked`.
- `setIsPlaying(false)` est forcé avant l'appel pour éviter les conflits
  audio pendant l'attente.

---

## Dettes loggées

### T6-D6 — Estimation prix LLM heuristique

Le toast affiche `priceEur = (input_tokens × 3 + output_tokens × 15) / 1M × 0.92`
basé sur les tarifs Sonnet 4.6 de novembre 2025. À recalibrer si le
pricing change. À terme, exposer `priceEur` directement depuis la
route `extract-scenes` (côté serveur), ce qui évite cette duplication.

### T6-D7 — Pas de rollback automatique des versions

V1 décision spec : « Voir cette version » ouvre le JSON brut. Si un
admin veut revenir en arrière, il copie/colle le contenu manuellement
via le PUT route. Acceptable pour POC ; à améliorer si retour terrain
(nécessite un POST /restore-version qui re-upload le JSON ancien comme
nouvelle version).

### T6-D8 — Reconstruction d'URL des versions par regex

`VersionsPanel.buildVersionUrl` reconstruit l'URL d'une version à
partir de `currentTimelineUrl` en remplaçant le segment final
`<isoStamp>.json`. Fragile si la structure du bucket change. Mieux :
exposer `versions: Array<{ name, public_url }>` côté API GET. À traiter
avant prod si on garde le panneau.

### T6-D9 — `script_text` reconstitué côté regen

Quand on appelle `/api/admin/timeline/extract-scenes` sans body
`script_text`, la route concatène les `transcript.segments[].text`
préfixés par le speaker. C'est différent du dialogue source original
(`dialogues/sequence_*.txt`), notamment au niveau de la ponctuation
et des hésitations qui ont été nettoyées par ElevenLabs au moment de
la TTS. Conséquence : les régen LLM ne sont pas strictement reproductibles
depuis la première génération T5. À documenter dans le RECAP T8.

---

## Tests réalisés

Local :
- `npx tsc --noEmit` : zero error.
- `npm run build` : `✓ Compiled successfully`. Les erreurs de prerender
  observées sont dues aux env vars Supabase manquantes en sandbox CI
  et concernent toutes les pages auth (préexistant, non-régression).
- Validation Zod du pilote `e8dfa6b8-...` post-patch `hidden?` : OK
  (parsing inchangé, `hidden === undefined` pour les 12 concepts).

À vérifier en prod (cf. PROTOCOLE_TEST_T6_BLOC2.md).

---

## Schéma Zod — confirmation rétro-compat

Diff exact `src/lib/timeline/schema.ts` :

```diff
   source: z.string().min(1).optional(),
+  // T6.5.b — additif strictement optionnel (rétro-compat) : permet à l'admin
+  // de masquer un concept de l'affichage côté karaoké/whiteboard sans le
+  // supprimer du payload. `undefined` (cas de toutes les timelines T2/T5
+  // existantes) = concept affiché par défaut. `false` = idem. `true` = masqué.
+  hidden: z.boolean().optional(),
 })
```

Aucun champ enlevé, aucun champ rendu requis, aucun `.refine()` ajouté.
Toutes les timelines T2 et T5 existantes restent valides.
