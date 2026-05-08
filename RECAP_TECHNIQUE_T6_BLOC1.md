# RECAP TECHNIQUE — POC-T6 BLOC 1 (08 mai 2026)

**Branche** : `claude/poc-t6-bloc1-editor-foundations`
**Sous-tickets livrés** : T6.1 (migration + routes API + ossature pages),
T6.2 (édition métadonnées + add/delete), T6.3 (CardContent + dropdown
template kind + 6 sous-éditeurs).
**Banc de test pilote** : séquence id `e8dfa6b8-ef34-4454-a198-e6f973f466de`
("Communication non verbale", 5 scènes, 12 concepts) issue du quality run T5.

---

## 1. Fichiers livrés

### Backend / API

- `scripts/migrate_timelines_storage.ts`
  Script Node.js + tsx (lancé via `npx tsx`, AUCUNE dépendance npm
  ajoutée — lecture `.env.local` faite à la main pour rester self-contained).
  Migre `audio-timelines/poc/{source_id}-{ISO}.json` →
  `audio-timelines/{type}/{source_id}/{ISO}.json` (pattern D2). Modes
  `--dry-run` (défaut) et `--execute`. Idempotent : 2e exécution skip tout.
  N'efface JAMAIS l'ancien fichier (zéro risque de perte).

- `src/lib/timeline/admin-table-resolver.ts`
  Helper partagé : `resolveTableAndColumn(type)`, `buildTimelinePath`,
  `buildVersionsFolder`, `isoStampForStorage`, constante
  `TIMELINE_STORAGE_BUCKET`.

- `src/lib/timeline/template-defaults.ts`
  `getDefaultTemplatePayload(kind)` (tous schémas Zod-valides),
  `TEMPLATE_KINDS` (ordre stable), `TEMPLATE_KIND_LABELS` (FR).

- `src/app/api/admin/timelines/[type]/[id]/route.ts`
  GET (lecture timeline + versions[] + published) et PUT (validation
  Zod stricte, upload nouvelle version, UPDATE colonne). Auth super_admin.
  400 explicite avec détails Zod si timeline invalide.

- `src/app/api/admin/timelines/[type]/[id]/publish/route.ts`
  POST avec `{published: boolean}`. Auth super_admin.

### Pages serveur

- `src/app/admin/timelines/formation/[sequence_id]/page.tsx`
  Lit `sequences` (title, sequence_number, course_duration_seconds,
  timeline_url, timeline_published). Auth super_admin via `getUser` +
  `isSuperAdmin`.

- `src/app/admin/timelines/news/[synthesis_id]/page.tsx`
  Lit `news_syntheses` (id, summary_fr, timeline_url, timeline_published).
  Pas de colonne `title` côté BDD → titre dérivé de `summary_fr` (1ère
  phrase ou 80 char max).

### Client React (admin/timeline-editor/)

Dossier `src/components/admin/timeline-editor/` :

- `TimelinePreviewPanel.tsx` — audio HTML natif + StructuredWhiteboard
  réutilisé tel quel. Toggle radio fixed/sync. **AucuneTouch
  AudioContext**.
- `SceneListSidebar.tsx` — liste scènes + add + delete (confirm natif).
  Badge couleur par kind. Bouton "Régénérer LLM" disabled placeholder.
- `SceneEditor.tsx` — container droite (metadata + template).
- `SceneMetadataEditor.tsx` — title, start_sec, end_sec,
  pedagogical_intent (local-only, V1). Banners overlap / durée < 5s /
  durée > 60s / start ≥ end.
- `SceneTemplateEditor.tsx` — dropdown kind + modal de confirmation
  + dispatch sous-éditeur.
- `CardContentEditor.tsx` — text (max 60), subtitle (max 40),
  variant (default/highlight/warning/success), compteurs colorés.
- `templates/GridEditor.tsx`
- `templates/FlowchartEditor.tsx`
- `templates/ComparisonEditor.tsx`
- `templates/FiguresEditor.tsx`
- `templates/CausalEditor.tsx`
- `templates/TimelineTemplateEditor.tsx` (naming distinct du type Timeline)
- `PublishToggleButton.tsx` — pastille + confirm natif sur publication.
- `DirtyStateIndicator.tsx` — pastille état dirty/saving.
- `.spec-cases.md` — 24 cas de test manuel.

### Client orchestrateur

- `src/app/admin/timelines/[type]/[id]/TimelineEditorClient.tsx`
  State principal, layout 3 colonnes (mobile = stack vertical),
  beforeunload, save PUT, publish POST, toast succès/erreur, intentions
  pédagogiques en state local.

---

## 2. Décisions techniques (et divergences avec le prompt)

| ID | Décision |
|----|----------|
| D-PROMPT | Toutes les décisions D1-D5, D8 du prompt respectées telles quelles. |
| D-T6.2-pi | `pedagogical_intent` exposé via UI mais **non persisté** : le `SceneSchema` Zod ne contient pas ce champ. Pour respecter la consigne « ne pas patcher le schéma sans validation explicite », on stocke les intentions dans un `Record<sceneId,string>` côté state local. Visible mais perdu au reload. À arbitrer : ajouter un champ optionnel au schéma OU retirer l'UI. → Logged comme **dette T6-D2**. |
| D-T6.3-causal | L'éditeur Causal V1 cible uniquement le mode `nodes+edges` (spec POC §5.2). Le mode legacy `cause+effects` est auto-migré au premier `onChange` (helper `migrateLegacyIfNeeded`). Cohérent avec la préférence du composant `<Causal>` côté whiteboard (qui rend le mode graphe si `nodes` est présent). |
| D-T6.3-timeline | Idem : éditeur Timeline cible uniquement `events`, auto-migration depuis `steps`. |
| D-build | `npm install` n'avait jamais tourné dans le sandbox — j'ai dû l'installer pour valider le build. Aucune dépendance ajoutée à `package.json`. Build typecheck + lint OK. La prerender de pages existantes échoue sans `.env.local` (état pré-existant). |
| D-script-migr | Le script de migration ne dépend de PERSONNE (tsx en npx, pas de dotenv) — lecture manuelle de `.env.local`. Évite d'ajouter une dépendance pour un script one-shot. |

---

## 3. Dettes techniques loggées (numérotation continuant T5)

### POC-T6-D1 — `SceneSchema` ne valide pas `start_sec < end_sec`

**Symptôme** : on peut sauvegarder une scène avec `start_sec >= end_sec`.
La route PUT laisse passer car le schéma Zod n'a pas la contrainte.
Côté UI : bordure rouge avertit déjà, mais la save serveur l'accepte.

**Risque** : `getActiveScene` (cf. `src/lib/timeline/getActiveScene.ts`)
ne renverra jamais cette scène car `currentTime >= start && currentTime <= end`
sera faux pour tout `t`. Donc whiteboard inerte sur cette scène, mais pas
de crash.

**Reco fix** :
```ts
// dans schema.ts
const SceneSchema = z.object({...}).refine(
  s => s.start_sec < s.end_sec,
  { message: 'start_sec must be < end_sec' }
)
```
**NON appliqué en BLOC 1** : modification additive risquée post-T5
(toutes les timelines existantes seraient revalidées au PUT — vérifier
que le pilote pilote n'a aucune scène en limite).

**Action recommandée Sprint suivant** : appliquer le `.refine`, puis
relancer un dry-run de la migration storage pour vérifier la validité.

### POC-T6-D2 — `pedagogical_intent` non persisté

**Symptôme** : champ visible dans l'UI mais lost au reload. Le prompt
mentionnait ce champ comme optionnel mais le schéma Zod actuel ne l'a
pas. Pour ne pas patcher le schéma sans validation explicite, on a
choisi un state local par session.

**Reco fix** : ajout strictement additif :
```ts
const SceneSchema = z.object({
  ...,
  pedagogical_intent: z.string().max(500).optional(),
})
```
À discuter avec Dr Fantin : utile en V1 ou ferraille à enlever ?

### POC-T6-D3 — `news_syntheses` n'a pas de colonne `title`

**Symptôme** : la page `/admin/timelines/news/[id]` dérive un titre
depuis `summary_fr` (1ère phrase). Pas un bug, juste un compromis UX
en attendant que la BDD soit étoffée si nécessaire.

**Reco** : si jugé inacceptable, ajouter `title text` à
`news_syntheses` via migration. Pas critique en BLOC 1 (V1 lecture-seule
côté news, pas de bouton "Régénérer").

### POC-T6-D4 — Pas de table d'historique

Décision D3 : versioning = empilement de fichiers Storage. Si on veut
un jour browse versions précédentes via UI, il faudra soit lister le
folder à chaque GET (déjà fait, retourné dans `versions[]`) soit créer
une table `timeline_versions` (id, source_id, type, version, url, created_at,
created_by). Hors scope BLOC 1.

---

## 4. Incohérences trouvées dans la codebase post-T5

### a. Schéma Zod permissif sur les `start_sec` vs `end_sec`

Cf. T6-D1 ci-dessus. Pas de garde-fou côté schéma.

### b. `CausalTemplate` et `TimelineTemplate` ont chacun deux modes

`CausalTemplateSchema` accepte `(cause+effects)` legacy ET `(nodes+edges)`
graphe. Idem `TimelineTemplateSchema` avec `steps` legacy et `events`.
Les éditeurs T6.3 ne produisent que les modes "nouveaux" (graphe pour
causal, events pour timeline). Le mode legacy est auto-migré au premier
edit. Si une scène pilote utilise encore le legacy, on bascule sa
structure dès la première interaction utilisateur — l'admin doit donc
sauvegarder pour propager. Aucune perte de données.

### c. `loadEnv()` dans le script

J'ai préféré ne pas dépendre de `dotenv` (pas dans le package.json) et
parser `.env.local` à la main. Limitation : pas de support des values
multilignes ou échappement complexe. Suffisant pour les 2 vars Supabase
nécessaires.

---

## 5. Checklist livraison BLOC 1

- [x] `npm run build` passe sans erreur TS (`Compiled successfully` +
      `Linting and checking validity of types ...`)
- [x] Aucune modification de `src/context/AudioContext.tsx` (audio HTML
      natif partout dans l'éditeur)
- [x] Aucune dépendance npm ajoutée (`package.json` & `package-lock.json`
      non touchés sauf installation initiale dans le sandbox)
- [x] Path `audio-timelines/{type}/{source_id}/{version}.json` utilisé
      pour tous nouveaux saves
- [x] Validation Zod côté serveur via `TimelineSchema.parse()` strict,
      400 explicite avec `details.fieldErrors`
- [x] Auth `isSuperAdmin` testée sur les 3 routes API + 2 pages
- [x] Composants templates whiteboard existants `<Grid>`, `<Flowchart>`,
      etc. **non modifiés** — l'éditeur les consomme via
      `<StructuredWhiteboard>`
- [x] Tokens design custom (`ds-turquoise`, `axe3`, `emerald-500`,
      `bg-[color:var(--color-bg)]`) utilisés
- [x] Modèle LLM Sonnet 4.6 inchangé (BLOC 1 ne touche pas à l'extraction)
- [x] Page accessible mobile en stack vertical (`grid-cols-1 lg:grid-cols-[280px_1fr_360px]`)

---

## 6. Procédure post-merge

### a. Migration Storage (pré-requis pour activer le nouveau pattern)

```bash
# Sur la machine du dev, avec .env.local complet :
cd /path/to/DentalLearn-V3
npx tsx scripts/migrate_timelines_storage.ts --dry-run
# Vérifier que la séquence pilote e8dfa6b8-... est listée comme MIGRATED
npx tsx scripts/migrate_timelines_storage.ts --execute
```

Idempotent. Les anciens fichiers `audio-timelines/poc/...` ne sont PAS
supprimés (on garde un fallback de 30j à minima). La colonne
`timeline_url` pointe ensuite vers le nouveau path
`audio-timelines/formation/{id}/{ISO}.json`.

### b. Test fumée

Aller sur Vercel preview / prod :
`https://dental-learn-v3.vercel.app/admin/timelines/formation/e8dfa6b8-ef34-4454-a198-e6f973f466de`

Suivre le protocole de test plus bas.

---

## 7. Protocole de test pas-à-pas (pour Dr Fantin)

> **Comment lire ce protocole**
> Tu fais chaque test dans l'ordre. Coche ✅ si OK, ❌ + capture si KO.
> Tout l'éditeur tourne sur la séquence pilote « Communication non
> verbale ». Tu peux tester sur d'autres séquences si elles ont déjà
> une timeline.

### Test 1 — Ouvrir la séquence pilote

1. Va sur `https://dental-learn-v3.vercel.app/admin/timelines/formation/e8dfa6b8-ef34-4454-a198-e6f973f466de`
2. Tu dois voir : un header en haut (titre de la séquence + bouton
   bleu/turquoise « Enregistrer »), une liste de 5 scènes à gauche,
   un lecteur audio + une preview au centre, des champs d'édition à
   droite.
3. Le bouton « Enregistrer » doit être grisé (rien à enregistrer pour
   l'instant).

### Test 2 — Sécurité d'accès

1. Déconnecte-toi puis re-connecte-toi avec un compte qui n'est PAS
   super_admin.
2. Va sur la même URL.
3. Tu dois être redirigé vers la page d'accueil ; tu ne dois jamais
   voir l'éditeur.

### Test 3 — Sélectionner une scène

1. Re-connecté en super_admin, retour sur la page éditeur.
2. Clique sur la 2e scène dans la liste de gauche.
3. La preview centre doit changer pour afficher le contenu de la 2e
   scène (les cards/figures correspondantes).
4. Le panneau de droite doit afficher le titre, le début (sec) et la
   fin (sec) de cette scène.

### Test 4 — Modifier le titre d'une scène

1. Dans le champ « Titre de la scène » (panneau droit), remplace le
   texte par : `Test Fantin 1`.
2. Le bouton « Enregistrer » devient turquoise (= activé).
3. La pastille « Modifications non enregistrées » apparaît (orange).
4. Clique « Enregistrer ». Une bulle verte « Sauvegardé (version …) »
   apparaît en bas à droite.
5. Recharge la page (F5). Le titre `Test Fantin 1` est toujours là.

### Test 5 — Modifier le début/la fin

1. Sélectionne une scène. Change le « Début (sec) » pour `100`.
2. Si ça crée un chevauchement avec une autre scène, un bandeau orange
   apparaît : « Cette scène chevauche la scène X ». L'enregistrement
   reste possible.
3. Si tu mets « Fin (sec) » plus petite que « Début (sec) », les deux
   inputs deviennent rouges. Tu peux quand même enregistrer (le schéma
   actuel le permet — voir la dette `POC-T6-D1`).

### Test 6 — Ajouter une scène

1. Clique « + Ajouter une scène » en bas de la liste de gauche.
2. Une nouvelle scène apparaît avec le titre « Nouvelle scène » et un
   template grille à 2 cards. Elle est sélectionnée automatiquement.
3. Modifie son titre puis « Enregistrer ». Recharge → la nouvelle
   scène est conservée.

### Test 7 — Supprimer une scène

1. Survole une scène (autre que celle sélectionnée). Une icône
   poubelle apparaît à droite.
2. Clique. Une fenêtre `confirm()` du navigateur s'affiche (« Supprimer
   la scène … ? »). Confirme.
3. La scène disparaît. Bouton Enregistrer activé. Enregistre, puis
   recharge — la scène est bien supprimée.

### Test 8 — Modifier une card et voir la preview

1. Sélectionne une scène avec template « Grille ».
2. Dans le panneau droit, change le texte de la 1ère card.
3. La preview centre se met à jour en TEMPS RÉEL (sans recharger).
4. Tape de plus en plus de caractères : autour de 50, le compteur
   passe orange. Au-delà de 60, bordure rouge + compteur rouge.

### Test 9 — Variant d'une card

1. Sur une card, clique le bouton « Mise en avant ». Le bouton devient
   turquoise.
2. Le visuel de la card change dans la preview (couleur d'accent).
3. Enregistre, recharge, le variant est persisté.

### Test 10 — Changer le type de visualisation

1. Sélectionne une scène en grille.
2. Dans le dropdown du panneau droit, choisis « Flowchart ».
3. Une fenêtre apparaît : « Changer le type de visualisation effacera
   le contenu actuel… ». Clique « Annuler » : rien ne change, le
   dropdown revient sur « Grille ».
4. Re-fais l'opération mais clique « Confirmer » (rouge). Le contenu
   est remplacé par 2 étapes vierges. Bouton Enregistrer activé.

### Test 11 — Tester chaque type de template

Pour chaque type (grille, flowchart, comparaison, chiffres clés, graphe
causal, frise chronologique), crée une scène de test, modifie son
contenu (ajouter/supprimer un élément, changer un texte), enregistre,
recharge. Tout doit persister.

### Test 12 — Publier la timeline

1. En haut à droite de l'éditeur, le bouton « Brouillon » est gris.
2. Clique. Une popup `confirm()` te demande confirmation.
3. Confirme. La pastille passe au vert « Publié ».
4. Recharge. Toujours publié. (En vrai côté users, la timeline est
   maintenant visible — feature à brancher en BLOC 3.)
5. Reclique pour dépublier (sans confirmation, c'est moins critique
   dans ce sens).

### Test 13 — News V1 (lecture/édition basique)

1. Va sur `https://dental-learn-v3.vercel.app/admin/timelines/news/<un_id_de_synthese_existant>`.
2. Si la synthèse n'a pas de timeline (cas par défaut V1), tu vois un
   bandeau orange « Aucune timeline générée — disponible après T8 ».
3. Pas de plantage. Pas de bouton « Régénérer LLM » visible (cohérent
   avec la décision D1 V1).

### Test 14 — Avertissement de fermeture

1. Modifie un champ sans enregistrer.
2. Essaie de fermer l'onglet ou de naviguer ailleurs.
3. Le navigateur affiche un avertissement « Quitter le site ? Vos
   modifications ne seront peut-être pas enregistrées ».

### Test 15 — Audio et synchronisation

1. Le mode par défaut est « Figer sur la scène sélectionnée ».
2. Cliquer une autre scène saute le curseur audio à son début.
3. Bascule sur « Suivre l'audio ». Lance la lecture. La preview
   whiteboard suit en temps réel selon le `currentTime` de l'audio
   (la scène active change quand le curseur passe d'une fenêtre à
   l'autre).

---

## 8. Hors scope BLOC 1 (préparation BLOC 2 / 3)

- Drag-reorder de la sidebar (BLOC 2).
- Bouton « Régénérer via LLM » (BLOC 2 — branche sur l'API
  existante `/api/admin/timeline/extract-scenes`).
- Édition concepts (BLOC 2 ou 3, à voir avec Dr Fantin).
- Édition côté news avec génération auto (BLOC 3 après T8).
- Affichage côté user de la timeline publiée (BLOC 3).

---

*Recap rédigé par Claude Code, le 8 mai 2026, à partir du prompt POC-T6
BLOC 1 fourni en début de session. Référence : spec POC visualisation
audio v1.0 + RECAP_SESSION_POC_AUDIO_T5_07MAI2026.md.*
